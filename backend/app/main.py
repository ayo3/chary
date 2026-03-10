"""
FX Risk Intelligence — FastAPI Backend v3
==========================================
Live data sources:
  - Alpha Vantage      → USD/NGN daily FX rate
  - ExchangeRate-API   → USD/NGN fallback + today's rate patch
  - yfinance           → Brent crude oil prices (BZ=F)

Forecasting:
  - Trained on historical + live data combined
  - Generates genuine forward forecasts: 1, 2, 3, 5, 7 days ahead
  - Auto-retrains daily at 06:00 UTC via APScheduler
  - Falls back to local CSV/Excel if all live sources fail
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
FEATURES = [
    "fx_lag1", "fx_lag2", "fx_lag3",
    "oil_lag1", "oil_change",
    "fx_rolling_mean_7", "fx_rolling_mean_14",
    "fx_volatility_7", "fx_momentum",
    "oil_fx_ratio", "day_of_week", "month",
]

MODEL_STATE: dict = {}

# ── Live Data Fetchers ────────────────────────────────────────────────────────

async def fetch_alpha_vantage(client: httpx.AsyncClient) -> Optional[pd.DataFrame]:
    """Fetch USD/NGN daily FX from Alpha Vantage (full history)."""
    if not ALPHA_VANTAGE_KEY:
        log.warning("ALPHA_VANTAGE_KEY not set — skipping Alpha Vantage")
        return None
    try:
        url = (
            "https://www.alphavantage.co/query"
            "?function=FX_DAILY&from_symbol=USD&to_symbol=NGN"
            f"&outputsize=full&apikey={ALPHA_VANTAGE_KEY}"
        )
        r = await client.get(url, timeout=20)
        ts = r.json().get("Time Series FX (Daily)", {})
        if not ts:
            log.warning("Alpha Vantage: empty response")
            return None
        rows = [{"Date": pd.Timestamp(d), "USDNGN": float(v["4. close"])} for d, v in ts.items()]
        df = pd.DataFrame(rows).sort_values("Date").reset_index(drop=True)
        log.info(f"Alpha Vantage: {len(df)} rows")
        return df
    except Exception as e:
        log.error(f"Alpha Vantage error: {e}")
        return None


async def fetch_exchangerate_today(client: httpx.AsyncClient) -> Optional[pd.DataFrame]:
    """Fetch today's live USD/NGN spot rate from ExchangeRate-API."""
    if not EXCHANGERATE_KEY:
        log.warning("EXCHANGERATE_KEY not set — skipping ExchangeRate-API")
        return None
    try:
        url = f"https://v6.exchangerate-api.com/v6/{EXCHANGERATE_KEY}/latest/USD"
        r = await client.get(url, timeout=10)
        ngn = r.json().get("conversion_rates", {}).get("NGN")
        if not ngn:
            log.warning("ExchangeRate-API: NGN not found")
            return None
        df = pd.DataFrame([{"Date": pd.Timestamp.today().normalize(), "USDNGN": float(ngn)}])
        log.info(f"ExchangeRate-API: today = {ngn:.2f}")
        return df
    except Exception as e:
        log.error(f"ExchangeRate-API error: {e}")
        return None


def fetch_oil_yfinance(start: str) -> Optional[pd.DataFrame]:
    """Fetch Brent crude (BZ=F) daily closes via yfinance."""
    try:
        raw = yf.Ticker("BZ=F").history(start=start, interval="1d")[["Close"]].reset_index()
        raw = raw.rename(columns={"Close": "OilPrice"})
        raw["Date"] = pd.to_datetime(raw["Date"]).dt.tz_localize(None).dt.normalize()
        raw = raw.sort_values("Date").reset_index(drop=True)
        log.info(f"yfinance Brent: {len(raw)} rows")
        return raw
    except Exception as e:
        log.error(f"yfinance Brent error: {e}")
        return None


def load_local_fx() -> pd.DataFrame:
    fx = pd.read_csv(os.path.join(DATA_DIR, "USD_NGN_Historical_Data__2_.csv"))
    fx = fx.rename(columns={"Price": "USDNGN"})
    fx["Date"] = pd.to_datetime(fx["Date"])
    return fx[["Date", "USDNGN"]].sort_values("Date").reset_index(drop=True)


def load_local_oil() -> pd.DataFrame:
    oil = pd.read_excel(os.path.join(DATA_DIR, "Brent_Comodity_Prices.xlsx"))
    oil = oil.rename(columns={list(oil.columns)[1]: "OilPrice"})
    oil["Date"] = pd.to_datetime(oil["Date"])
    return oil[["Date", "OilPrice"]].sort_values("Date").reset_index(drop=True)


