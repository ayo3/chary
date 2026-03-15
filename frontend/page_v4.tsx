"use client";
import { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import { ErrorBox } from "@/components/ui";
import { PredictionChart, VolatilityChart, FeatureChart } from "@/components/charts";
import { ArrowUpRight, ArrowDownRight, Database, Zap, TrendingUp, Activity, AlertTriangle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "";

function SignalPill({ signal }: { signal: string }) {
  const colors: Record<string, string> = {
    "STRONG RISE": "bg-red-500/20 text-red-400 border-red-500/30",
    "SLIGHT RISE":  "bg-orange-500/20 text-orange-400 border-orange-500/30",
    "STABLE":       "bg-sky-500/20 text-sky-400 border-sky-500/30",
    "SLIGHT DROP":  "bg-teal-500/20 text-teal-400 border-teal-500/30",
    "STRONG DROP":  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${colors[signal] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
      {signal}
    </span>
  );
}

function KpiCard({ label, value, sub, accent = "#3b82f6" }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
      <div className="text-[10px] font-bold tracking-widest text-[#4a6fa5] uppercase mb-2">{label}</div>
      <div className="text-xl font-black text-white font-mono" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-[10px] text-[#4a6fa5] mt-1">{sub}</div>}
    </div>
  );
}

function PairCard({ pair, onClick, active }: { pair: any; onClick: () => void; active: boolean }) {
  const up = pair.change_1d > 0;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all ${active ? "border-[#3b82f6] bg-[#0f1f35]" : "border-[#1a2744] bg-[#0d1525] hover:border-[#2a4a8a]"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black text-white">{pair.display_name}</span>
        <span className={`text-xs ${pair.high_vol ? "text-red-400" : "text-emerald-400"}`}>
          {pair.vol_level} VOL
        </span>
      </div>
      <div className="text-lg font-black font-mono text-white">{pair.current_rate?.toFixed(4)}</div>
      <div className="flex items-center gap-1 mt-1">
        {up ? <ArrowUpRight size={11} className="text-red-400" /> : <ArrowDownRight size={11} className="text-emerald-400" />}
        <span className={`text-[10px] font-bold ${up ? "text-red-400" : "text-emerald-400"}`}>
          {up ? "+" : ""}{pair.change_1d?.toFixed(3)}%
        </span>
        <SignalPill signal={pair.signal_1d || "STABLE"} />
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const [pairs, setPairs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selected, setSelected] = useState("USDNGN");
  const [pairData, setPairData] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [volatility, setVolatility] = useState<any[]>([]);
  const [volThreshold, setVolThreshold] = useState(0);
  const [features, setFeatures] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    try {
      const [pairsRes, alertsRes] = await Promise.all([
        fetch(`${API}/api/pairs`).then(r => r.json()),
        fetch(`${API}/api/alerts`).then(r => r.json()),
      ]);
      setPairs(pairsRes.pairs || []);
      setAlerts(alertsRes.alerts || []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function fetchPair(pid: string) {
    try {
      const [sig, pred, vol, fi, fc] = await Promise.all([
        fetch(`${API}/api/${pid}/signals`).then(r => r.json()),
        fetch(`${API}/api/${pid}/predictions`).then(r => r.json()),
        fetch(`${API}/api/${pid}/volatility`).then(r => r.json()),
        fetch(`${API}/api/${pid}/feature-importance`).then(r => r.json()),
        fetch(`${API}/api/${pid}/forecast`).then(r => r.json()),
      ]);
      setPairData({ signals: sig, forecast: fc });
      setPredictions(pred.predictions || []);
      setVolatility(vol.volatility || []);
      setVolThreshold(vol.threshold || 0);
      setFeatures(fi.feature_importance || []);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { if (selected) fetchPair(selected); }, [selected]);

  if (loading) return <Shell><div className="flex items-center justify-center h-64 text-[#4a6fa5] text-sm">Loading live FX data...</div></Shell>;
  if (error)   return <Shell><ErrorBox message={`Cannot reach API: ${error}`} /></Shell>;

  const l = pairData?.signals?.latest;
  const fc = pairData?.forecast;
  const selectedPair = pairs.find(p => p.pair_id === selected);

  return (
    <Shell rate={l?.rate}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">FX Risk Intelligence</h1>
            <p className="text-[#4a6fa5] text-sm mt-0.5">
              Multi-currency ML platform · {pairs.length} pairs · Live data
            </p>
          </div>
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle size={12} className="text-red-400" />
              <span className="text-[11px] text-red-400 font-bold">{alerts.length} Active Alert{alerts.length > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Alerts Strip */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.slice(0, 3).map((a, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border text-[11px] ${a.severity === "HIGH" ? "bg-red-500/5 border-red-500/20 text-red-400" : "bg-amber-500/5 border-amber-500/20 text-amber-400"}`}>
                <AlertTriangle size={11} />
                <span className="font-bold">{a.pair}</span>
                <span className="text-[#94a3b8]">{a.message}</span>
                <span className={`ml-auto text-[9px] font-black px-2 py-0.5 rounded-full ${a.severity === "HIGH" ? "bg-red-500/20" : "bg-amber-500/20"}`}>{a.severity}</span>
              </div>
            ))}
          </div>
        )}

        {/* Currency Pair Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {pairs.map(p => (
            <PairCard key={p.pair_id} pair={p} onClick={() => setSelected(p.pair_id)} active={selected === p.pair_id} />
          ))}
        </div>

        {/* Selected Pair KPIs */}
        {l && fc && (
          <>
            <div className="flex items-center gap-2 mt-2">
              <h2 className="text-lg font-black text-white">{selectedPair?.display_name || selected}</h2>
              <span className="text-[#4a6fa5] text-sm">— Detailed Analysis</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Current Rate" value={l.rate?.toFixed(4)} sub="Live market rate" accent="#3b82f6" />
              <KpiCard
                label="1-Day Forecast"
                value={`${fc.forecasts[0]?.predicted_change > 0 ? "+" : ""}${fc.forecasts[0]?.predicted_change?.toFixed(3)}%`}
                sub={`→ ${fc.forecasts[0]?.predicted_rate?.toFixed(4)}`}
                accent={fc.forecasts[0]?.predicted_change > 0 ? "#ef4444" : "#10b981"}
              />
              <KpiCard label="7-Day Volatility" value={l.volatility?.toFixed(2)} sub={`Threshold: ${pairData?.signals?.vol_threshold?.toFixed(2)}`} accent={l.high_volatility_flag ? "#ef4444" : "#f59e0b"} />
              <KpiCard label="Dir. Accuracy" value={`${pairData?.signals?.metrics?.direction_accuracy_best?.toFixed(1)}%`} sub={pairData?.signals?.model_name} accent="#8b5cf6" />
            </div>

            {/* 7-Day Forecast Strip */}
            <div className="bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">Forward Forecast — {selectedPair?.display_name}</h3>
                  <p className="text-[10px] text-[#4a6fa5] mt-0.5">Genuine ML predictions · {fc.direction_accuracy?.toFixed(1)}% direction accuracy</p>
                </div>
                <span className="text-[9px] text-[#4a6fa5] bg-[#1a2744] border border-[#1e2d45] px-2 py-1 rounded-lg">
                  Data through {fc.data_through}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {fc.forecasts?.map((f: any) => (
                  <div key={f.horizon} className="p-4 rounded-xl border border-[#1a2744] bg-[#0f1f35]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-[#4a6fa5]">{f.label.toUpperCase()}</span>
                      {f.predicted_change > 0 ? <ArrowUpRight size={11} className="text-red-400" /> : <ArrowDownRight size={11} className="text-emerald-400" />}
                    </div>
                    <div className={`text-lg font-black font-mono ${f.predicted_change > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {f.predicted_change > 0 ? "+" : ""}{f.predicted_change?.toFixed(3)}%
                    </div>
                    <div className="text-[11px] text-white font-bold font-mono mt-0.5">{f.predicted_rate?.toFixed(4)}</div>
                    <div className="text-[9px] text-[#4a6fa5] mt-1">{f.forecast_date}</div>
                    <SignalPill signal={f.signal} />
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-[#2a3a5a] mt-3 border-t border-[#1a2744] pt-3">
                ⚠️ {fc.disclaimer}
              </p>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-1">Actual vs Predicted % Change</h3>
                <p className="text-[10px] text-[#4a6fa5] mb-4">Historical model performance</p>
                <PredictionChart data={predictions} />
              </div>
              <div className="bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-1">Volatility Monitor</h3>
                <p className="text-[10px] text-[#4a6fa5] mb-4">7-day rolling standard deviation</p>
                <VolatilityChart data={volatility} threshold={volThreshold} />
              </div>
            </div>

            <div className="bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-1">Feature Importance</h3>
              <p className="text-[10px] text-[#4a6fa5] mb-4">What drives the {selectedPair?.display_name} predictions</p>
              <FeatureChart data={features} />
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
