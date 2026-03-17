"""
FX Risk Intelligence Platform — Backend v5
==========================================
Data sources (in priority order):
  1. Frankfurter.app — free, no key, works in all cloud environments
     → EUR/USD, GBP/USD, USD/CNY (ECB-based rates)
  2. Alpha Vantage — USD/NGN primary (free key)
  3. ExchangeRate-API — today's live spot patch
  4. Local CSV/Excel — final fallback

Multi-currency: USD/NGN, EUR/USD, GBP/USD, USD/CNY, NGN/CNY
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from apscheduler.schedulers.background import BackgroundScheduler
import yfinance as yf
import httpx, os, logging, asyncio, time
from datetime import datetime, timedelta
from typing import Optional

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("fx-intelligence")

# ── Configuration ─────────────────────────────────────────────────────────────
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_KEY", "")
EXCHANGERATE_KEY  = os.getenv("EXCHANGERATE_KEY",  "")
DATA_DIR          = os.path.join(os.path.dirname(__file__), "..", "data")
FORECAST_HORIZONS = [1, 2, 3, 5, 7]

CURRENCY_PAIRS = [
    ("USD", "NGN", "USDNGN=X", "USD/NGN"),
    ("EUR", "USD", "EURUSD=X", "EUR/USD"),
    ("GBP", "USD", "GBPUSD=X", "GBP/USD"),
    ("USD", "CNY", "USDCNY=X", "USD/CNY"),
    ("NGN", "CNY", None,       "NGN/CNY"),
]
PAIR_IDS = [f"{f}{t}" for f, t, _, _ in CURRENCY_PAIRS]

FEATURES = [
    "fx_lag1", "fx_lag2", "fx_lag3",
    "oil_lag1", "oil_change",
    "fx_rolling_mean_7", "fx_rolling_mean_14",
    "fx_volatility_7", "fx_volatility_14",
    "fx_momentum", "fx_momentum_14",
    "oil_fx_ratio", "day_of_week", "month",
]

MODELS: dict = {}
OIL_DATA: Optional[pd.DataFrame] = None
LAST_TRAINED: Optional[str] = None

# ── Helpers ───────────────────────────────────────────────────────────────────
def _safe(v):
    if isinstance(v, np.integer):  return int(v)
    if isinstance(v, np.floating): return None if np.isnan(v) else float(v)
    if isinstance(v, np.ndarray):  return v.tolist()
    try:
        if pd.isna(v): return None
    except Exception:
        pass
    return v

def signal_label(v: float) -> str:
    if v >  0.8: return "STRONG RISE"
    if v >  0.2: return "SLIGHT RISE"
    if v < -0.8: return "STRONG DROP"
    if v < -0.2: return "SLIGHT DROP"
    return "STABLE"

def volatility_level(vol: float, threshold: float) -> str:
    if vol > threshold * 1.5: return "HIGH"
    if vol > threshold:       return "MEDIUM"
    return "LOW"

def is_fresh(df: pd.DataFrame, max_days: int = 7) -> bool:
    """Check if dataframe has recent data."""
    if df is None or len(df) == 0:
        return False
    return (pd.Timestamp.today() - df["Date"].max()).days <= max_days

# ── Live Data Fetchers ────────────────────────────────────────────────────────

async def fetch_frankfurter(client: httpx.AsyncClient, from_sym: str, to_sym: str, start: str) -> Optional[pd.DataFrame]:
    """
    Fetch FX rates from frankfurter.app — free, no key, ECB data.
    Works in all cloud environments. Supports major pairs only (no NGN).
    """
    try:
        url = f"https://api.frankfurter.dev/v1/{start}..?from={from_sym}&to={to_sym}"
        r = await client.get(url, timeout=30)
        data = r.json()
        rates = data.get("rates", {})
        if not rates:
            log.warning(f"Frankfurter {from_sym}/{to_sym}: empty response")
            return None
        rows = []
        for date_str, rate_dict in rates.items():
            rate = rate_dict.get(to_sym)
            if rate:
                rows.append({"Date": pd.Timestamp(date_str), "rate": float(rate)})
        if not rows:
            return None
        df = pd.DataFrame(rows).sort_values("Date").reset_index(drop=True)
        log.info(f"Frankfurter {from_sym}/{to_sym}: {len(df)} rows through {df['Date'].max().date()}")
        return df
    except Exception as e:
        log.error(f"Frankfurter {from_sym}/{to_sym} error: {e}")
        return None


async def fetch_av_pair(client: httpx.AsyncClient, from_sym: str, to_sym: str) -> Optional[pd.DataFrame]:
    """Fetch daily FX pair from Alpha Vantage."""
    if not ALPHA_VANTAGE_KEY:
        return None
    try:
        url = (
            f"https://www.alphavantage.co/query"
            f"?function=FX_DAILY&from_symbol={from_sym}&to_symbol={to_sym}"
            f"&outputsize=full&apikey={ALPHA_VANTAGE_KEY}"
        )
        r = await client.get(url, timeout=30)
        data = r.json()
        if "Note" in data or "Information" in data:
            log.warning(f"AV rate limit for {from_sym}/{to_sym}")
            return None
        ts = data.get("Time Series FX (Daily)", {})
        if not ts:
            return None
        rows = [{"Date": pd.Timestamp(d), "rate": float(v["4. close"])} for d, v in ts.items()]
        df = pd.DataFrame(rows).sort_values("Date").reset_index(drop=True)
        log.info(f"AV {from_sym}/{to_sym}: {len(df)} rows through {df['Date'].max().date()}")
        return df
    except Exception as e:
        log.error(f"AV {from_sym}/{to_sym} error: {e}")
        return None


def _fetch_yf_sync(ticker: str, start: str) -> Optional[pd.DataFrame]:
    try:
        raw = yf.download(ticker, start=start, interval="1d", progress=False, auto_adjust=True)
        if raw.empty:
            return None
        if hasattr(raw.columns, 'levels'):
            raw.columns = raw.columns.droplevel(1)
        raw = raw[["Close"]].reset_index()
        raw.columns = ["Date", "rate"]
        raw["Date"] = pd.to_datetime(raw["Date"]).dt.tz_localize(None).dt.normalize()
        raw = raw.dropna().sort_values("Date").reset_index(drop=True)
        log.info(f"yfinance {ticker}: {len(raw)} rows through {raw['Date'].max().date()}")
        return raw if len(raw) > 10 else None
    except Exception as e:
        log.error(f"yfinance {ticker} error: {e}")
        return None

async def fetch_yf(ticker: str, start: str) -> Optional[pd.DataFrame]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_yf_sync, ticker, start)


async def fetch_er_today(client: httpx.AsyncClient, to_sym: str) -> Optional[float]:
    if not EXCHANGERATE_KEY:
        return None
    try:
        url = f"https://v6.exchangerate-api.com/v6/{EXCHANGERATE_KEY}/latest/USD"
        r = await client.get(url, timeout=10)
        rate = r.json().get("conversion_rates", {}).get(to_sym)
        return float(rate) if rate else None
    except Exception as e:
        log.error(f"ExchangeRate-API error: {e}")
        return None


async def fetch_ngn_history(client: httpx.AsyncClient, local_csv_df: Optional[pd.DataFrame]) -> Optional[pd.DataFrame]:
    """
    Build USD/NGN history by combining:
    1. Local CSV (up to 2024-04-28)
    2. ExchangeRate-API monthly history to fill gap to today
    This gives us a complete dataset from 2016 to today.
    """
    base = local_csv_df.copy() if local_csv_df is not None else pd.DataFrame(columns=["Date", "rate"])
    
    if not EXCHANGERATE_KEY:
        log.warning("No EXCHANGERATE_KEY — can't fetch NGN history gap")
        return base if len(base) > 30 else None
    
    # Find the gap: from day after last CSV date to today
    last_date = base["Date"].max() if len(base) > 0 else pd.Timestamp("2023-01-01")
    today = pd.Timestamp.today().normalize()
    
    if (today - last_date).days <= 2:
        log.info("NGN data already current")
        return base
    
    log.info(f"Fetching NGN gap: {last_date.date()} → {today.date()} ({(today-last_date).days} days)")
    
    # Fetch each month in the gap from ExchangeRate-API history endpoint
    new_rows = []
    current = last_date + timedelta(days=1)
    
    # Fetch in monthly chunks to minimize API calls
    months_fetched = 0
    while current <= today and months_fetched < 36:  # max 3 years
        year, month = current.year, current.month
        try:
            url = f"https://v6.exchangerate-api.com/v6/{EXCHANGERATE_KEY}/history/USD/{year}/{month}"
            r = await client.get(url, timeout=15)
            data = r.json()
            
            if data.get("result") == "success":
                conversions = data.get("conversion_amounts", {})
                # Try alternate response format
                if not conversions:
                    days_data = data.get("conversion_amounts") or data.get("rates") or {}
                
                # Actually use the month endpoint response
                month_rates = data.get("conversion_rates") or data.get("rates") or {}
                ngn_rate = month_rates.get("NGN")
                if ngn_rate:
                    # Use same rate for all business days in month (approximation)
                    month_end = min(today, pd.Timestamp(year, month, 1) + pd.offsets.MonthEnd(0))
                    for d in pd.date_range(current, month_end, freq="B"):
                        new_rows.append({"Date": d.normalize(), "rate": float(ngn_rate)})
                    log.info(f"NGN {year}/{month:02d}: rate={ngn_rate:.2f}")
            months_fetched += 1
        except Exception as e:
            log.error(f"NGN history {year}/{month}: {e}")
        
        # Move to next month
        if month == 12:
            current = pd.Timestamp(year + 1, 1, 1)
        else:
            current = pd.Timestamp(year, month + 1, 1)
        
        await asyncio.sleep(0.5)  # be nice to the API
    
    if new_rows:
        new_df = pd.DataFrame(new_rows)
        combined = pd.concat([base, new_df], ignore_index=True)
        combined = combined.drop_duplicates("Date").sort_values("Date").reset_index(drop=True)
        log.info(f"NGN combined: {len(combined)} rows through {combined['Date'].max().date()}")
        return combined
    
    # Fallback: just patch today's rate
    log.warning("NGN history fetch returned no rows — patching today only")
    return base


async def fetch_er_historical(client: httpx.AsyncClient, to_sym: str, start: str) -> Optional[pd.DataFrame]:
    """
    Fetch historical USD/X rates from ExchangeRate-API.
    Uses the /history endpoint — available on free tier.
    Fetches month by month from start date to today.
    """
    if not EXCHANGERATE_KEY:
        return None
    try:
        rows = []
        start_dt = pd.Timestamp(start)
        end_dt   = pd.Timestamp.today()
        current  = start_dt.replace(day=1)

        # Limit to last 2 years to avoid too many API calls
        if (end_dt - start_dt).days > 730:
            current = (end_dt - timedelta(days=730)).replace(day=1)

        month_count = 0
        while current <= end_dt and month_count < 24:
            year  = current.year
            month = current.month
            url = f"https://v6.exchangerate-api.com/v6/{EXCHANGERATE_KEY}/history/USD/{year}/{month}"
            try:
                r = await client.get(url, timeout=15)
                data = r.json()
                if data.get("result") == "success":
                    for day_str, rates in data.get("conversion_rates", {}).items():
                        rate = rates.get(to_sym)
                        if rate:
                            rows.append({"Date": pd.Timestamp(day_str), "rate": float(rate)})
            except Exception:
                pass
            # Move to next month
            if current.month == 12:
                current = current.replace(year=current.year+1, month=1)
            else:
                current = current.replace(month=current.month+1)
            month_count += 1
            await asyncio.sleep(0.2)  # small delay

        if not rows:
            return None
        df = pd.DataFrame(rows).sort_values("Date").drop_duplicates("Date").reset_index(drop=True)
        log.info(f"ER Historical USD/{to_sym}: {len(df)} rows through {df['Date'].max().date()}")
        return df
    except Exception as e:
        log.error(f"ER Historical error: {e}")
        return None


def _fetch_oil_sync(start: str) -> Optional[pd.DataFrame]:
    try:
        raw = yf.download("BZ=F", start=start, interval="1d", progress=False, auto_adjust=True)
        if raw.empty:
            return None
        if hasattr(raw.columns, 'levels'):
            raw.columns = raw.columns.droplevel(1)
        raw = raw[["Close"]].reset_index()
        raw.columns = ["Date", "OilPrice"]
        raw["Date"] = pd.to_datetime(raw["Date"]).dt.tz_localize(None).dt.normalize()
        return raw.dropna().sort_values("Date").reset_index(drop=True)
    except Exception as e:
        log.error(f"Oil fetch error: {e}")
        return None

def fetch_oil(start: str) -> Optional[pd.DataFrame]:
    return _fetch_oil_sync(start)

def load_local_fx(pair_id: str) -> Optional[pd.DataFrame]:
    if pair_id != "USDNGN":
        return None
    try:
        fx = pd.read_csv(os.path.join(DATA_DIR, "USD_NGN_Historical_Data__2_.csv"))
        fx = fx.rename(columns={"Price": "rate"})
        fx["Date"] = pd.to_datetime(fx["Date"])
        return fx[["Date", "rate"]].sort_values("Date").reset_index(drop=True)
    except Exception:
        return None

def load_local_oil() -> Optional[pd.DataFrame]:
    try:
        oil = pd.read_excel(os.path.join(DATA_DIR, "Brent_Comodity_Prices.xlsx"))
        oil = oil.rename(columns={list(oil.columns)[1]: "OilPrice"})
        oil["Date"] = pd.to_datetime(oil["Date"])
        return oil[["Date", "OilPrice"]].sort_values("Date").reset_index(drop=True)
    except Exception:
        return None

# ── Feature Engineering ───────────────────────────────────────────────────────

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    d["fx_lag1"]            = d["rate"].shift(1)
    d["fx_lag2"]            = d["rate"].shift(2)
    d["fx_lag3"]            = d["rate"].shift(3)
    d["oil_lag1"]           = d["OilPrice"].shift(1)
    d["fx_rolling_mean_7"]  = d["rate"].rolling(7).mean()
    d["fx_rolling_mean_14"] = d["rate"].rolling(14).mean()
    d["fx_volatility_7"]    = d["rate"].rolling(7).std()
    d["fx_volatility_14"]   = d["rate"].rolling(14).std()
    d["fx_momentum"]        = d["rate"] - d["rate"].shift(5)
    d["fx_momentum_14"]     = d["rate"] - d["rate"].shift(14)
    d["oil_fx_ratio"]       = d["OilPrice"] / d["rate"]
    d["oil_change"]         = d["OilPrice"].pct_change()
    d["day_of_week"]        = d["Date"].dt.dayofweek
    d["month"]              = d["Date"].dt.month
    return d

# ── Forward Forecast ──────────────────────────────────────────────────────────

def build_forward_forecast(data: pd.DataFrame, model, horizons: list) -> list:
    rolling    = data.copy()
    forecasts  = []
    steps_done = 0
    last_rate  = float(rolling["rate"].iloc[-1])
    cumulative = 0.0

    for h in sorted(horizons):
        for _ in range(h - steps_done):
            last = rolling.iloc[-1]
            next_date = last["Date"] + timedelta(days=1)
            while next_date.weekday() >= 5:
                next_date += timedelta(days=1)
            row = {
                "Date": next_date, "rate": float(last["rate"]), "OilPrice": float(last["OilPrice"]),
                "fx_lag1": float(last["rate"]),
                "fx_lag2": float(last.get("fx_lag1", last["rate"])),
                "fx_lag3": float(last.get("fx_lag2", last["rate"])),
                "oil_lag1": float(last["OilPrice"]), "oil_change": 0.0,
                "fx_rolling_mean_7":  float(rolling["rate"].tail(7).mean()),
                "fx_rolling_mean_14": float(rolling["rate"].tail(14).mean()),
                "fx_volatility_7":    float(rolling["rate"].tail(7).std()),
                "fx_volatility_14":   float(rolling["rate"].tail(14).std()),
                "fx_momentum":    float(last["rate"] - rolling["rate"].iloc[-5]) if len(rolling) >= 5 else 0.0,
                "fx_momentum_14": float(last["rate"] - rolling["rate"].iloc[-14]) if len(rolling) >= 14 else 0.0,
                "oil_fx_ratio": float(last["OilPrice"] / last["rate"]),
                "day_of_week": next_date.weekday(), "month": next_date.month,
            }
            pred = float(model.predict(pd.DataFrame([row])[FEATURES])[0])
            cumulative += pred
            row["rate"] = float(last["rate"]) * (1 + pred / 100)
            rolling = pd.concat([rolling, pd.DataFrame([row])], ignore_index=True)
            steps_done += 1

        projected_rate = last_rate * (1 + cumulative / 100)
        forecasts.append({
            "horizon": h, "label": f"+{h}d",
            "forecast_date":    rolling["Date"].iloc[-1].strftime("%Y-%m-%d"),
            "current_rate":     round(last_rate, 4),
            "predicted_rate":   round(projected_rate, 4),
            "predicted_change": round(cumulative, 4),
            "signal":           signal_label(cumulative),
        })
    return forecasts

# ── Per-Pair Training ─────────────────────────────────────────────────────────

def train_pair(pair_id: str, fx_df: pd.DataFrame, oil_df: pd.DataFrame, display_name: str) -> dict:
    try:
        data = pd.merge(fx_df[["Date", "rate"]], oil_df[["Date", "OilPrice"]], on="Date", how="inner")
        data = data.sort_values("Date").reset_index(drop=True)

        full_range = pd.date_range(data["Date"].min(), data["Date"].max(), freq="D")
        data = data.set_index("Date").reindex(full_range).rename_axis("Date").reset_index()
        data["OilPrice"] = data["OilPrice"].ffill()
        data["rate"]     = data["rate"].ffill()
        data = data.dropna(subset=["rate", "OilPrice"])

        if "NGN" in pair_id:
            data = data[data["Date"] >= "2023-06-01"].reset_index(drop=True)
        else:
            cutoff = data["Date"].max() - timedelta(days=365*3)
            data = data[data["Date"] >= cutoff].reset_index(drop=True)

        if len(data) < 60:
            log.warning(f"{pair_id}: insufficient data ({len(data)} rows)")
            return {}

        data = engineer_features(data)
        data["next_day_change_pct"] = data["rate"].pct_change().shift(-1) * 100
        vol_threshold = float(data["fx_volatility_7"].quantile(0.75))
        data["high_volatility_flag"] = (data["fx_volatility_7"] > vol_threshold).astype(int)
        data = data.dropna()

        X, y = data[FEATURES], data["next_day_change_pct"]
        split = int(len(data) * 0.8)
        X_train, X_test = X.iloc[:split], X.iloc[split:]
        y_train, y_test = y.iloc[:split], y.iloc[split:]

        rf = RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)
        gb = GradientBoostingRegressor(n_estimators=200, random_state=42, learning_rate=0.05)
        rf.fit(X_train, y_train); rf_preds = rf.predict(X_test)
        gb.fit(X_train, y_train); gb_preds = gb.predict(X_test)

        def dir_acc(yt, yp): return float(np.mean(np.sign(yt) == np.sign(yp)) * 100)
        rf_da, gb_da = dir_acc(y_test, rf_preds), dir_acc(y_test, gb_preds)
        best_model = rf if rf_da >= gb_da else gb
        best_preds = rf_preds if rf_da >= gb_da else gb_preds
        best_name  = "Random Forest" if rf_da >= gb_da else "Gradient Boosting"

        test_data = data.iloc[split:].copy()
        test_data["predicted_change"] = best_preds
        test_data["signal"]           = test_data["predicted_change"].apply(signal_label)
        latest = test_data.iloc[-1]

        log.info(f"✅ {pair_id}: {best_name} DirAcc={max(rf_da,gb_da):.1f}% rows={len(data)}")

        return {
            "pair_id": pair_id, "display_name": display_name,
            "test_data": test_data, "best_model": best_model,
            "best_name": best_name, "vol_threshold": vol_threshold,
            "vol_spike_prob": float(data["high_volatility_flag"].tail(5).mean()),
            "current_vol_level": volatility_level(float(latest["fx_volatility_7"]), vol_threshold),
            "metrics": {
                "rmse": float(np.sqrt(mean_squared_error(y_test, best_preds))),
                "mae":  float(mean_absolute_error(y_test, best_preds)),
                "r2":   float(r2_score(y_test, best_preds)),
                "direction_accuracy_best": max(rf_da, gb_da),
                "direction_accuracy_rf":   rf_da,
                "direction_accuracy_gb":   gb_da,
            },
            "feature_importance": dict(zip(FEATURES, best_model.feature_importances_)),
            "forecasts":     build_forward_forecast(data, best_model, FORECAST_HORIZONS),
            "data_through":  data["Date"].max().strftime("%Y-%m-%d"),
            "current_rate":  float(latest["rate"]),
            "latest_signal": latest["signal"],
            "latest_vol":    float(latest["fx_volatility_7"]),
            "latest_high_vol": int(latest["high_volatility_flag"]),
        }
    except Exception as e:
        log.error(f"Training failed for {pair_id}: {e}")
        import traceback; traceback.print_exc()
        return {}

# ── Alert Detection ───────────────────────────────────────────────────────────

def detect_alerts(pair_states: dict) -> list:
    alerts = []
    for pair_id, state in pair_states.items():
        if not state: continue
        f1 = next((f for f in state.get("forecasts", []) if f["horizon"] == 1), None)
        if state.get("latest_high_vol"):
            alerts.append({"type": "VOLATILITY", "severity": "HIGH", "pair": state["display_name"],
                "message": f"{state['display_name']} volatility above 75th percentile threshold",
                "value": round(state["latest_vol"], 2)})
        if f1 and abs(f1["predicted_change"]) > 0.8:
            alerts.append({"type": "MOVE", "severity": "HIGH" if abs(f1["predicted_change"]) > 1.5 else "MEDIUM",
                "pair": state["display_name"],
                "message": f"{state['display_name']} model signals {f1['signal']} of {abs(f1['predicted_change']):.3f}%",
                "value": f1["predicted_change"]})
        if state.get("vol_spike_prob", 0) > 0.6:
            alerts.append({"type": "SPIKE_RISK", "severity": "MEDIUM", "pair": state["display_name"],
                "message": f"{state['display_name']} elevated volatility spike probability: {state['vol_spike_prob']*100:.0f}%",
                "value": round(state["vol_spike_prob"], 2)})
    return sorted(alerts, key=lambda x: {"HIGH": 0, "MEDIUM": 1, "LOW": 2}[x["severity"]])

# ── Main Pipeline ─────────────────────────────────────────────────────────────

async def fetch_usdngn_combined(client: httpx.AsyncClient, er_rates: dict) -> Optional[pd.DataFrame]:
    """
    Build USD/NGN history by combining:
    1. Local CSV (up to May 2024)
    2. ExchangeRate-API /history endpoint for recent months
    3. Today's live rate from er_rates
    """
    frames = []

    # 1. Load local CSV as base
    local = load_local_fx("USDNGN")
    if local is not None:
        frames.append(local)
        log.info(f"USDNGN local CSV: {len(local)} rows through {local['Date'].max().date()}")

    # 2. Fetch recent history from ExchangeRate-API (month by month from May 2024)
    if EXCHANGERATE_KEY:
        try:
            # Get history from last known date to today
            start_month = pd.Timestamp("2024-05-01")
            end_month   = pd.Timestamp.today()
            current     = start_month
            fetched_rows = []

            while current <= end_month:
                year  = current.year
                month = current.month
                url   = f"https://v6.exchangerate-api.com/v6/{EXCHANGERATE_KEY}/history/USD/{year}/{month}"
                try:
                    r = await client.get(url, timeout=15)
                    data = r.json()
                    if data.get("result") == "success":
                        for day, rates in data.get("conversion_rates", {}).items():
                            ngn_rate = rates.get("NGN") if isinstance(rates, dict) else None
                            if ngn_rate:
                                fetched_rows.append({"Date": pd.Timestamp(f"{year}-{month:02d}-{int(day):02d}"), "rate": float(ngn_rate)})
                except Exception as ex:
                    log.warning(f"ExchangeRate-API history {year}/{month}: {ex}")
                current = current + pd.DateOffset(months=1)
                await asyncio.sleep(0.3)  # be polite

            if fetched_rows:
                hist_df = pd.DataFrame(fetched_rows).sort_values("Date").reset_index(drop=True)
                frames.append(hist_df)
                log.info(f"USDNGN ExchangeRate-API history: {len(hist_df)} rows")
        except Exception as e:
            log.error(f"ExchangeRate-API history error: {e}")

    # 3. Patch today's live rate
    if "NGN" in er_rates:
        today = pd.Timestamp.today().normalize()
        frames.append(pd.DataFrame([{"Date": today, "rate": er_rates["NGN"]}]))
        log.info(f"USDNGN live patch: {er_rates['NGN']:.2f}")

    if not frames:
        return None

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.sort_values("Date").drop_duplicates("Date", keep="last").reset_index(drop=True)
    return combined

async def pipeline():
    global MODELS, OIL_DATA, LAST_TRAINED
    log.info("🔄 Starting multi-currency pipeline v5...")

    start_5y = (datetime.now() - timedelta(days=365*5)).strftime("%Y-%m-%d")
    start_3y = (datetime.now() - timedelta(days=365*3)).strftime("%Y-%m-%d")

    # 1. Oil data
    oil = fetch_oil(start_5y)
    if oil is None or len(oil) < 10:
        oil = load_local_oil()
    OIL_DATA = oil
    if oil is None:
        log.error("No oil data — aborting"); return
    log.info(f"Oil: {len(oil)} rows through {oil['Date'].max().date()}")

    pair_fx = {}

    async with httpx.AsyncClient() as client:
        # Today's live rates
        er_rates = {}
        for sym in ["NGN", "CNY"]:
            rate = await fetch_er_today(client, sym)
            if rate:
                er_rates[sym] = rate
                log.info(f"Live rate USD/{sym} = {rate:.4f}")

        # ── EUR/USD via Frankfurter (free, reliable) ──────────────────────────
        log.info("Fetching EUR/USD from Frankfurter...")
        df = await fetch_frankfurter(client, "EUR", "USD", start_3y)
        if df is not None and is_fresh(df):
            pair_fx["EURUSD"] = df
        else:
            log.warning("Frankfurter EUR/USD failed — trying yfinance")
            df = await fetch_yf("EURUSD=X", start_3y)
            if df is not None and is_fresh(df):
                pair_fx["EURUSD"] = df

        # ── GBP/USD via Frankfurter ────────────────────────────────────────────
        log.info("Fetching GBP/USD from Frankfurter...")
        df = await fetch_frankfurter(client, "GBP", "USD", start_3y)
        if df is not None and is_fresh(df):
            pair_fx["GBPUSD"] = df
        else:
            log.warning("Frankfurter GBP/USD failed — trying yfinance")
            df = await fetch_yf("GBPUSD=X", start_3y)
            if df is not None and is_fresh(df):
                pair_fx["GBPUSD"] = df

        # ── USD/CNY via Frankfurter ────────────────────────────────────────────
        log.info("Fetching USD/CNY from Frankfurter...")
        df = await fetch_frankfurter(client, "USD", "CNY", start_3y)
        if df is not None and is_fresh(df):
            pair_fx["USDCNY"] = df
        else:
            log.warning("Frankfurter USD/CNY failed — trying yfinance")
            df = await fetch_yf("USDCNY=X", start_3y)
            if df is not None and is_fresh(df):
                pair_fx["USDCNY"] = df

        # ── USD/NGN: ExchangeRate-API historical + AV + local fallback ──────────
        log.info("Fetching USD/NGN historical data...")
        ngn_df = None

        # Try ExchangeRate-API historical (most reliable for NGN)
        if EXCHANGERATE_KEY:
            ngn_df = await fetch_er_historical(client, "NGN", start_5y)

        # Try Alpha Vantage
        if ngn_df is None or not is_fresh(ngn_df):
            log.info("Trying AV for USD/NGN...")
            av_df = await fetch_av_pair(client, "USD", "NGN")
            if av_df is not None:
                if ngn_df is not None and len(ngn_df) > len(av_df):
                    pass  # keep ER historical
                else:
                    ngn_df = av_df

        # yfinance fallback
        if ngn_df is None or len(ngn_df) < 30:
            yf_df = await fetch_yf("USDNGN=X", start_5y)
            if yf_df is not None and len(yf_df) > 30:
                ngn_df = yf_df

        # Local CSV last resort
        if ngn_df is None or len(ngn_df) < 30:
            ngn_df = load_local_fx("USDNGN")
            if ngn_df is not None:
                log.info("USDNGN: using local CSV fallback")

        if ngn_df is not None:
            pair_fx["USDNGN"] = ngn_df

        # Always patch today's live NGN rate
        if "USDNGN" in pair_fx and "NGN" in er_rates:
            today = pd.Timestamp.today().normalize()
            df_ngn = pair_fx["USDNGN"]
            # Remove old today entry if exists and replace with live rate
            df_ngn = df_ngn[df_ngn["Date"] < today]
            patch = pd.DataFrame([{"Date": today, "rate": er_rates["NGN"]}])
            pair_fx["USDNGN"] = pd.concat([df_ngn, patch], ignore_index=True).sort_values("Date").reset_index(drop=True)
            log.info(f"USDNGN: today's live rate patched: {er_rates['NGN']:.2f}")

        # ── NGN/CNY derived ────────────────────────────────────────────────────
        if "USDNGN" in pair_fx and "USDCNY" in pair_fx:
            ngn = pair_fx["USDNGN"].rename(columns={"rate": "USDNGN"})
            cny = pair_fx["USDCNY"].rename(columns={"rate": "USDCNY"})
            derived = pd.merge(ngn, cny, on="Date", how="inner")
            derived["rate"] = derived["USDCNY"] / derived["USDNGN"]
            pair_fx["NGNCNY"] = derived[["Date", "rate"]]
            log.info(f"NGN/CNY derived: {len(pair_fx['NGNCNY'])} rows")

    # Log summary
    for pid, df in pair_fx.items():
        log.info(f"  {pid}: {len(df)} rows, through {df['Date'].max().date()}, fresh={is_fresh(df)}")

    # 2. Train models
    new_models = {}
    for from_sym, to_sym, _, display in CURRENCY_PAIRS:
        pair_id = f"{from_sym}{to_sym}"
        if pair_id not in pair_fx:
            log.warning(f"Skipping {pair_id} — no data"); continue
        state = train_pair(pair_id, pair_fx[pair_id], oil, display)
        if state:
            new_models[pair_id] = state

    MODELS = new_models
    LAST_TRAINED = datetime.utcnow().isoformat()
    log.info(f"✅ Pipeline complete. Trained {len(MODELS)} pairs: {list(MODELS.keys())}")


def run_pipeline():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(pipeline())
    finally:
        loop.close()

# ── Scheduler ────────────────────────────────────────────────────────────────
scheduler = BackgroundScheduler()
scheduler.add_job(run_pipeline, "cron", hour=6, minute=0, id="daily_retrain")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await pipeline()
    scheduler.start()
    log.info("Scheduler started — retrains daily at 06:00 UTC")
    yield
    scheduler.shutdown()

app = FastAPI(title="FX Risk Intelligence API", version="6.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── Helpers ───────────────────────────────────────────────────────────────────
def _require_models():
    if not MODELS: raise HTTPException(503, "Models not yet trained")

def _require_pair(pair_id: str):
    _require_models()
    pid = pair_id.upper()
    if pid not in MODELS: raise HTTPException(404, f"Pair {pid} not found. Available: {list(MODELS.keys())}")
    return MODELS[pid]

def _row(row, pair_id: str):
    return {
        "pair_id": pair_id, "date": row["Date"].strftime("%d %b"),
        "date_full": row["Date"].strftime("%Y-%m-%d"),
        "rate": _safe(row["rate"]), "actual_change": _safe(row["next_day_change_pct"]),
        "predicted_change": _safe(row["predicted_change"]), "signal": row["signal"],
        "volatility": _safe(row["fx_volatility_7"]),
        "high_volatility_flag": int(row["high_volatility_flag"]),
        "oil_price": _safe(row["OilPrice"]),
    }

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def root(): return {"service": "FX Risk Intelligence API", "version": "5.0.0", "pairs": PAIR_IDS}

@app.get("/api/health")
def health():
    return {
        "status": "ok", "trained_at": LAST_TRAINED,
        "pairs_trained": list(MODELS.keys()),
        "pairs_summary": {
            pid: {"model": s.get("best_name"), "direction_acc": s.get("metrics", {}).get("direction_accuracy_best"),
                  "data_through": s.get("data_through"), "current_rate": s.get("current_rate"),
                  "vol_level": s.get("current_vol_level")}
            for pid, s in MODELS.items()
        },
    }

@app.get("/api/pairs")
def list_pairs():
    _require_models()
    return {"pairs": [
        {"pair_id": pid, "display_name": s["display_name"], "current_rate": s["current_rate"],
         "signal_1d": s["forecasts"][0]["signal"] if s["forecasts"] else None,
         "change_1d": s["forecasts"][0]["predicted_change"] if s["forecasts"] else None,
         "vol_level": s["current_vol_level"], "high_vol": bool(s["latest_high_vol"]),
         "dir_accuracy": s["metrics"]["direction_accuracy_best"], "data_through": s["data_through"]}
        for pid, s in MODELS.items()
    ]}

@app.get("/api/alerts")
def alerts():
    _require_models()
    return {"alerts": detect_alerts(MODELS), "generated_at": LAST_TRAINED, "total_pairs": len(MODELS)}

@app.get("/api/{pair_id}/predictions")
def predictions(pair_id: str):
    state = _require_pair(pair_id)
    return {"pair_id": pair_id.upper(), "predictions": [_row(r, pair_id.upper()) for _, r in state["test_data"].iterrows()]}

@app.get("/api/{pair_id}/volatility")
def volatility(pair_id: str):
    state = _require_pair(pair_id)
    td = state["test_data"]
    return {"pair_id": pair_id.upper(),
        "volatility": [{"date": r["Date"].strftime("%d %b"), "volatility": _safe(r["fx_volatility_7"]), "high_flag": int(r["high_volatility_flag"])} for _, r in td.iterrows()],
        "threshold": state["vol_threshold"], "vol_level": state["current_vol_level"]}

@app.get("/api/{pair_id}/feature-importance")
def feature_importance(pair_id: str):
    state = _require_pair(pair_id)
    return {"pair_id": pair_id.upper(), "feature_importance": sorted(
        [{"feature": k, "importance": round(float(v), 4)} for k, v in state["feature_importance"].items()],
        key=lambda x: x["importance"], reverse=True)}

@app.get("/api/{pair_id}/signals")
def signals(pair_id: str):
    state = _require_pair(pair_id)
    td = state["test_data"]
    return {"pair_id": pair_id.upper(), "display_name": state["display_name"],
        "latest": _row(td.iloc[-1], pair_id.upper()),
        "signal_distribution": td["signal"].value_counts().to_dict(),
        "metrics": state["metrics"], "model_name": state["best_name"],
        "vol_threshold": state["vol_threshold"], "vol_level": state["current_vol_level"],
        "vol_spike_prob": state["vol_spike_prob"]}

@app.get("/api/{pair_id}/forecast")
def forecast(pair_id: str):
    state = _require_pair(pair_id)
    return {"pair_id": pair_id.upper(), "display_name": state["display_name"],
        "generated_at": LAST_TRAINED, "data_through": state["data_through"],
        "current_rate": state["current_rate"], "model": state["best_name"],
        "direction_accuracy": state["metrics"]["direction_accuracy_best"],
        "forecasts": state["forecasts"], "disclaimer": "ML predictions only. Not financial advice."}

@app.get("/api/{pair_id}/forecast/{horizon}")
def forecast_single(pair_id: str, horizon: int):
    state = _require_pair(pair_id)
    if horizon not in FORECAST_HORIZONS: raise HTTPException(400, f"Horizon must be one of {FORECAST_HORIZONS}")
    match = next((f for f in state["forecasts"] if f["horizon"] == horizon), None)
    if not match: raise HTTPException(404, "Forecast not found")
    return {**match, "pair_id": pair_id.upper(), "generated_at": LAST_TRAINED}

# Legacy endpoints (default to USDNGN)
@app.get("/api/predictions")
def predictions_legacy():
    if "USDNGN" not in MODELS: raise HTTPException(503, "Model not ready")
    return predictions("USDNGN")

@app.get("/api/volatility")
def volatility_legacy():
    if "USDNGN" not in MODELS: raise HTTPException(503, "Model not ready")
    return volatility("USDNGN")

@app.get("/api/feature-importance")
def fi_legacy():
    if "USDNGN" not in MODELS: raise HTTPException(503, "Model not ready")
    return feature_importance("USDNGN")

@app.get("/api/signals")
def signals_legacy():
    if "USDNGN" not in MODELS: raise HTTPException(503, "Model not ready")
    return signals("USDNGN")

@app.get("/api/forecast")
def forecast_legacy():
    if "USDNGN" not in MODELS: raise HTTPException(503, "Model not ready")
    return forecast("USDNGN")

@app.post("/api/retrain")
async def retrain(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_pipeline)
    return {"status": "started", "message": "Retraining all pairs. Poll /api/health to confirm."}
