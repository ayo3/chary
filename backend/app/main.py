"""
FX Risk Intelligence Platform — Backend v4
==========================================
Multi-currency ML engine supporting:
  USD/NGN, EUR/USD, GBP/USD, USD/CNY, NGN/CNY

Each pair gets its own trained model, forecasts, and signals.
Live data via Alpha Vantage + ExchangeRate-API + yfinance (Brent oil).
Auto-retrains daily at 06:00 UTC.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, VotingRegressor
from sklearn.preprocessing import RobustScaler
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from apscheduler.schedulers.background import BackgroundScheduler
import yfinance as yf
import httpx, os, logging, asyncio
from datetime import datetime, timedelta
from typing import Optional

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("fx-intelligence")

# ── Configuration ─────────────────────────────────────────────────────────────
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_KEY", "")
EXCHANGERATE_KEY  = os.getenv("EXCHANGERATE_KEY",  "")
DATA_DIR          = os.path.join(os.path.dirname(__file__), "..", "data")
FORECAST_HORIZONS = [1, 2, 3, 5, 7]

# Currency pairs: (from_symbol, to_symbol, yfinance_ticker, display_name)
CURRENCY_PAIRS = [
    ("USD", "NGN", "USDNGN=X", "USD/NGN"),
    ("EUR", "USD", "EURUSD=X", "EUR/USD"),
    ("GBP", "USD", "GBPUSD=X", "GBP/USD"),
    ("USD", "CNY", "USDCNY=X", "USD/CNY"),
    ("NGN", "CNY", None,       "NGN/CNY"),  # derived: NGN/CNY = (1/USDNGN) * USDCNY
]
PAIR_IDS = [f"{f}{t}" for f, t, _, _ in CURRENCY_PAIRS]  # e.g. "USDNGN"

FEATURES = [
    "fx_lag1", "fx_lag2", "fx_lag3",
    "oil_lag1", "oil_change",
    "fx_rolling_mean_7", "fx_rolling_mean_14",
    "fx_volatility_7", "fx_volatility_14",
    "fx_momentum", "fx_momentum_14",
    "oil_fx_ratio", "day_of_week", "month",
]

# Global state: one entry per currency pair
MODELS: dict = {}       # pair_id -> model state
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

# ── Live Data Fetchers ────────────────────────────────────────────────────────

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
        r = await client.get(url, timeout=20)
        ts = r.json().get("Time Series FX (Daily)", {})
        if not ts:
            return None
        rows = [{"Date": pd.Timestamp(d), "rate": float(v["4. close"])} for d, v in ts.items()]
        df = pd.DataFrame(rows).sort_values("Date").reset_index(drop=True)
        log.info(f"AV {from_sym}/{to_sym}: {len(df)} rows")
        return df
    except Exception as e:
        log.error(f"AV {from_sym}/{to_sym} error: {e}")
        return None


def _fetch_yf_pair_sync(ticker: str, start: str) -> Optional[pd.DataFrame]:
    """Fetch FX pair from yfinance (sync)."""
    try:
        raw = yf.download(ticker, start=start, interval="1d", progress=False, auto_adjust=True)
        if raw.empty:
            return None
        raw = raw[["Close"]].reset_index()
        raw.columns = ["Date", "rate"]
        raw["Date"] = pd.to_datetime(raw["Date"]).dt.tz_localize(None).dt.normalize()
        raw = raw.dropna().sort_values("Date").reset_index(drop=True)
        log.info(f"yfinance {ticker}: {len(raw)} rows through {raw['Date'].max().date()}")
        return raw if len(raw) > 10 else None
    except Exception as e:
        log.error(f"yfinance {ticker} error: {e}")
        return None

async def fetch_yf_pair(ticker: str, start: str) -> Optional[pd.DataFrame]:
    """Async wrapper for yfinance fetch."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_yf_pair_sync, ticker, start)