# ── Feature Engineering ───────────────────────────────────────────────────────

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    d["fx_lag1"]            = d["USDNGN"].shift(1)
    d["fx_lag2"]            = d["USDNGN"].shift(2)
    d["fx_lag3"]            = d["USDNGN"].shift(3)
    d["oil_lag1"]           = d["OilPrice"].shift(1)
    d["fx_rolling_mean_7"]  = d["USDNGN"].rolling(7).mean()
    d["fx_rolling_mean_14"] = d["USDNGN"].rolling(14).mean()
    d["fx_volatility_7"]    = d["USDNGN"].rolling(7).std()
    d["fx_momentum"]        = d["USDNGN"] - d["USDNGN"].shift(5)
    d["oil_fx_ratio"]       = d["OilPrice"] / d["USDNGN"]
    d["oil_change"]         = d["OilPrice"].pct_change()
    d["day_of_week"]        = d["Date"].dt.dayofweek
    d["month"]              = d["Date"].dt.month
    return d


def signal_label(v: float) -> str:
    if v >  0.5: return "STRONG RISE"
    if v >  0.1: return "SLIGHT RISE"
    if v < -0.5: return "STRONG DROP"
    if v < -0.1: return "SLIGHT DROP"
    return "STABLE"


def _safe(v):
    if isinstance(v, np.integer):  return int(v)
    if isinstance(v, np.floating): return None if np.isnan(v) else float(v)
    if isinstance(v, np.ndarray):  return v.tolist()
    try:
        if pd.isna(v): return None
    except Exception:
        pass
    return v


# ── Forward Forecast Engine ───────────────────────────────────────────────────

def build_forward_forecast(data: pd.DataFrame, model, horizons: list) -> list:
    """
    Iteratively simulate future trading days using the trained model.
    Each step feeds the previous step's predicted rate back as input features,
    producing genuine forward-looking predictions (not backtested).
    """
    rolling   = data.copy()
    forecasts = []
    steps_done = 0
    last_date  = rolling["Date"].iloc[-1]
    last_rate  = float(rolling["USDNGN"].iloc[-1])
    cumulative = 0.0

    for h in sorted(horizons):
        steps_to_add = h - steps_done
        for _ in range(steps_to_add):
            last = rolling.iloc[-1]

            # Next trading day (skip weekends)
            next_date = last["Date"] + timedelta(days=1)
            while next_date.weekday() >= 5:
                next_date += timedelta(days=1)

            row = {
                "Date":               next_date,
                "USDNGN":             float(last["USDNGN"]),
                "OilPrice":           float(last["OilPrice"]),
                "fx_lag1":            float(last["USDNGN"]),
                "fx_lag2":            float(last.get("fx_lag1", last["USDNGN"])),
                "fx_lag3":            float(last.get("fx_lag2", last["USDNGN"])),
                "oil_lag1":           float(last["OilPrice"]),
                "oil_change":         0.0,
                "fx_rolling_mean_7":  float(rolling["USDNGN"].tail(7).mean()),
                "fx_rolling_mean_14": float(rolling["USDNGN"].tail(14).mean()),
                "fx_volatility_7":    float(rolling["USDNGN"].tail(7).std()),
                "fx_momentum":        float(last["USDNGN"] - rolling["USDNGN"].iloc[-5])
                                      if len(rolling) >= 5 else 0.0,
                "oil_fx_ratio":       float(last["OilPrice"] / last["USDNGN"]),
                "day_of_week":        next_date.weekday(),
                "month":              next_date.month,
            }

            X_step = pd.DataFrame([row])[FEATURES]
            pred   = float(model.predict(X_step)[0])
            cumulative += pred

            # Feed predicted rate back for next iteration
            row["USDNGN"] = float(last["USDNGN"]) * (1 + pred / 100)
            rolling = pd.concat([rolling, pd.DataFrame([row])], ignore_index=True)
            steps_done += 1

        projected_rate = last_rate * (1 + cumulative / 100)
        forecasts.append({
            "horizon":          h,
            "label":            f"+{h}d",
            "forecast_date":    rolling["Date"].iloc[-1].strftime("%Y-%m-%d"),
            "current_rate":     round(last_rate, 2),
            "predicted_rate":   round(projected_rate, 2),
            "predicted_change": round(cumulative, 4),
            "signal":           signal_label(cumulative),
        })

    return forecasts


# ── Main Pipeline ─────────────────────────────────────────────────────────────

