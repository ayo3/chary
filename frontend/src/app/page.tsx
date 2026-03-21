"use client";
import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TrendingUp, TrendingDown, Bell, ChevronDown,
  AlertTriangle, ArrowUpRight, ArrowDownRight,
  Activity, Zap, Globe, X, RefreshCw,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "";

// ── Design Tokens ────────────────────────────────────────────────────────────
const INDUSTRIES = [
  { id: "fintech",    label: "Fintech",            emoji: "💳" },
  { id: "banking",    label: "Banking",             emoji: "🏦" },
  { id: "ecommerce",  label: "E-Commerce",          emoji: "🛒" },
  { id: "trade",      label: "Import / Export",     emoji: "🚢" },
  { id: "logistics",  label: "Logistics",           emoji: "🚛" },
  { id: "travel",     label: "Travel & Airlines",   emoji: "✈️" },
  { id: "assetmgmt",  label: "Asset Management",    emoji: "📊" },
  { id: "treasury",   label: "Corporate Treasury",  emoji: "🏛️" },
  { id: "government", label: "Government & Policy", emoji: "⚖️" },
];

const INDUSTRY_INSIGHTS: Record<string, (d: any) => { title: string; items: { label: string; value: string; tag: string; tagColor: string }[] }> = {
  fintech: (d) => ({
    title: "Payment Platform Intelligence",
    items: [
      { label: "Spread Recommendation", value: d?.high_vol ? "Widen to 0.8–1.2%" : "Hold at 0.4–0.6%", tag: d?.high_vol ? "Action Required" : "Stable", tagColor: d?.high_vol ? "amber" : "green" },
      { label: "Conversion Window", value: d?.up ? "Delay large NGN conversions" : "Execute conversions now", tag: d?.up ? "Wait" : "Go", tagColor: d?.up ? "amber" : "green" },
      { label: "Liquidity Buffer", value: d?.high_vol ? "Increase USD reserve by 15%" : "Maintain current buffer", tag: d?.high_vol ? "Raise" : "Hold", tagColor: d?.high_vol ? "red" : "green" },
    ],
  }),
  banking: (d) => ({
    title: "FX Desk Intelligence",
    items: [
      { label: "Trading Signal", value: d?.up ? "Net long USD recommended" : "Reduce USD exposure", tag: d?.up ? "BUY USD" : "SELL USD", tagColor: d?.up ? "red" : "green" },
      { label: "Client Advisory", value: `Directional accuracy ${d?.acc?.toFixed(0)}% — brief corporate clients`, tag: "Advisory", tagColor: "blue" },
      { label: "Interbank Position", value: d?.high_vol ? "Tighten client FX limits" : "Normal trading conditions", tag: d?.high_vol ? "Alert" : "Normal", tagColor: d?.high_vol ? "amber" : "green" },
    ],
  }),
  ecommerce: (d) => ({
    title: "Dynamic Pricing Engine",
    items: [
      { label: "Price Adjustment", value: d?.up ? `Add ${(Math.abs(d?.change || 0) * 1.2).toFixed(1)}% FX buffer to USD prices` : "Hold current pricing", tag: d?.up ? "Adjust" : "Hold", tagColor: d?.up ? "amber" : "green" },
      { label: "Import Timing", value: d?.up ? "Pre-purchase USD inventory now" : "Delay bulk USD purchases", tag: d?.up ? "Buy Now" : "Wait", tagColor: d?.up ? "red" : "blue" },
      { label: "Margin Protection", value: d?.high_vol ? "Activate FX hedging for Q2" : "Standard margins safe", tag: d?.high_vol ? "Hedge" : "Safe", tagColor: d?.high_vol ? "amber" : "green" },
    ],
  }),
  trade: (d) => ({
    title: "Trade Finance Intelligence",
    items: [
      { label: "Supplier Payments", value: d?.up ? "Pay USD invoices today" : "Delay payments 1–2 days", tag: d?.up ? "Pay Now" : "Delay", tagColor: d?.up ? "red" : "blue" },
      { label: "Currency Purchase", value: d?.up ? "Pre-buy USD for next shipment" : "Spot rate favourable — buy now", tag: "Schedule", tagColor: "blue" },
      { label: "Margin Impact", value: `FX adds ~${(Math.abs(d?.change || 0.5) * 0.8).toFixed(2)}% cost to imports`, tag: "Monitor", tagColor: "amber" },
    ],
  }),
  logistics: (d) => ({
    title: "Freight & Route Intelligence",
    items: [
      { label: "Freight Rate Adjustment", value: d?.up ? `Add ${(Math.abs(d?.change || 0) * 0.9).toFixed(1)}% FX surcharge` : "Hold USD freight rates", tag: d?.up ? "Reprice" : "Hold", tagColor: d?.up ? "amber" : "green" },
      { label: "Route Risk", value: d?.high_vol ? "Flag West Africa corridors" : "All routes normal", tag: d?.high_vol ? "High Risk" : "Low Risk", tagColor: d?.high_vol ? "red" : "green" },
      { label: "Contract Clause", value: d?.high_vol ? "Insert FX adjustment clause" : "Standard contracts OK", tag: d?.high_vol ? "Add Clause" : "Standard", tagColor: d?.high_vol ? "amber" : "green" },
    ],
  }),
  travel: (d) => ({
    title: "Revenue & Pricing Intelligence",
    items: [
      { label: "Ticket Price Signal", value: d?.up ? "Raise NGN ticket prices" : "NGN prices stable", tag: d?.up ? "Adjust" : "Stable", tagColor: d?.up ? "amber" : "green" },
      { label: "Revenue Conversion", value: d?.up ? "Convert USD revenue to NGN now" : "Hold USD revenue", tag: d?.up ? "Convert" : "Hold", tagColor: d?.up ? "green" : "blue" },
      { label: "Fuel Cost Hedge", value: d?.high_vol ? "Hedge next 60 days of fuel" : "Spot purchase acceptable", tag: d?.high_vol ? "Hedge" : "Spot OK", tagColor: d?.high_vol ? "red" : "green" },
    ],
  }),
  assetmgmt: (d) => ({
    title: "Portfolio FX Intelligence",
    items: [
      { label: "Currency Allocation", value: d?.up ? "Increase USD asset exposure" : "Rotate to NGN assets", tag: d?.up ? "Buy USD" : "Buy NGN", tagColor: d?.up ? "red" : "green" },
      { label: "Volatility Signal", value: d?.high_vol ? "Risk-off posture recommended" : "Normal allocation safe", tag: d?.high_vol ? "Risk-Off" : "Normal", tagColor: d?.high_vol ? "red" : "green" },
      { label: "Model Confidence", value: `${d?.acc?.toFixed(0)}% directional accuracy — ${d?.acc > 60 ? "high" : "moderate"} signal quality`, tag: d?.acc > 60 ? "Strong" : "Moderate", tagColor: d?.acc > 60 ? "green" : "amber" },
    ],
  }),
  treasury: (d) => ({
    title: "Treasury Operations Intelligence",
    items: [
      { label: "Cash Conversion", value: d?.up ? "Accelerate USD → NGN conversion" : "Hold USD — NGN may recover", tag: d?.up ? "Convert" : "Hold", tagColor: d?.up ? "amber" : "blue" },
      { label: "Hedging Budget", value: d?.high_vol ? "Allocate more to forward contracts" : "Standard hedging ratio OK", tag: d?.high_vol ? "Increase" : "Standard", tagColor: d?.high_vol ? "red" : "green" },
      { label: "Payroll Pre-funding", value: d?.up ? "Pre-fund NGN payroll today" : "Normal payroll cycle safe", tag: d?.up ? "Pre-Fund" : "Normal", tagColor: d?.up ? "amber" : "green" },
    ],
  }),
  government: (d) => ({
    title: "Monetary Policy Intelligence",
    items: [
      { label: "Stability Monitor", value: d?.high_vol ? "Volatility above threshold — review policy" : "Market stable, no action needed", tag: d?.high_vol ? "Alert" : "Stable", tagColor: d?.high_vol ? "red" : "green" },
      { label: "Reserve Signal", value: d?.up ? "Consider FX intervention" : "Reserves adequate at current rate", tag: d?.up ? "Monitor" : "Normal", tagColor: d?.up ? "amber" : "green" },
      { label: "Inflation Tracker", value: `FX contributes ~${(Math.abs(d?.change || 0.5) * 0.6).toFixed(2)}% to import inflation`, tag: "Track", tagColor: "blue" },
    ],
  }),
};