async def fetch_er_today(client: httpx.AsyncClient, to_sym: str) -> Optional[float]:
    """Fetch today's rate from ExchangeRate-API (USD base)."""
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


def fetch_oil(start: str) -> Optional[pd.DataFrame]:
    """Fetch Brent crude (BZ=F) from yfinance."""
    try:
        raw = yf.Ticker("BZ=F").history(start=start, interval="1d")[["Close"]].reset_index()
        raw = raw.rename(columns={"Close": "OilPrice"})
        raw["Date"] = pd.to_datetime(raw["Date"]).dt.tz_localize(None).dt.normalize()
        raw = raw.sort_values("Date").reset_index(drop=True)
        log.info(f"Brent oil: {len(raw)} rows")
        return raw if len(raw) > 10 else None
    except Exception as e:
        log.error(f"Brent oil error: {e}")
        return None


def load_local_fx(pair_id: str) -> Optional[pd.DataFrame]:
    """Load local CSV fallback for USD/NGN only."""
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
    rolling   = data.copy()
    forecasts = []
    steps_done = 0
    last_date  = rolling["Date"].iloc[-1]
    last_rate  = float(rolling["rate"].iloc[-1])
    cumulative = 0.0

    for h in sorted(horizons):
        steps_to_add = h - steps_done
        for _ in range(steps_to_add):
            last = rolling.iloc[-1]
            next_date = last["Date"] + timedelta(days=1)
            while next_date.weekday() >= 5:
                next_date += timedelta(days=1)

            row = {
                "Date":               next_date,
                "rate":               float(last["rate"]),
                "OilPrice":           float(last["OilPrice"]),
                "fx_lag1":            float(last["rate"]),
                "fx_lag2":            float(last.get("fx_lag1", last["rate"])),
                "fx_lag3":            float(last.get("fx_lag2", last["rate"])),
                "oil_lag1":           float(last["OilPrice"]),
                "oil_change":         0.0,
                "fx_rolling_mean_7":  float(rolling["rate"].tail(7).mean()),
                "fx_rolling_mean_14": float(rolling["rate"].tail(14).mean()),
                "fx_volatility_7":    float(rolling["rate"].tail(7).std()),
                "fx_volatility_14":   float(rolling["rate"].tail(14).std()),
                "fx_momentum":        float(last["rate"] - rolling["rate"].iloc[-5]) if len(rolling) >= 5 else 0.0,
                "fx_momentum_14":     float(last["rate"] - rolling["rate"].iloc[-14]) if len(rolling) >= 14 else 0.0,
                "oil_fx_ratio":       float(last["OilPrice"] / last["rate"]),
                "day_of_week":        next_date.weekday(),
                "month":              next_date.month,
            }

            X_step = pd.DataFrame([row])[FEATURES]
            pred   = float(model.predict(X_step)[0])
            cumulative += pred
            row["rate"] = float(last["rate"]) * (1 + pred / 100)
            rolling = pd.concat([rolling, pd.DataFrame([row])], ignore_index=True)
            steps_done += 1

        projected_rate = last_rate * (1 + cumulative / 100)
        forecasts.append({
            "horizon":          h,
            "label":            f"+{h}d",
            "forecast_date":    rolling["Date"].iloc[-1].strftime("%Y-%m-%d"),
            "current_rate":     round(last_rate, 4),
            "predicted_rate":   round(projected_rate, 4),
            "predicted_change": round(cumulative, 4),
            "signal":           signal_label(cumulative),
        })

    return forecasts


# ── Per-Pair Training Pipeline ────────────────────────────────────────────────

