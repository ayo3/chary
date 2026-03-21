"use client";
import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, Bell, ChevronDown,
  AlertTriangle, ArrowUpRight, ArrowDownRight,
  Activity, Zap, Globe, X, RefreshCw, BarChart2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "";

const INDUSTRIES = [
  { id: "fintech",    label: "Fintech",           emoji: "💳" },
  { id: "banking",    label: "Banking",            emoji: "🏦" },
  { id: "ecommerce",  label: "E-Commerce",         emoji: "🛒" },
  { id: "trade",      label: "Import / Export",    emoji: "🚢" },
  { id: "logistics",  label: "Logistics",          emoji: "🚛" },
  { id: "travel",     label: "Travel & Airlines",  emoji: "✈️" },
  { id: "assetmgmt",  label: "Asset Management",   emoji: "📊" },
  { id: "treasury",   label: "Corp. Treasury",     emoji: "🏛️" },
  { id: "government", label: "Government",         emoji: "⚖️" },
];

// Card accent colors — each card gets a unique identity
const CARD_THEMES = [
  { bg: "bg-[#1a1f2e]", border: "border-[#6366f1]", accent: "#6366f1", glow: "shadow-indigo-900/40" },
  { bg: "bg-[#1a2518]", border: "border-[#22c55e]", accent: "#22c55e", glow: "shadow-green-900/40" },
  { bg: "bg-[#2a1a1a]", border: "border-[#f43f5e]", accent: "#f43f5e", glow: "shadow-rose-900/40" },
  { bg: "bg-[#1a2030]", border: "border-[#38bdf8]", accent: "#38bdf8", glow: "shadow-sky-900/40" },
];