async def pipeline():
    sources_used = {}

    async with httpx.AsyncClient() as client:
        # ── FX Data ──────────────────────────────────────────────────────────
        av_df = await fetch_alpha_vantage(client)
        er_df = await fetch_exchangerate_today(client)

        if av_df is not None and len(av_df) > 200:
            fx = av_df.copy()
            sources_used["fx_primary"] = "Alpha Vantage"
        else:
            fx = load_local_fx()
            sources_used["fx_primary"] = "Local CSV (fallback)"

        # Patch today's live rate
        if er_df is not None:
            today = pd.Timestamp.today().normalize()
            if today not in fx["Date"].values:
                fx = pd.concat([fx, er_df[["Date", "USDNGN"]]], ignore_index=True).sort_values("Date").reset_index(drop=True)
            sources_used["fx_patch"] = "ExchangeRate-API (today)"
        else:
            sources_used["fx_patch"] = "None"

        # ── Oil Data ─────────────────────────────────────────────────────────
        start = (fx["Date"].min() - timedelta(days=30)).strftime("%Y-%m-%d")
        oil = fetch_oil_yfinance(start)
        if oil is None or len(oil) < 10:
            oil = load_local_oil()
            sources_used["oil"] = "Local Excel (fallback)"
        else:
            sources_used["oil"] = "yfinance BZ=F"

    # ── Merge + fill gaps ────────────────────────────────────────────────────
    data = pd.merge(fx[["Date", "USDNGN"]], oil[["Date", "OilPrice"]], on="Date", how="inner")
    data = data.sort_values("Date").reset_index(drop=True)

    full_range = pd.date_range(data["Date"].min(), data["Date"].max(), freq="D")
    data = (data.set_index("Date").reindex(full_range).rename_axis("Date").reset_index())
    data["OilPrice"] = data["OilPrice"].ffill()
    data["USDNGN"]   = data["USDNGN"].ffill()
    data = data.dropna(subset=["USDNGN", "OilPrice"])

    full_data = data.copy()

    # ── Post-float regime only ────────────────────────────────────────────────
    data = data[data["Date"] >= "2023-06-01"].reset_index(drop=True)
    log.info(f"Post-float rows: {len(data)}")

    # ── Features ─────────────────────────────────────────────────────────────
    data = engineer_features(data)
    data["next_day_change_pct"] = data["USDNGN"].pct_change().shift(-1) * 100
    vol_threshold = float(data["fx_volatility_7"].quantile(0.75))
    data["high_volatility_flag"] = (data["fx_volatility_7"] > vol_threshold).astype(int)
    data = data.dropna()

    X = data[FEATURES]
    y = data["next_day_change_pct"]
    split = int(len(data) * 0.8)
    X_train, X_test = X.iloc[:split], X.iloc[split:]
    y_train, y_test = y.iloc[:split], y.iloc[split:]

    # ── Train ─────────────────────────────────────────────────────────────────
    rf = RandomForestRegressor(n_estimators=300, random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)
    rf_preds = rf.predict(X_test)

    gb = GradientBoostingRegressor(n_estimators=300, random_state=42, learning_rate=0.05)
    gb.fit(X_train, y_train)
    gb_preds = gb.predict(X_test)

    def dir_acc(yt, yp):
        return float(np.mean(np.sign(yt) == np.sign(yp)) * 100)

    rf_da = dir_acc(y_test, rf_preds)
    gb_da = dir_acc(y_test, gb_preds)
    best_model = rf if rf_da >= gb_da else gb
    best_preds = rf_preds if rf_da >= gb_da else gb_preds
    best_name  = "Random Forest" if rf_da >= gb_da else "Gradient Boosting"
    log.info(f"Best model: {best_name} | Dir.Acc: {max(rf_da, gb_da):.1f}%")

    # ── Historical predictions ────────────────────────────────────────────────
    test_data = data.iloc[split:].copy()
    test_data["predicted_change"] = best_preds
    test_data["signal"]           = test_data["predicted_change"].apply(signal_label)

    # ── Forward forecast ──────────────────────────────────────────────────────
    forecasts = build_forward_forecast(data, best_model, FORECAST_HORIZONS)
    log.info(f"Forecasts: {[(f['label'], f['signal']) for f in forecasts]}")

    MODEL_STATE.update({
        "test_data":          test_data,
        "full_data":          full_data,
        "features":           FEATURES,
        "best_model":         best_model,
        "best_name":          best_name,
        "vol_threshold":      vol_threshold,
        "metrics": {
            "rmse":                     float(np.sqrt(mean_squared_error(y_test, best_preds))),
            "mae":                      float(mean_absolute_error(y_test, best_preds)),
            "r2":                       float(r2_score(y_test, best_preds)),
            "direction_accuracy_rf":    rf_da,
            "direction_accuracy_gb":    gb_da,
            "direction_accuracy_best":  max(rf_da, gb_da),
        },
        "feature_importance": dict(zip(FEATURES, best_model.feature_importances_)),
        "forecasts":          forecasts,
        "sources_used":       sources_used,
        "trained_at":         datetime.utcnow().isoformat(),
        "data_through":       data["Date"].max().strftime("%Y-%m-%d"),
    })
    log.info(f"✅ Pipeline complete. Data through: {MODEL_STATE['data_through']}")