def train_pair(pair_id: str, fx_df: pd.DataFrame, oil_df: pd.DataFrame, display_name: str) -> dict:
    """Train model for a single currency pair and return state dict."""
    try:
        # Merge FX + oil
        data = pd.merge(fx_df[["Date", "rate"]], oil_df[["Date", "OilPrice"]], on="Date", how="inner")
        data = data.sort_values("Date").reset_index(drop=True)

        # Fill gaps
        full_range = pd.date_range(data["Date"].min(), data["Date"].max(), freq="D")
        data = data.set_index("Date").reindex(full_range).rename_axis("Date").reset_index()
        data["OilPrice"] = data["OilPrice"].ffill()
        data["rate"]     = data["rate"].ffill()
        data = data.dropna(subset=["rate", "OilPrice"])

        # Post-float for NGN pairs, otherwise use full history (last 3 years)
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

        X = data[FEATURES]
        y = data["next_day_change_pct"]
        split = int(len(data) * 0.8)
        X_train, X_test = X.iloc[:split], X.iloc[split:]
        y_train, y_test = y.iloc[:split], y.iloc[split:]

        # Ensemble: RF + GB
        rf = RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)
        gb = GradientBoostingRegressor(n_estimators=200, random_state=42, learning_rate=0.05)
        rf.fit(X_train, y_train)
        gb.fit(X_train, y_train)

        rf_preds = rf.predict(X_test)
        gb_preds = gb.predict(X_test)

        def dir_acc(yt, yp): return float(np.mean(np.sign(yt) == np.sign(yp)) * 100)

        rf_da = dir_acc(y_test, rf_preds)
        gb_da = dir_acc(y_test, gb_preds)
        best_model = rf if rf_da >= gb_da else gb
        best_preds = rf_preds if rf_da >= gb_da else gb_preds
        best_name  = "Random Forest" if rf_da >= gb_da else "Gradient Boosting"

        # Volatility spike detection
        vol_spike_prob = float((data["high_volatility_flag"].tail(5).mean()))

        test_data = data.iloc[split:].copy()
        test_data["predicted_change"] = best_preds
        test_data["signal"]           = test_data["predicted_change"].apply(signal_label)

        forecasts = build_forward_forecast(data, best_model, FORECAST_HORIZONS)

        latest = test_data.iloc[-1]
        current_vol_level = volatility_level(float(latest["fx_volatility_7"]), vol_threshold)

        log.info(f"✅ {pair_id} ({display_name}): {best_name} | DirAcc={max(rf_da,gb_da):.1f}% | rows={len(data)}")

        return {
            "pair_id":            pair_id,
            "display_name":       display_name,
            "test_data":          test_data,
            "best_model":         best_model,
            "best_name":          best_name,
            "vol_threshold":      vol_threshold,
            "vol_spike_prob":     vol_spike_prob,
            "current_vol_level":  current_vol_level,
            "metrics": {
                "rmse":                    float(np.sqrt(mean_squared_error(y_test, best_preds))),
                "mae":                     float(mean_absolute_error(y_test, best_preds)),
                "r2":                      float(r2_score(y_test, best_preds)),
                "direction_accuracy_best": max(rf_da, gb_da),
                "direction_accuracy_rf":   rf_da,
                "direction_accuracy_gb":   gb_da,
            },
            "feature_importance":  dict(zip(FEATURES, best_model.feature_importances_)),
            "forecasts":           forecasts,
            "data_through":        data["Date"].max().strftime("%Y-%m-%d"),
            "current_rate":        float(latest["rate"]),
            "latest_signal":       latest["signal"],
            "latest_vol":          float(latest["fx_volatility_7"]),
            "latest_high_vol":     int(latest["high_volatility_flag"]),
        }
    except Exception as e:
        log.error(f"Training failed for {pair_id}: {e}")
        return {}


# ── Alert Detection ───────────────────────────────────────────────────────────