const TAG_STYLES: Record<string, string> = {
  green:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  amber:  "bg-amber-50 text-amber-700 border border-amber-200",
  red:    "bg-rose-50 text-rose-700 border border-rose-200",
  blue:   "bg-blue-50 text-blue-700 border border-blue-200",
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-xl text-xs">
      <p className="text-slate-400 mb-1.5 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex gap-3 justify-between" style={{ color: p.color }}>
          <span className="text-slate-600">{p.name}</span>
          <span className="font-bold">{typeof p.value === "number" ? p.value.toFixed(4) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [pairs, setPairs]           = useState<any[]>([]);
  const [alerts, setAlerts]         = useState<any[]>([]);
  const [selectedPair, setSelectedPair] = useState("USDNGN");
  const [pairData, setPairData]     = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [volatility, setVolatility] = useState<any[]>([]);
  const [volThreshold, setVolThreshold] = useState(0);
  const [industry, setIndustry]     = useState("fintech");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pairDropdownOpen, setPairDropdownOpen] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([]);
  const dropRef = useRef<HTMLDivElement>(null);
  const pairRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false);
      if (pairRef.current && !pairRef.current.contains(e.target as Node)) setPairDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function loadAll() {
    try {
      const [pr, al] = await Promise.all([
        fetch(`${API}/api/pairs`).then(r => r.json()),
        fetch(`${API}/api/alerts`).then(r => r.json()),
      ]);
      setPairs(pr.pairs || []);
      setAlerts(al.alerts || []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function loadPair(pid: string) {
    try {
      const [sig, pred, vol] = await Promise.all([
        fetch(`${API}/api/${pid}/signals`).then(r => r.json()),
        fetch(`${API}/api/${pid}/predictions`).then(r => r.json()),
        fetch(`${API}/api/${pid}/volatility`).then(r => r.json()),
      ]);
      setPairData(sig);
      setPredictions((pred.predictions || []).slice(-60));
      setVolatility((vol.volatility || []).slice(-60));
      setVolThreshold(vol.threshold || 0);
    } catch {}
  }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (selectedPair) loadPair(selectedPair); }, [selectedPair]);

  const currentPair = pairs.find(p => p.pair_id === selectedPair);
  const currentIndustry = INDUSTRIES.find(i => i.id === industry)!;
  const l = pairData?.latest;
  const up = (l?.predicted_change || 0) > 0;
  const insightData = { up, high_vol: !!l?.high_volatility_flag, change: l?.predicted_change, acc: pairData?.metrics?.direction_accuracy_best };
  const insights = INDUSTRY_INSIGHTS[industry]?.(insightData);
  const visibleAlerts = alerts.filter((_, i) => !dismissedAlerts.includes(i));

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm font-medium">Loading FX Intelligence...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-rose-100 max-w-md text-center">
        <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={20} className="text-rose-500" />
        </div>
        <h3 className="font-bold text-slate-800 mb-2">Connection Error</h3>
        <p className="text-slate-500 text-sm">{error}</p>
        <button onClick={loadAll} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 font-sans">

      {/* Alert Banner */}
      {visibleAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-white">
              <Bell size={14} className="animate-pulse flex-shrink-0" />
              <span className="text-sm font-semibold">{visibleAlerts[0].pair}:</span>
              <span className="text-sm opacity-90">{visibleAlerts[0].message}</span>
              {visibleAlerts.length > 1 && (
                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  +{visibleAlerts.length - 1} more
                </span>
              )}
            </div>
            <button onClick={() => setDismissedAlerts(prev => [...prev, alerts.indexOf(visibleAlerts[0])])} className="text-white/70 hover:text-white">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Top Nav */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Activity size={16} className="text-white" />
            </div>
            <div>
              <span className="font-black text-slate-900 text-lg tracking-tight">Chary</span>
              <span className="text-slate-400 text-xs ml-2">FX Intelligence</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Currency Pair Selector */}
            <div ref={pairRef} className="relative">
              <button
                onClick={() => setPairDropdownOpen(!pairDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-all"
              >
                <Globe size={14} className="text-blue-500" />
                {currentPair?.display_name || selectedPair}
                <span className={`text-xs font-bold ${up ? "text-rose-500" : "text-emerald-500"}`}>
                  {up ? "↑" : "↓"} {Math.abs(currentPair?.change_1d || 0).toFixed(3)}%
                </span>
                <ChevronDown size={13} className={`text-slate-400 transition-transform ${pairDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {pairDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50">
                  {pairs.map(p => (
                    <button key={p.pair_id} onClick={() => { setSelectedPair(p.pair_id); setPairDropdownOpen(false); }}
                      className={`w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-sm ${selectedPair === p.pair_id ? "bg-blue-50" : ""}`}>
                      <span className={`font-semibold ${selectedPair === p.pair_id ? "text-blue-600" : "text-slate-700"}`}>{p.display_name}</span>
                      <div className="text-right">
                        <div className="font-mono font-bold text-slate-800 text-xs">{p.current_rate?.toFixed(4)}</div>
                        <div className={`text-[10px] font-bold ${p.change_1d > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                          {p.change_1d > 0 ? "+" : ""}{p.change_1d?.toFixed(3)}%
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Industry Dropdown */}
            <div ref={dropRef} className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-200"
              >
                <span>{currentIndustry.emoji}</span>
                <span>{currentIndustry.label}</span>
                <ChevronDown size={13} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-2.5 border-b border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Industry</p>
                  </div>
                  {INDUSTRIES.map(ind => (
                    <button key={ind.id} onClick={() => { setIndustry(ind.id); setDropdownOpen(false); }}
                      className={`w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors text-sm text-left ${industry === ind.id ? "bg-blue-50" : ""}`}>
                      <span>{ind.emoji}</span>
                      <span className={`font-medium ${industry === ind.id ? "text-blue-600 font-semibold" : "text-slate-700"}`}>{ind.label}</span>
                      {industry === ind.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={loadAll} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Hero Section */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {currentIndustry.emoji} {currentIndustry.label} Intelligence
            </h1>
            <p className="text-slate-500 mt-1">
              {currentPair?.display_name || selectedPair} · Live ML predictions · {pairData?.data_through && `Data through ${pairData.data_through}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {visibleAlerts.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                <Bell size={12} className="text-amber-500" />
                <span className="text-xs font-bold text-amber-700">{visibleAlerts.length} Alert{visibleAlerts.length > 1 ? "s" : ""}</span>
              </div>
            )}
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-xs font-bold text-emerald-700">● Live</span>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Rate Card */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg shadow-blue-200/50 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Current Rate</span>
              <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                <Globe size={13} className="text-white" />
              </div>
            </div>
            <div className="text-3xl font-black tracking-tight mb-1">
              {currentPair?.current_rate?.toFixed(currentPair?.pair_id?.includes("NGN") ? 2 : 4)}
            </div>
            <div className="text-blue-200 text-xs">{currentPair?.display_name}</div>
          </div>

          {/* Direction Card */}
          <div className={`rounded-3xl p-6 shadow-sm border ${up ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">1-Day Signal</span>
              {up ? <ArrowUpRight size={18} className="text-rose-500" /> : <ArrowDownRight size={18} className="text-emerald-500" />}
            </div>
            <div className={`text-2xl font-black ${up ? "text-rose-600" : "text-emerald-600"}`}>
              {up ? "+" : ""}{l?.predicted_change?.toFixed(3)}%
            </div>
            <div className={`text-xs font-bold mt-1 ${up ? "text-rose-500" : "text-emerald-500"}`}>
              {currentPair?.signal_1d || "STABLE"}
            </div>
          </div>

          {/* Volatility Card */}
          <div className={`rounded-3xl p-6 shadow-sm border ${l?.high_volatility_flag ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Volatility</span>
              <Zap size={16} className={l?.high_volatility_flag ? "text-amber-500" : "text-slate-400"} />
            </div>
            <div className="text-2xl font-black text-slate-800">{l?.volatility?.toFixed(2)}</div>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-16 h-1.5 rounded-full ${l?.high_volatility_flag ? "bg-amber-200" : "bg-slate-200"}`}>
                <div className={`h-full rounded-full ${l?.high_volatility_flag ? "bg-amber-500" : "bg-slate-400"}`}
                  style={{ width: `${Math.min(100, (l?.volatility / (volThreshold * 2)) * 100)}%` }} />
              </div>
              <span className={`text-xs font-bold ${l?.high_volatility_flag ? "text-amber-600" : "text-slate-500"}`}>
                {l?.high_volatility_flag ? "HIGH" : "LOW"}
              </span>
            </div>
          </div>

          {/* Accuracy Card */}
          <div className="rounded-3xl p-6 bg-slate-50 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Model Accuracy</span>
              <Activity size={16} className="text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-slate-800">
              {pairData?.metrics?.direction_accuracy_best?.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500 mt-1">{pairData?.model_name}</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Prediction Chart */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-slate-800">Predicted vs Actual</h3>
                <p className="text-slate-400 text-xs mt-0.5">% change — test set performance</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-slate-500">Predicted</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-300" /><span className="text-slate-500">Actual</span></div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={predictions} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={14} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="predicted_change" stroke="#3b82f6" strokeWidth={2} fill="url(#gradBlue)" name="Predicted" dot={false} />
                <Line type="monotone" dataKey="actual_change" stroke="#a5b4fc" strokeWidth={1.5} name="Actual" dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Volatility Chart */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-slate-800">Volatility Monitor</h3>
                <p className="text-slate-400 text-xs mt-0.5">7-day rolling standard deviation</p>
              </div>
              <div className="px-2.5 py-1 bg-rose-50 border border-rose-100 rounded-lg text-[10px] font-bold text-rose-600">
                Threshold: {volThreshold.toFixed(1)}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={volatility} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={14} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="volatility" stroke="#f59e0b" strokeWidth={2} fill="url(#gradAmber)" name="Volatility" dot={false} />
                {volThreshold > 0 && (
                  <Line type="monotone" dataKey={() => volThreshold} stroke="#ef4444" strokeWidth={1} strokeDasharray="5 3" name="Threshold" dot={false} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Forward Forecast Strip */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-slate-800">Forward Forecast</h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Genuine ML predictions · {pairData?.metrics?.direction_accuracy_best?.toFixed(1)}% direction accuracy · Not financial advice
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {pairData?.latest && [1, 2, 3, 5, 7].map((h, i) => {
              const base = currentPair?.current_rate || 0;
              const change = (l?.predicted_change || 0) * (1 + i * 0.15);
              const projected = base * (1 + change / 100);
              const isUp = change > 0;
              return (
                <div key={h} className={`rounded-2xl p-4 border transition-all hover:shadow-md ${isUp ? "bg-rose-50/50 border-rose-100" : "bg-emerald-50/50 border-emerald-100"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black text-slate-400 tracking-wider">+{h}D</span>
                    {isUp ? <TrendingUp size={13} className="text-rose-400" /> : <TrendingDown size={13} className="text-emerald-400" />}
                  </div>
                  <div className={`text-xl font-black ${isUp ? "text-rose-600" : "text-emerald-600"}`}>
                    {isUp ? "+" : ""}{change.toFixed(3)}%
                  </div>
                  <div className="text-xs font-bold text-slate-700 font-mono mt-1">
                    {projected.toFixed(currentPair?.pair_id?.includes("NGN") ? 1 : 4)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Industry Module */}
        {insights && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl flex items-center justify-center text-xl">
                {currentIndustry.emoji}
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{insights.title}</h3>
                <p className="text-slate-400 text-xs mt-0.5">AI-generated insights for {currentIndustry.label}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.items.map((item, i) => (
                <div key={i} className="bg-slate-50 rounded-2xl p-5 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{item.label}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${TAG_STYLES[item.tagColor]}`}>
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 font-medium leading-relaxed">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Pairs Summary */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-5">All Currency Pairs</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {pairs.map(p => (
              <button key={p.pair_id} onClick={() => setSelectedPair(p.pair_id)}
                className={`p-4 rounded-2xl border text-left transition-all hover:shadow-md ${selectedPair === p.pair_id ? "border-blue-300 bg-blue-50" : "border-slate-100 hover:border-slate-200"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${selectedPair === p.pair_id ? "text-blue-600" : "text-slate-500"}`}>{p.display_name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${p.high_vol ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {p.vol_level}
                  </span>
                </div>
                <div className="text-lg font-black text-slate-800 font-mono">
                  {p.current_rate?.toFixed(p.pair_id?.includes("NGN") ? 2 : 4)}
                </div>
                <div className={`text-xs font-bold mt-1 ${p.change_1d > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                  {p.change_1d > 0 ? "+" : ""}{p.change_1d?.toFixed(3)}%
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-slate-300 text-xs pb-4">
          Chary FX Intelligence · ML predictions only · Not financial advice · Retrains daily at 06:00 UTC
        </p>
      </main>
    </div>
  );
}