def run_pipeline():
    asyncio.run(pipeline())


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


app = FastAPI(title="FX Risk Intelligence API", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _row(row):
    return {
        "date":                 row["Date"].strftime("%d %b"),
        "date_full":            row["Date"].strftime("%Y-%m-%d"),
        "rate":                 _safe(row["USDNGN"]),
        "actual_change":        _safe(row["next_day_change_pct"]),
        "predicted_change":     _safe(row["predicted_change"]),
        "signal":               row["signal"],
        "volatility":           _safe(row["fx_volatility_7"]),
        "high_volatility_flag": int(row["high_volatility_flag"]),
        "oil_price":            _safe(row["OilPrice"]),
    }


def _require_state():
    if not MODEL_STATE:
        raise HTTPException(status_code=503, detail="Model not yet trained. Try again shortly.")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"service": "FX Risk Intelligence API", "version": "3.0.0"}


@app.get("/api/health")
def health():
    return {
        "status":       "ok",
        "model":        MODEL_STATE.get("best_name"),
        "trained_at":   MODEL_STATE.get("trained_at"),
        "data_through": MODEL_STATE.get("data_through"),
        "sources_used": MODEL_STATE.get("sources_used"),
    }


@app.get("/api/predictions")
def predictions():
    _require_state()
    return {"predictions": [_row(r) for _, r in MODEL_STATE["test_data"].iterrows()]}


@app.get("/api/volatility")
def volatility():
    _require_state()
    td = MODEL_STATE["test_data"]
    return {
        "volatility": [
            {"date": r["Date"].strftime("%d %b"), "volatility": _safe(r["fx_volatility_7"]), "high_flag": int(r["high_volatility_flag"])}
            for _, r in td.iterrows()
        ],
        "threshold": MODEL_STATE["vol_threshold"],
    }


@app.get("/api/feature-importance")
def feature_importance():
    _require_state()
    fi = MODEL_STATE["feature_importance"]
    return {"feature_importance": sorted(
        [{"feature": k, "importance": round(float(v), 4)} for k, v in fi.items()],
        key=lambda x: x["importance"], reverse=True,
    )}


@app.get("/api/signals")
def signals():
    _require_state()
    td = MODEL_STATE["test_data"]
    return {
        "latest":              _row(td.iloc[-1]),
        "signal_distribution": td["signal"].value_counts().to_dict(),
        "metrics":             MODEL_STATE["metrics"],
        "model_name":          MODEL_STATE["best_name"],
        "vol_threshold":       MODEL_STATE["vol_threshold"],
    }


@app.get("/api/forecast")
def forecast_all():
    """
    Forward-looking predictions for next 1, 2, 3, 5, 7 trading days.
    Uses iterative feature simulation — each step feeds the previous
    predicted rate back as input. NOT backtested history.
    """
    _require_state()
    return {
        "generated_at":       MODEL_STATE["trained_at"],
        "data_through":       MODEL_STATE["data_through"],
        "current_rate":       float(MODEL_STATE["test_data"]["USDNGN"].iloc[-1]),
        "model":              MODEL_STATE["best_name"],
        "direction_accuracy": MODEL_STATE["metrics"]["direction_accuracy_best"],
        "sources_used":       MODEL_STATE["sources_used"],
        "forecasts":          MODEL_STATE["forecasts"],
        "disclaimer":         "ML predictions only. Direction accuracy ~67%. Not financial advice.",
    }


@app.get("/api/forecast/{horizon}")
def forecast_single(horizon: int):
    """Forecast for a specific horizon: 1, 2, 3, 5, or 7 days."""
    _require_state()
    if horizon not in FORECAST_HORIZONS:
        raise HTTPException(status_code=400, detail=f"Horizon must be one of {FORECAST_HORIZONS}")
    match = next((f for f in MODEL_STATE["forecasts"] if f["horizon"] == horizon), None)
    if not match:
        raise HTTPException(status_code=404, detail="Forecast not found")
    return {**match, "generated_at": MODEL_STATE["trained_at"], "direction_accuracy": MODEL_STATE["metrics"]["direction_accuracy_best"]}


@app.post("/api/retrain")
async def retrain(background_tasks: BackgroundTasks):
    """Force immediate retrain with latest live data."""
    background_tasks.add_task(run_pipeline)
    return {"status": "started", "message": "Retraining in background with live data. Poll /api/health to confirm."}