def detect_alerts(pair_states: dict) -> list:
    """Scan all pairs for alert conditions."""
    alerts = []
    for pair_id, state in pair_states.items():
        if not state:
            continue
        forecasts = state.get("forecasts", [])
        f1 = next((f for f in forecasts if f["horizon"] == 1), None)

        # Alert 1: High volatility
        if state.get("latest_high_vol"):
            alerts.append({
                "type":     "VOLATILITY",
                "severity": "HIGH",
                "pair":     state["display_name"],
                "message":  f"{state['display_name']} volatility above 75th percentile threshold",
                "value":    round(state["latest_vol"], 2),
            })

        # Alert 2: Large predicted move
        if f1 and abs(f1["predicted_change"]) > 0.8:
            alerts.append({
                "type":     "MOVE",
                "severity": "HIGH" if abs(f1["predicted_change"]) > 1.5 else "MEDIUM",
                "pair":     state["display_name"],
                "message":  f"{state['display_name']} model signals {f1['signal']} of {abs(f1['predicted_change']):.3f}%",
                "value":    f1["predicted_change"],
            })

        # Alert 3: Volatility spike probability
        if state.get("vol_spike_prob", 0) > 0.6:
            alerts.append({
                "type":     "SPIKE_RISK",
                "severity": "MEDIUM",
                "pair":     state["display_name"],
                "message":  f"{state['display_name']} elevated volatility spike probability: {state['vol_spike_prob']*100:.0f}%",
                "value":    round(state["vol_spike_prob"], 2),
            })

    return sorted(alerts, key=lambda x: {"HIGH": 0, "MEDIUM": 1, "LOW": 2}[x["severity"]])


# ── Main Pipeline ─────────────────────────────────────────────────────────────

async def pipeline():
    global MODELS, OIL_DATA, LAST_TRAINED
    log.info("🔄 Starting multi-currency pipeline...")

    # 1. Fetch oil data (shared across all pairs)
    start_date = (datetime.now() - timedelta(days=365*5)).strftime("%Y-%m-%d")
    oil = fetch_oil(start_date)
    if oil is None or len(oil) < 10:
        oil = load_local_oil()
        log.info("Using local oil data")
    OIL_DATA = oil

    if oil is None:
        log.error("No oil data available — aborting")
        return

    # 2. Fetch FX data for all pairs concurrently
    async with httpx.AsyncClient() as client:
        # Fetch ExchangeRate today's rates (USD base)
        er_rates = {}
        if EXCHANGERATE_KEY:
            for sym in ["NGN", "CNY"]:
                rate = await fetch_er_today(client, sym)
                if rate:
                    er_rates[sym] = rate
                    log.info(f"ExchangeRate-API USD/{sym} = {rate:.4f}")

        # Fetch each pair
        pair_fx = {}
        tasks = []
        for from_sym, to_sym, yf_ticker, display in CURRENCY_PAIRS:
            pair_id = f"{from_sym}{to_sym}"
            if pair_id == "NGNCNY":
                continue  # derived later
            tasks.append((pair_id, from_sym, to_sym, yf_ticker, display))

        for pair_id, from_sym, to_sym, yf_ticker, display in tasks:
            df = None

            # 1. Try yfinance FIRST — free, real-time, no rate limits
            if yf_ticker:
                df = await fetch_yf_pair(yf_ticker, start_date)
                if df is not None and len(df) > 100:
                    log.info(f"{pair_id}: using yfinance ({len(df)} rows, through {df['Date'].max().date()})")

            # 2. Try Alpha Vantage as fallback
            if df is None or len(df) < 100:
                av_df = await fetch_av_pair(client, from_sym, to_sym)
                if av_df is not None and len(av_df) > len(df or []):
                    df = av_df
                    log.info(f"{pair_id}: using Alpha Vantage ({len(df)} rows)")

            # 3. Local CSV fallback for USDNGN only
            if df is None or len(df) < 30:
                local = load_local_fx(pair_id)
                if local is not None:
                    df = local
                    log.info(f"{pair_id}: using local CSV fallback")

            # Patch today's rate from ExchangeRate-API
            if pair_id == "USDNGN" and "NGN" in er_rates and df is not None:
                today = pd.Timestamp.today().normalize()
                if today not in df["Date"].values:
                    patch = pd.DataFrame([{"Date": today, "rate": er_rates["NGN"]}])
                    df = pd.concat([df, patch], ignore_index=True).sort_values("Date").reset_index(drop=True)
                    log.info(f"USDNGN patched with today's rate: {er_rates['NGN']:.2f}")
            elif pair_id == "USDCNY" and "CNY" in er_rates and df is not None:
                today = pd.Timestamp.today().normalize()
                if today not in df["Date"].values:
                    patch = pd.DataFrame([{"Date": today, "rate": er_rates["CNY"]}])
                    df = pd.concat([df, patch], ignore_index=True).sort_values("Date").reset_index(drop=True)

            if df is not None and len(df) > 30:
                log.info(f"{pair_id}: final dataset {len(df)} rows, through {df['Date'].max().date()}")
                pair_fx[pair_id] = df
            else:
                log.warning(f"No data for {pair_id} — skipping")

        # Derive NGN/CNY = USDCNY / USDNGN
        if "USDNGN" in pair_fx and "USDCNY" in pair_fx:
            ngn = pair_fx["USDNGN"].rename(columns={"rate": "USDNGN"})
            cny = pair_fx["USDCNY"].rename(columns={"rate": "USDCNY"})
            derived = pd.merge(ngn, cny, on="Date", how="inner")
            derived["rate"] = derived["USDCNY"] / derived["USDNGN"]
            pair_fx["NGNCNY"] = derived[["Date", "rate"]]
            log.info(f"Derived NGN/CNY: {len(pair_fx['NGNCNY'])} rows")

    # 3. Train a model for each pair
    new_models = {}
    for from_sym, to_sym, _, display in CURRENCY_PAIRS:
        pair_id = f"{from_sym}{to_sym}"
        if pair_id not in pair_fx:
            log.warning(f"Skipping {pair_id} — no data")
            continue
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


