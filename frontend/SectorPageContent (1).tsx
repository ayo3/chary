"use client";
import { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import { ErrorBox } from "@/components/ui";
import { PredictionChart, VolatilityChart } from "@/components/charts";
import { ArrowUpRight, ArrowDownRight, AlertTriangle, TrendingUp, Activity, DollarSign, Zap, ChevronRight } from "lucide-react";
import { Sector } from "@/lib/sectors";

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
      <div className="text-xl font-black font-mono" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-[10px] text-[#4a6fa5] mt-1">{sub}</div>}
    </div>
  );
}

export default function SectorPageContent({ sector }: { sector: Sector }) {
  const [signals, setSignals] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [volatility, setVolatility] = useState<any[]>([]);
  const [volThreshold, setVolThreshold] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/USDNGN/signals`).then(r => r.json()),
      fetch(`${API}/api/USDNGN/predictions`).then(r => r.json()),
      fetch(`${API}/api/USDNGN/volatility`).then(r => r.json()),
    ]).then(([sig, pred, vol]) => {
      setSignals(sig);
      setPredictions(pred.predictions || []);
      setVolatility(vol.volatility || []);
      setVolThreshold(vol.threshold || 0);
    }).catch((e: any) => setError(e.message));
  }, []);

  if (error)    return <Shell><ErrorBox message={`API unavailable: ${error}`} /></Shell>;
  if (!signals) return <Shell><div className="flex items-center justify-center h-64 text-[#4a6fa5] text-sm">Loading...</div></Shell>;

  const l   = signals.latest;
  const vt  = signals.vol_threshold;
  const ins = sector.getInsights ? sector.getInsights(signals) : [];

  return (
    <Shell rate={l?.rate}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{sector.icon}</span>
              <h1 className="text-2xl font-black text-white">{sector.name}</h1>
            </div>
            <p className="text-[#4a6fa5] text-sm">{sector.description}</p>
          </div>
          <SignalPill signal={l?.signal || "STABLE"} />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="USD/NGN Rate"    value={`₦${l?.rate?.toFixed(0)}`}        sub="Live rate"              accent="#3b82f6" />
          <KpiCard label="Predicted Move"  value={`${l?.predicted_change > 0 ? "+" : ""}${l?.predicted_change?.toFixed(3)}%`} sub="Next day" accent={l?.predicted_change > 0 ? "#ef4444" : "#10b981"} />
          <KpiCard label="Volatility"      value={l?.volatility?.toFixed(1)}         sub={`Threshold ${vt?.toFixed(1)}`} accent={l?.high_volatility_flag ? "#ef4444" : "#f59e0b"} />
          <KpiCard label="Dir. Accuracy"   value={`${signals.metrics?.direction_accuracy_best?.toFixed(1)}%`} sub={signals.model_name} accent="#8b5cf6" />
        </div>

        {/* Insights */}
        {ins.length > 0 && (
          <div className="bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                <Zap size={13} className="text-[#818cf8]" />
              </div>
              <span className="text-sm font-bold text-white">{sector.name} AI Insights</span>
            </div>
            <div className="space-y-3">
              {ins.map((insight: string, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#0f1f35] border border-[#1a2744]">
                  <ChevronRight size={13} className="text-[#6366f1] mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-[#94a3b8] leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Predicted vs Actual</h3>
            <PredictionChart data={predictions} />
          </div>
          <div className="bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Volatility Monitor</h3>
            <VolatilityChart data={volatility} threshold={volThreshold} />
          </div>
        </div>

      </div>
    </Shell>
  );
}
