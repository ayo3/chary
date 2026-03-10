# FX Risk Intelligence Platform v3

USD/NGN FX prediction dashboard for African fintechs.
**Stack:** FastAPI · Next.js 14 · Tailwind CSS · Recharts · Docker

---

## Live Data Sources

| Source | Data | Key needed |
|---|---|---|
| Alpha Vantage | USD/NGN full daily history | ✅ Free at alphavantage.co |
| ExchangeRate-API | Today's live spot rate | ✅ Free at exchangerate-api.com |
| yfinance (BZ=F) | Brent crude oil daily | ❌ No key needed |
| Local CSV/Excel | Fallback if APIs fail | — |

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Model status, data sources, last trained |
| `GET /api/predictions` | Historical test-set predictions |
| `GET /api/volatility` | 7-day volatility + threshold |
| `GET /api/feature-importance` | Model feature weights |
| `GET /api/signals` | Latest signal + model metrics |
| `GET /api/forecast` | **Forward forecast: +1, +2, +3, +5, +7 days** |
| `GET /api/forecast/{horizon}` | Single horizon (1, 2, 3, 5, or 7) |
| `POST /api/retrain` | Force retrain with fresh live data |

---

## Run Locally (Mac)

### 1. Set your API keys
```bash
cd backend
cp .env.example .env
# Edit .env and add your Alpha Vantage + ExchangeRate-API keys
```

### 2. Start backend
```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Visit: http://localhost:8000/docs

### 3. Start frontend (new terminal)
```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```
Visit: http://localhost:3000

---

## Deploy to Railway (Recommended)

1. Push repo to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Add two services: `backend` (root: `/backend`) and `frontend` (root: `/frontend`)
4. On the **backend** service, add environment variables:
   ```
   ALPHA_VANTAGE_KEY=your_key
   EXCHANGERATE_KEY=your_key
   ```
5. On the **frontend** service:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   ```
6. Both services auto-detect Dockerfiles and deploy

---

## Deploy with Docker Compose (VPS)

```bash
# Create .env in backend/
echo "ALPHA_VANTAGE_KEY=your_key" >> backend/.env
echo "EXCHANGERATE_KEY=your_key"  >> backend/.env

docker compose up -d --build
```

---

## How the Forward Forecast Works

The model doesn't just replay history. For each future horizon (1, 2, 3, 5, 7 days):

1. Takes today's actual features (live rate, live oil price, rolling stats)
2. Runs the trained Random Forest / Gradient Boosting model
3. Gets predicted % change for day 1
4. Uses that predicted rate as the input for day 2
5. Repeats iteratively up to day 7

This means each forecast genuinely uses only information available today —
making it usable for real fintech pricing decisions.

---

## Auto-Retraining Schedule

The model retrains automatically every day at **06:00 UTC** via APScheduler.
Each retrain fetches the latest live data from all three sources before fitting.
You can also force a retrain manually: `POST /api/retrain`

---

## Get Your Free API Keys

- **Alpha Vantage:** https://www.alphavantage.co/support/#api-key (instant, no credit card)
- **ExchangeRate-API:** https://app.exchangerate-api.com/sign-up (free tier: 1,500 req/month)
- **Brent oil (yfinance):** No key needed — works out of the box