app = FastAPI(title="FX Risk Intelligence API", version="4.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


# ── Route Helpers ─────────────────────────────────────────────────────────────
def _require_models():
    if not MODELS:
        raise HTTPException(status_code=503, detail="Models not yet trained")

def _require_pair(pair_id: str):
    _require_models()
    pid = pair_id.upper()
    if pid not in MODELS:
        raise HTTPException(status_code=404, detail=f"Pair {pid} not found. Available: {list(MODELS.keys())}")
    return MODELS[pid]

def _row(row, pair_id: str):
    return {
        "pair_id":              pair_id,
        "date":                 row["Date"].strftime("%d %b"),
        "date_full":            row["Date"].strftime("%Y-%m-%d"),
        "rate":                 _safe(row["rate"]),
        "actual_change":        _safe(row["next_day_change_pct"]),
        "predicted_change":     _safe(row["predicted_change"]),
        "signal":               row["signal"],
        "volatility":           _safe(row["fx_volatility_7"]),
        "high_volatility_flag": int(row["high_volatility_flag"]),
        "oil_price":            _safe(row["OilPrice"]),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"service": "FX Risk Intelligence API", "version": "4.0.0", "pairs": PAIR_IDS}


@app.get("/api/health")
def health():
    return {
        "status":       "ok",
        "trained_at":   LAST_TRAINED,
        "pairs_trained": list(MODELS.keys()),
        "pairs_summary": {
            pid: {
                "model":          s.get("best_name"),
                "direction_acc":  s.get("metrics", {}).get("direction_accuracy_best"),
                "data_through":   s.get("data_through"),
                "current_rate":   s.get("current_rate"),
                "vol_level":      s.get("current_vol_level"),
            }
            for pid, s in MODELS.items()
        },
    }


@app.get("/api/pairs")
def list_pairs():
    """List all available currency pairs with current rates and signals."""
    _require_models()
    return {
        "pairs": [
            {
                "pair_id":       pid,
                "display_name":  s["display_name"],
                "current_rate":  s["current_rate"],
                "signal_1d":     s["forecasts"][0]["signal"] if s["forecasts"] else None,
                "change_1d":     s["forecasts"][0]["predicted_change"] if s["forecasts"] else None,
                "vol_level":     s["current_vol_level"],
                "high_vol":      bool(s["latest_high_vol"]),
                "dir_accuracy":  s["metrics"]["direction_accuracy_best"],
                "data_through":  s["data_through"],
            }
            for pid, s in MODELS.items()
        ]
    }


@app.get("/api/alerts")
def alerts():
    """Active alerts across all currency pairs."""
    _require_models()
    return {
        "alerts":       detect_alerts(MODELS),
        "generated_at": LAST_TRAINED,
        "total_pairs":  len(MODELS),
    }


@app.get("/api/{pair_id}/predictions")
def predictions(pair_id: str):
    state = _require_pair(pair_id)
    td = state["test_data"]
    return {"pair_id": pair_id.upper(), "predictions": [_row(r, pair_id.upper()) for _, r in td.iterrows()]}


@app.get("/api/{pair_id}/volatility")
def volatility(pair_id: str):
    state = _require_pair(pair_id)
    td = state["test_data"]
    return {
        "pair_id":   pair_id.upper(),
        "volatility": [
            {"date": r["Date"].strftime("%d %b"), "volatility": _safe(r["fx_volatility_7"]), "high_flag": int(r["high_volatility_flag"])}
            for _, r in td.iterrows()
        ],
        "threshold":  state["vol_threshold"],
        "vol_level":  state["current_vol_level"],
    }


@app.get("/api/{pair_id}/feature-importance")
def feature_importance(pair_id: str):
    state = _require_pair(pair_id)
    fi = state["feature_importance"]
    return {
        "pair_id": pair_id.upper(),
        "feature_importance": sorted(
            [{"feature": k, "importance": round(float(v), 4)} for k, v in fi.items()],
            key=lambda x: x["importance"], reverse=True,
        )
    }


@app.get("/api/{pair_id}/signals")
def signals(pair_id: str):
    state = _require_pair(pair_id)
    td    = state["test_data"]
    return {
        "pair_id":             pair_id.upper(),
        "display_name":        state["display_name"],
        "latest":              _row(td.iloc[-1], pair_id.upper()),
        "signal_distribution": td["signal"].value_counts().to_dict(),
        "metrics":             state["metrics"],
        "model_name":          state["best_name"],
        "vol_threshold":       state["vol_threshold"],
        "vol_level":           state["current_vol_level"],
        "vol_spike_prob":      state["vol_spike_prob"],
    }


@app.get("/api/{pair_id}/forecast")
def forecast(pair_id: str):
    state = _require_pair(pair_id)
    return {
        "pair_id":            pair_id.upper(),
        "display_name":       state["display_name"],
        "generated_at":       LAST_TRAINED,
        "data_through":       state["data_through"],
        "current_rate":       state["current_rate"],
        "model":              state["best_name"],
        "direction_accuracy": state["metrics"]["direction_accuracy_best"],
        "forecasts":          state["forecasts"],
        "disclaimer":         "ML predictions only. Not financial advice.",
    }


@app.get("/api/{pair_id}/forecast/{horizon}")
def forecast_single(pair_id: str, horizon: int):
    state = _require_pair(pair_id)
    if horizon not in FORECAST_HORIZONS:
        raise HTTPException(status_code=400, detail=f"Horizon must be one of {FORECAST_HORIZONS}")
    match = next((f for f in state["forecasts"] if f["horizon"] == horizon), None)
    if not match:
        raise HTTPException(status_code=404, detail="Forecast not found")
    return {**match, "pair_id": pair_id.upper(), "generated_at": LAST_TRAINED}


# Legacy endpoints for backward compatibility (default to USDNGN)
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
    return {"status": "started", "message": "Retraining all pairs with live data. Poll /api/health to confirm."}