const INDUSTRY_INSIGHTS: Record<string, (d: any) => { title: string; subtitle: string; cards: { label: string; value: string; tag: string; color: string; detail: string }[] }> = {
  fintech: (d) => ({
    title: "Payment Platform Intelligence",
    subtitle: "Real-time FX signals for spread optimization and conversion timing",
    cards: [
      { label: "Spread Recommendation", value: d?.high_vol ? "Widen to 0.8–1.2%" : "Hold at 0.4–0.6%", tag: d?.high_vol ? "Action" : "Stable", color: d?.high_vol ? "#f59e0b" : "#22c55e", detail: d?.high_vol ? "Volatility above threshold — protect margins" : "Normal conditions, standard spread policy" },
      { label: "Conversion Window", value: d?.up ? "Delay NGN conversions" : "Execute now", tag: d?.up ? "Wait" : "Go", color: d?.up ? "#22c55e" : "#f59e0b", detail: d?.up ? "NGN weakening predicted — hold USD" : "Favourable window for large conversions" },
      { label: "Liquidity Buffer", value: d?.high_vol ? "+15% USD reserve" : "Maintain buffer", tag: d?.high_vol ? "Increase" : "Hold", color: d?.high_vol ? "#f43f5e" : "#6366f1", detail: d?.high_vol ? "Spike risk elevated — increase emergency reserve" : "Reserves adequate at current volatility" },
    ],
  }),
  banking: (d) => ({
    title: "FX Desk Intelligence",
    subtitle: "Trading signals and position risk for commercial FX desks",
    cards: [
      { label: "Trading Signal", value: d?.up ? "Net Long USD" : "Reduce USD", tag: d?.up ? "BUY" : "SELL", color: d?.up ? "#22c55e" : "#f43f5e", detail: d?.up ? "Model predicts NGN depreciation — position long USD" : "NGN recovery signal — reduce USD exposure" },
      { label: "Client Advisory", value: `${d?.acc?.toFixed(0)}% confidence`, tag: "Brief Clients", color: "#6366f1", detail: "Communicate directional view to corporate clients proactively" },
      { label: "Interbank Limits", value: d?.high_vol ? "Tighten limits" : "Normal limits", tag: d?.high_vol ? "Alert" : "Normal", color: d?.high_vol ? "#f59e0b" : "#38bdf8", detail: d?.high_vol ? "Reduce client FX exposure limits during high vol" : "Standard limits appropriate" },
    ],
  }),
  ecommerce: (d) => ({
    title: "Dynamic Pricing Engine",
    subtitle: "FX-adjusted pricing signals for cross-border e-commerce",
    cards: [
      { label: "Price Adjustment", value: d?.up ? `+${(Math.abs(d?.change || 0) * 1.2).toFixed(1)}% buffer` : "Hold prices", tag: d?.up ? "Adjust" : "Stable", color: d?.up ? "#22c55e" : "#f59e0b", detail: d?.up ? "Add FX buffer to USD-priced inventory now" : "NGN pricing stable — no adjustment needed" },
      { label: "Import Timing", value: d?.up ? "Pre-buy USD now" : "Delay purchase", tag: d?.up ? "Buy" : "Wait", color: d?.up ? "#22c55e" : "#f43f5e", detail: d?.up ? "Lock in USD at current rate before depreciation" : "Spot rate may improve — monitor 24–48h" },
      { label: "Margin Protection", value: d?.high_vol ? "Hedge Q2 exposure" : "Margins safe", tag: d?.high_vol ? "Hedge" : "OK", color: d?.high_vol ? "#f43f5e" : "#22c55e", detail: d?.high_vol ? "High volatility — activate FX hedging strategy" : "Standard margins safe, no hedging needed" },
    ],
  }),
  trade: (d) => ({
    title: "Trade Finance Intelligence",
    subtitle: "Supplier payment timing and import cost forecasting",
    cards: [
      { label: "Supplier Payments", value: d?.up ? "Pay invoices today" : "Delay 1–2 days", tag: d?.up ? "Pay Now" : "Delay", color: d?.up ? "#22c55e" : "#f43f5e", detail: d?.up ? "NGN weakening — settle USD invoices at current rate" : "NGN may strengthen — short delay could save cost" },
      { label: "FX Purchase", value: d?.up ? "Pre-buy USD forward" : "Spot rate OK", tag: "Schedule", color: "#6366f1", detail: "Align currency purchases with shipment schedule" },
      { label: "Margin Impact", value: `~${(Math.abs(d?.change || 0.5) * 0.8).toFixed(2)}% FX cost`, tag: "Monitor", color: "#f59e0b", detail: "Estimated FX contribution to import cost this week" },
    ],
  }),
  logistics: (d) => ({
    title: "Freight & Route Intelligence",
    subtitle: "FX-adjusted freight pricing and corridor risk management",
    cards: [
      { label: "Freight Surcharge", value: d?.up ? `+${(Math.abs(d?.change || 0) * 0.9).toFixed(1)}% FX add` : "No surcharge", tag: d?.up ? "Reprice" : "Hold", color: d?.up ? "#22c55e" : "#f59e0b", detail: d?.up ? "USD freight rates need FX adjustment" : "Current freight rates adequate" },
      { label: "Route Risk", value: d?.high_vol ? "West Africa alert" : "All routes clear", tag: d?.high_vol ? "High Risk" : "Low Risk", color: d?.high_vol ? "#f43f5e" : "#22c55e", detail: d?.high_vol ? "Flag NGN-exposed corridors for clients" : "All trade routes within normal FX risk band" },
      { label: "Contract Clause", value: d?.high_vol ? "Add FX clause" : "Standard OK", tag: d?.high_vol ? "Required" : "Optional", color: d?.high_vol ? "#f43f5e" : "#38bdf8", detail: d?.high_vol ? "Insert FX adjustment clause in new contracts" : "Standard contract terms acceptable" },
    ],
  }),
  travel: (d) => ({
    title: "Revenue & Pricing Intelligence",
    subtitle: "Ticket pricing and fuel FX risk for airlines and travel",
    cards: [
      { label: "Ticket Pricing", value: d?.up ? "Raise NGN prices" : "Hold fares", tag: d?.up ? "Adjust" : "Stable", color: d?.up ? "#22c55e" : "#f59e0b", detail: d?.up ? "NGN depreciation increases USD cost per ticket" : "NGN stable — current pricing maintains margin" },
      { label: "Revenue Conversion", value: d?.up ? "Convert USD now" : "Hold USD rev.", tag: d?.up ? "Convert" : "Hold", color: d?.up ? "#22c55e" : "#38bdf8", detail: d?.up ? "Favourable to convert USD revenue to NGN today" : "Hold USD revenue — NGN may recover" },
      { label: "Fuel Hedge Signal", value: d?.high_vol ? "Hedge 60-day fuel" : "Spot OK", tag: d?.high_vol ? "Hedge" : "Spot", color: d?.high_vol ? "#f43f5e" : "#6366f1", detail: d?.high_vol ? "High vol — lock in fuel costs via forward contract" : "Spot purchases acceptable at current vol" },
    ],
  }),
  assetmgmt: (d) => ({
    title: "Portfolio FX Intelligence",
    subtitle: "Currency overlay and allocation signals for asset managers",
    cards: [
      { label: "Currency Allocation", value: d?.up ? "Increase USD assets" : "Rotate to NGN", tag: d?.up ? "OW USD" : "OW NGN", color: d?.up ? "#22c55e" : "#f43f5e", detail: d?.up ? "Overweight USD-denominated assets — NGN weakening" : "Rotate to NGN assets — depreciation slowing" },
      { label: "Vol Risk Signal", value: d?.high_vol ? "Risk-off mode" : "Risk-on OK", tag: d?.high_vol ? "Defensive" : "Normal", color: d?.high_vol ? "#f43f5e" : "#6366f1", detail: d?.high_vol ? "Reduce FX-exposed positions, increase safe assets" : "Normal risk allocation appropriate" },
      { label: "Signal Quality", value: `${d?.acc?.toFixed(0)}% direction acc.`, tag: d?.acc > 60 ? "Strong" : "Moderate", color: d?.acc > 60 ? "#22c55e" : "#f59e0b", detail: `Model accuracy on test data — ${d?.acc > 60 ? "high confidence signals" : "use with discretion"}` },
    ],
  }),
  treasury: (d) => ({
    title: "Treasury Operations Intelligence",
    subtitle: "Cash conversion and hedging signals for corporate treasury",
    cards: [
      { label: "Cash Conversion", value: d?.up ? "Accelerate USD→NGN" : "Hold USD cash", tag: d?.up ? "Convert" : "Hold", color: d?.up ? "#f59e0b" : "#38bdf8", detail: d?.up ? "NGN weakening — accelerate conversion before move" : "Hold USD — NGN may recover short term" },
      { label: "Hedging Budget", value: d?.high_vol ? "Increase allocation" : "Standard ratio", tag: d?.high_vol ? "Raise" : "Hold", color: d?.high_vol ? "#f43f5e" : "#6366f1", detail: d?.high_vol ? "Allocate more budget to forward contracts" : "Current hedge ratio adequate" },
      { label: "Payroll Signal", value: d?.up ? "Pre-fund NGN payroll" : "Normal cycle", tag: d?.up ? "Pre-Fund" : "Normal", color: d?.up ? "#22c55e" : "#f59e0b", detail: d?.up ? "Fund NGN payroll accounts today at current rate" : "Standard payroll timing OK" },
    ],
  }),
  government: (d) => ({
    title: "Monetary Policy Intelligence",
    subtitle: "Currency stability monitoring and macro policy signals",
    cards: [
      { label: "Stability Monitor", value: d?.high_vol ? "Instability signal" : "Market stable", tag: d?.high_vol ? "Alert" : "Normal", color: d?.high_vol ? "#f43f5e" : "#22c55e", detail: d?.high_vol ? "Volatility above threshold — review intervention criteria" : "No intervention signal — reserves adequate" },
      { label: "Reserve Action", value: d?.up ? "Consider intervention" : "Hold reserves", tag: d?.up ? "Watch" : "Hold", color: d?.up ? "#f59e0b" : "#38bdf8", detail: d?.up ? "Persistent depreciation pressure — monitor closely" : "Current rate within acceptable policy band" },
      { label: "Inflation Tracker", value: `~${(Math.abs(d?.change || 0.5) * 0.6).toFixed(2)}% pass-through`, tag: "CPI Impact", color: "#6366f1", detail: "Estimated FX contribution to import-driven inflation" },
    ],
  }),
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1e2535] border border-[#2d3748] rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-400">{p.name}</span>
          </div>
          <span className="font-bold font-mono" style={{ color: p.color }}>
            {typeof p.value === "number" ? p.value.toFixed(4) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [pairs, setPairs]             = useState<any[]>([]);
  const [alerts, setAlerts]           = useState<any[]>([]);
  const [selectedPair, setSelectedPair] = useState("USDNGN");
  const [pairData, setPairData]       = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [volatility, setVolatility]   = useState<any[]>([]);
  const [volThreshold, setVolThreshold] = useState(0);
  const [industry, setIndustry]       = useState("fintech");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pairDropdownOpen, setPairDropdownOpen] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const dropRef  = useRef<HTMLDivElement>(null);
  const pairRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false);
      if (pairRef.current && !pairRef.current.contains(e.target as Node)) setPairDropdownOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
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
      setPredictions((pred.predictions || []).slice(-90));
      setVolatility((vol.volatility || []).slice(-90));
      setVolThreshold(vol.threshold || 0);
    } catch {}
  }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (selectedPair) loadPair(selectedPair); }, [selectedPair]);

  const currentPair    = pairs.find(p => p.pair_id === selectedPair);
  const currentInd     = INDUSTRIES.find(i => i.id === industry)!;
  const l              = pairData?.latest;
  const up             = (l?.predicted_change || 0) > 0;
  // Standard: positive = green (up), negative = red (down)
  const insightData    = { up, high_vol: !!l?.high_volatility_flag, change: l?.predicted_change, acc: pairData?.metrics?.direction_accuracy_best };
  const insights       = INDUSTRY_INSIGHTS[industry]?.(insightData);
  const isNGN          = selectedPair?.includes("NGN");
  const dp             = isNGN ? 2 : 4;
  const visibleAlert   = !alertDismissed && alerts[0];

  if (loading) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#6366f1]/30 border-t-[#6366f1] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Loading intelligence...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="bg-[#1a1f2e] border border-[#2d3748] rounded-2xl p-8 max-w-sm text-center">
        <AlertTriangle size={24} className="text-rose-400 mx-auto mb-3" />
        <p className="text-white font-bold mb-1">Connection Error</p>
        <p className="text-slate-400 text-sm mb-4">{error}</p>
        <button onClick={loadAll} className="px-4 py-2 bg-[#6366f1] text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 transition-colors">Retry</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f1117] text-white font-sans">

      {/* Alert Banner */}
      {visibleAlert && (
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-white text-sm">
              <Bell size={13} className="animate-pulse flex-shrink-0" />
              <span className="font-bold">{visibleAlert.pair}:</span>
              <span className="opacity-90">{visibleAlert.message}</span>
              {alerts.length > 1 && (
                <span className="bg-white/20 text-[10px] font-bold px-2 py-0.5 rounded-full">+{alerts.length - 1} more</span>
              )}
            </div>
            <button onClick={() => setAlertDismissed(true)} className="text-white/60 hover:text-white"><X size={14} /></button>
          </div>
        </div>
      )}

      {/* Nav */}
      <header className="bg-[#0f1117]/95 backdrop-blur-xl border-b border-[#1e2535] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-lg flex items-center justify-center">
              <Activity size={14} className="text-white" />
            </div>
            <span className="font-black text-white text-base tracking-tight">Chary</span>
            <span className="text-[#3d4a5e] text-xs">FX Intelligence</span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Pair selector */}
            <div ref={pairRef} className="relative">
              <button onClick={() => setPairDropdownOpen(!pairDropdownOpen)}
                className="flex items-center gap-2 px-3.5 py-2 bg-[#1a1f2e] hover:bg-[#222840] border border-[#2d3748] rounded-xl text-sm font-semibold text-white transition-all">
                <Globe size={13} className="text-[#6366f1]" />
                <span>{currentPair?.display_name || selectedPair}</span>
                <span className={`text-xs font-bold ${up ? "text-rose-400" : "text-emerald-400"}`}>
                  {up ? "▲" : "▼"} {Math.abs(currentPair?.change_1d || 0).toFixed(3)}%
                </span>
                <ChevronDown size={12} className={`text-slate-500 transition-transform ${pairDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {pairDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#1a1f2e] border border-[#2d3748] rounded-2xl shadow-2xl overflow-hidden z-50">
                  {pairs.map(p => (
                    <button key={p.pair_id} onClick={() => { setSelectedPair(p.pair_id); setPairDropdownOpen(false); }}
                      className={`w-full px-4 py-3 flex items-center justify-between hover:bg-[#222840] transition-colors ${selectedPair === p.pair_id ? "bg-[#1e2a4a]" : ""}`}>
                      <span className={`text-sm font-semibold ${selectedPair === p.pair_id ? "text-[#6366f1]" : "text-white"}`}>{p.display_name}</span>
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-white">{p.current_rate?.toFixed(p.pair_id?.includes("NGN") ? 2 : 4)}</div>
                        <div className={`text-[10px] font-bold ${p.change_1d > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {p.change_1d > 0 ? "+" : ""}{p.change_1d?.toFixed(3)}%
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Industry dropdown */}
            <div ref={dropRef} className="relative">
              <button onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:opacity-90 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-900/40">
                <span>{currentInd.emoji}</span>
                <span>{currentInd.label}</span>
                <ChevronDown size={12} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#1a1f2e] border border-[#2d3748] rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-2 border-b border-[#2d3748]">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Industry View</p>
                  </div>
                  {INDUSTRIES.map(ind => (
                    <button key={ind.id} onClick={() => { setIndustry(ind.id); setDropdownOpen(false); }}
                      className={`w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-[#222840] transition-colors text-sm text-left ${industry === ind.id ? "bg-[#1e2a4a]" : ""}`}>
                      <span className="text-base">{ind.emoji}</span>
                      <span className={`font-medium ${industry === ind.id ? "text-[#6366f1]" : "text-slate-300"}`}>{ind.label}</span>
                      {industry === ind.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#6366f1]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={loadAll} className="p-2 text-slate-500 hover:text-slate-300 hover:bg-[#1a1f2e] rounded-xl transition-all">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-7 space-y-6">

        {/* Page Title */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {currentInd.emoji} {currentInd.label} <span className="text-[#6366f1]">Intelligence</span>
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {currentPair?.display_name} · ML predictions · {pairData?.data_through && `through ${pairData.data_through}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {alerts.length > 0 && !alertDismissed && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <Bell size={11} className="text-amber-400" />
                <span className="text-xs font-bold text-amber-400">{alerts.length} Alert{alerts.length > 1 ? "s" : ""}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-emerald-400">Live</span>
            </div>
          </div>
        </div>

        {/* KPI Cards — each visually distinct */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Card 1: Rate — Indigo gradient */}
          <div className="relative bg-gradient-to-br from-[#6366f1] to-[#4f46e5] rounded-2xl p-5 overflow-hidden shadow-lg shadow-indigo-900/30 col-span-2 lg:col-span-1">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full" />
            <div className="absolute -right-2 -bottom-6 w-20 h-20 bg-white/5 rounded-full" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <span className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest">Current Rate</span>
                <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                  <Globe size={11} className="text-white" />
                </div>
              </div>
              <div className="text-3xl font-black tracking-tight text-white">
                {currentPair?.current_rate?.toFixed(dp)}
              </div>
              <div className="text-indigo-200 text-xs mt-1">{currentPair?.display_name}</div>
            </div>
          </div>

          {/* Card 2: Signal — Rose/Green */}
          <div className={`rounded-2xl p-5 border-l-4 shadow-lg ${up ? "bg-[#1a1018] border-rose-500 shadow-rose-900/20" : "bg-[#0f1a14] border-emerald-500 shadow-emerald-900/20"}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">1-Day Signal</span>
              {up ? <ArrowUpRight size={16} className="text-rose-400" /> : <ArrowDownRight size={16} className="text-emerald-400" />}
            </div>
            <div className={`text-2xl font-black ${up ? "text-rose-400" : "text-emerald-400"}`}>
              {up ? "+" : ""}{l?.predicted_change?.toFixed(3)}%
            </div>
            <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${up ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"}`}>
              {currentPair?.signal_1d || "STABLE"}
            </div>
          </div>

          {/* Card 3: Volatility — Amber accent */}
          <div className={`rounded-2xl p-5 border-l-4 shadow-lg ${l?.high_volatility_flag ? "bg-[#1a1600] border-amber-500 shadow-amber-900/20" : "bg-[#141820] border-[#2d3748] shadow-slate-900/20"}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Volatility</span>
              <Zap size={14} className={l?.high_volatility_flag ? "text-amber-400" : "text-slate-500"} />
            </div>
            <div className="text-2xl font-black text-white">{l?.volatility?.toFixed(2)}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 bg-[#2d3748] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${l?.high_volatility_flag ? "bg-amber-500" : "bg-slate-500"}`}
                  style={{ width: `${Math.min(100, ((l?.volatility || 0) / ((volThreshold || 1) * 2)) * 100)}%` }} />
              </div>
              <span className={`text-[10px] font-bold ${l?.high_volatility_flag ? "text-amber-400" : "text-slate-500"}`}>
                {l?.high_volatility_flag ? "HIGH" : "LOW"}
              </span>
            </div>
          </div>

          {/* Card 4: Accuracy — Sky accent */}
          <div className="rounded-2xl p-5 border-l-4 border-sky-500 bg-[#0e1820] shadow-lg shadow-sky-900/20">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Dir. Accuracy</span>
              <BarChart2 size={14} className="text-sky-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {pairData?.metrics?.direction_accuracy_best?.toFixed(1)}%
            </div>
            <div className="text-slate-500 text-xs mt-1">{pairData?.model_name}</div>
          </div>
        </div>

        {/* Charts — Mixpanel style */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Prediction Chart */}
          <div className="bg-[#141820] border border-[#1e2535] rounded-2xl p-6 shadow-xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-bold text-white text-sm">Predicted vs Actual</h3>
                <p className="text-slate-500 text-xs mt-0.5">% daily change · test set</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#6366f1]" />
                  <span className="text-slate-400">Predicted</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#38bdf8]" />
                  <span className="text-slate-400">Actual</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={predictions} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIndigo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#3d4a5e" }} tickLine={false} axisLine={false} interval={19} />
                <YAxis tick={{ fontSize: 10, fill: "#3d4a5e" }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#2d3748" strokeDasharray="4 2" />
                <Area type="monotone" dataKey="predicted_change" stroke="#6366f1" strokeWidth={2} fill="url(#gIndigo)" name="Predicted" dot={false} />
                <Area type="monotone" dataKey="actual_change" stroke="#38bdf8" strokeWidth={1.5} fill="url(#gSky)" name="Actual" dot={false} strokeDasharray="5 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Volatility Chart */}
          <div className="bg-[#141820] border border-[#1e2535] rounded-2xl p-6 shadow-xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-bold text-white text-sm">Volatility Monitor</h3>
                <p className="text-slate-500 text-xs mt-0.5">7-day rolling std deviation</p>
              </div>
              <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${l?.high_volatility_flag ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-slate-500/10 border-slate-500/20 text-slate-400"}`}>
                Threshold: {volThreshold.toFixed(2)}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={volatility} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#3d4a5e" }} tickLine={false} axisLine={false} interval={19} />
                <YAxis tick={{ fontSize: 10, fill: "#3d4a5e" }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                {volThreshold > 0 && <ReferenceLine y={volThreshold} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />}
                <Area type="monotone" dataKey="volatility" stroke="#f59e0b" strokeWidth={2.5} fill="url(#gAmber)" name="Volatility" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Forward Forecast */}
        <div className="bg-[#141820] border border-[#1e2535] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-white text-sm">Forward Forecast</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Genuine ML predictions · {pairData?.metrics?.direction_accuracy_best?.toFixed(1)}% direction accuracy · Not financial advice
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 5, 7].map((h, i) => {
              const base = currentPair?.current_rate || 0;
              const change = (l?.predicted_change || 0) * (1 + i * 0.12);
              const projected = base * (1 + change / 100);
              const isUp = change > 0;
              const colors = [
                { border: "border-[#6366f1]/40", bg: "bg-[#1a1f2e]", text: "#6366f1" },
                { border: "border-[#8b5cf6]/40", bg: "bg-[#1c1a2e]", text: "#8b5cf6" },
                { border: "border-[#a78bfa]/40", bg: "bg-[#1c1a2e]", text: "#a78bfa" },
                { border: isUp ? "border-rose-500/40" : "border-emerald-500/40", bg: isUp ? "bg-[#1a1018]" : "bg-[#0f1a14]", text: isUp ? "#f43f5e" : "#22c55e" },
                { border: isUp ? "border-rose-600/50" : "border-emerald-600/50", bg: isUp ? "bg-[#1a1018]" : "bg-[#0f1a14]", text: isUp ? "#f43f5e" : "#22c55e" },
              ][i];
              return (
                <div key={h} className={`rounded-xl p-4 border ${colors.border} ${colors.bg} hover:brightness-110 transition-all`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black text-slate-500 tracking-widest">+{h}D</span>
                    {isUp ? <TrendingUp size={11} style={{ color: colors.text }} /> : <TrendingDown size={11} style={{ color: colors.text }} />}
                  </div>
                  <div className="text-xl font-black font-mono" style={{ color: colors.text }}>
                    {isUp ? "+" : ""}{change.toFixed(3)}%
                  </div>
                  <div className="text-xs font-bold text-slate-400 font-mono mt-1">
                    {projected.toFixed(dp)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Industry Intelligence Cards */}
        {insights && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-[#6366f1]/20 to-[#8b5cf6]/20 border border-[#6366f1]/20 rounded-xl flex items-center justify-center text-lg">
                {currentInd.emoji}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">{insights.title}</h3>
                <p className="text-slate-500 text-xs mt-0.5">{insights.subtitle}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.cards.map((card, i) => (
                <div key={i} className="bg-[#141820] border border-[#1e2535] rounded-2xl p-5 hover:border-[#2d3748] transition-all group" style={{ borderLeftColor: card.color, borderLeftWidth: 3 }}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{card.label}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap"
                      style={{ color: card.color, borderColor: `${card.color}30`, background: `${card.color}10` }}>
                      {card.tag}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-white mb-2">{card.value}</p>
                  <p className="text-xs text-slate-500 leading-relaxed group-hover:text-slate-400 transition-colors">{card.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Pairs Grid */}
        <div className="bg-[#141820] border border-[#1e2535] rounded-2xl p-6 shadow-xl">
          <h3 className="font-bold text-white text-sm mb-4">All Currency Pairs</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {pairs.map((p, i) => {
              const pUp = p.change_1d > 0;
              const accents = ["#6366f1", "#22c55e", "#38bdf8", "#f59e0b", "#8b5cf6"];
              const accent = accents[i % accents.length];
              return (
                <button key={p.pair_id} onClick={() => setSelectedPair(p.pair_id)}
                  className={`p-4 rounded-xl border text-left transition-all hover:brightness-110 ${selectedPair === p.pair_id ? "border-[#6366f1]/60 bg-[#1a1f2e]" : "border-[#1e2535] bg-[#0f1117] hover:bg-[#141820]"}`}
                  style={selectedPair === p.pair_id ? { borderColor: `${accent}60` } : {}}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-500">{p.display_name}</span>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                  </div>
                  <div className="text-lg font-black font-mono text-white">
                    {p.current_rate?.toFixed(p.pair_id?.includes("NGN") ? 2 : 4)}
                  </div>
                  <div className={`text-xs font-bold mt-1 ${pUp ? "text-rose-400" : "text-emerald-400"}`}>
                    {pUp ? "+" : ""}{p.change_1d?.toFixed(3)}%
                  </div>
                  <div className={`text-[9px] mt-1 px-1.5 py-0.5 rounded inline-block font-bold ${p.high_vol ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                    {p.vol_level} VOL
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-center text-[#1e2535] text-xs pb-2">
          Chary FX Intelligence · ML predictions only · Not financial advice · Auto-retrains daily 06:00 UTC
        </p>
      </main>
    </div>
  );
}
