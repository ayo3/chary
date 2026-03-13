import { api } from "@/lib/api";
import Shell from "@/components/Shell";
import { RiskBadge, SignalBadge, StatCard, ErrorBox } from "@/components/ui";
import { PredictionChart, VolatilityChart } from "@/components/charts";
import { DollarSign, TrendingUp, Activity, AlertTriangle, Zap, ChevronRight } from "lucide-react";
import { Sector } from "@/lib/sectors";

export default async function SectorPageContent({ sector }: { sector: Sector }) {
  let predictions, volatility, threshold, signals;
  try {
    [{ predictions }, { volatility, threshold: threshold }, signals] = await Promise.all([
      api.predictions(), api.volatility(), api.signals(),
    ]);
  } catch (e: any) {
    return (
      <Shell>
        <ErrorBox message={`API unavailable: ${e.message}`} />
      </Shell>
    );
  }

  const l      = signals.latest;
  const vt     = signals.vol_threshold;
  const insight = sector.insight(l, vt);
  const Icon   = Activity;

  return (
    <Shell rate={l.rate}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#1a2744] flex items-center justify-center flex-shrink-0">
            <Zap size={20} className="text-[#60a5fa]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-white tracking-tight">{sector.label} FX Risk Dashboard</h1>
              <RiskBadge flag={l.high_volatility_flag} vol={l.volatility} />
            </div>
            <p className="text-[#4a6fa5] text-sm mt-1">{sector.subtitle}</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Current Rate" value={`₦${l.rate?.toFixed(0)}`} icon={DollarSign} accent="#3b82f6" />
          <StatCard
            label="Predicted Change"
            value={`${l.predicted_change > 0 ? "+" : ""}${l.predicted_change?.toFixed(3)}%`}
            sub="Next-day forecast"
            icon={TrendingUp}
            accent={l.predicted_change > 0 ? "#ef4444" : "#10b981"}
          />
          <StatCard label="Signal" value={<SignalBadge signal={l.signal} />} sub="ML model output" icon={Activity} accent="#6366f1" />
          <StatCard
            label="Volatility Score"
            value={l.volatility?.toFixed(1)}
            sub={`/ ${vt.toFixed(1)} threshold`}
            icon={AlertTriangle}
            accent={l.high_volatility_flag ? "#ef4444" : "#f59e0b"}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-white">Predicted Next-Day FX Movement</h3>
              <p className="text-[10px] text-[#4a6fa5] mt-0.5">Actual vs ML-predicted % change</p>
            </div>
            <PredictionChart data={predictions} />
          </div>

          <div className="bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-white">FX Volatility Monitor</h3>
              <p className="text-[10px] text-[#4a6fa5] mt-0.5">Red line = high-risk threshold for {sector.label}</p>
            </div>
            <VolatilityChart data={volatility} threshold={vt} />
          </div>
        </div>

        {/* AI Summary + Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-[#0d1525] to-[#060e1a] border border-[#1a2744] rounded-2xl p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                <Zap size={13} className="text-[#818cf8]" />
              </div>
              <span className="text-sm font-bold text-white">AI Model Summary</span>
            </div>
            <div className="space-y-3 flex-1">
              <div className="p-3 rounded-xl bg-[#1a2744]/40 border border-[#1e2d45]">
                <p className="text-[11px] text-[#94a3b8] leading-relaxed">{insight}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-[#0f1f35] border border-[#1a2744] text-center">
                  <div className="text-[9px] text-[#4a6fa5]">Direction Acc.</div>
                  <div className="text-xs font-bold text-[#34d399]">{signals.metrics.direction_accuracy_best?.toFixed(1)}%</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#0f1f35] border border-[#1a2744] text-center">
                  <div className="text-[9px] text-[#4a6fa5]">Model</div>
                  <div className="text-[10px] font-bold text-[#60a5fa] truncate">{signals.model_name}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <ChevronRight size={14} className="text-[#60a5fa]" />
              <span className="text-sm font-bold text-white">Sector-Specific Recommendations</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {sector.actions.map((action, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-[#0f1f35] border border-[#1a2744] hover:border-[#2a4a8a] transition-colors group">
                  <div className="w-5 h-5 rounded-full bg-[#3b82f6]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[9px] font-black text-[#60a5fa]">{i + 1}</span>
                  </div>
                  <p className="text-[11px] text-[#94a3b8] leading-relaxed group-hover:text-[#cbd5e1] transition-colors">{action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
