import { api } from "@/lib/api";
import Shell from "@/components/Shell";
import { RiskBadge, SignalBadge, StatCard, ErrorBox } from "@/components/ui";
import { PredictionChart, VolatilityChart, FeatureChart } from "@/components/charts";
import {
  DollarSign, TrendingUp, Activity, AlertTriangle,
  Shield, Zap, ArrowUpRight, ArrowDownRight, Database,
} from "lucide-react";

export const revalidate = 300;

const SIGNAL_COLOR: Record<string, string> = {
  "STRONG RISE": "border-red-500/30 bg-red-500/5",
  "SLIGHT RISE":  "border-orange-500/30 bg-orange-500/5",
  "STABLE":       "border-sky-500/30 bg-sky-500/5",
  "SLIGHT DROP":  "border-teal-500/30 bg-teal-500/5",
  "STRONG DROP":  "border-emerald-500/30 bg-emerald-500/5",
};
const SIGNAL_TEXT: Record<string, string> = {
  "STRONG RISE": "text-red-400",
  "SLIGHT RISE":  "text-orange-400",
  "STABLE":       "text-sky-400",
  "SLIGHT DROP":  "text-teal-400",
  "STRONG DROP":  "text-emerald-400",
};

export default async function DashboardPage() {
  let predictions, volatility, threshold, features, signals, forecastData;
  try {
    [
      { predictions },
      { volatility, threshold: threshold },
      { feature_importance: features },
      signals,
      forecastData,
    ] = await Promise.all([
      api.predictions(),
      api.volatility(),
      api.featureImportance(),
      api.signals(),
      api.forecast(),
    ]);
  } catch (e: any) {
    return (
      <Shell>
        <ErrorBox message={`Cannot reach API: ${e.message} — ensure the FastAPI backend is running.`} />
      </Shell>
    );
  }

  const l  = signals.latest;
  const vt = signals.vol_threshold;

  return (
    <Shell rate={l.rate}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">FX Risk Overview</h1>
            <p className="text-[#4a6fa5] text-sm mt-0.5">
              Live USD/NGN intelligence · Data through{" "}
              <span className="text-[#60a5fa]">{forecastData.data_through}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0d1525] border border-[#1a2744] text-[10px] text-[#4a6fa5]">
              <Database size={10} />
              {forecastData.sources_used?.fx_primary}
              {forecastData.sources_used?.fx_patch !== "None" && ` + ${forecastData.sources_used?.fx_patch}`}
            </div>
            <RiskBadge flag={l.high_volatility_flag} vol={l.volatility} />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="USD/NGN Rate" value={`₦${l.rate?.toFixed(0)}`} sub="Live market rate" icon={DollarSign} accent="#3b82f6" />
          <StatCard
            label="Predicted (1d)"
            value={`${forecastData.forecasts[0]?.predicted_change > 0 ? "+" : ""}${forecastData.forecasts[0]?.predicted_change?.toFixed(3)}%`}
            sub={`→ ₦${forecastData.forecasts[0]?.predicted_rate?.toFixed(0)}`}
            icon={TrendingUp}
            accent={forecastData.forecasts[0]?.predicted_change > 0 ? "#ef4444" : "#10b981"}
          />
          <StatCard label="1d Signal" value={<SignalBadge signal={forecastData.forecasts[0]?.signal} />} sub="Model output" icon={Activity} accent="#6366f1" />
          <StatCard
            label="7-Day Volatility"
            value={l.volatility?.toFixed(1)}
            sub={`Threshold: ${vt.toFixed(1)}`}
            icon={AlertTriangle}
            accent={l.high_volatility_flag ? "#ef4444" : "#f59e0b"}
          />
          <StatCard label="Risk Level" value={<RiskBadge flag={l.high_volatility_flag} vol={l.volatility} />} sub="Composite score" icon={Shield} accent="#8b5cf6" />
        </div>

        {/* 7-Day Forecast Strip */}
        <div className="bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">Forward Forecast — Next 7 Trading Days</h3>
              <p className="text-[10px] text-[#4a6fa5] mt-0.5">
                Genuine ML predictions · Not backtested · Dir. accuracy {forecastData.direction_accuracy?.toFixed(1)}% · {forecastData.model}
              </p>
            </div>
            <span className="text-[9px] text-[#4a6fa5] bg-[#1a2744] border border-[#1e2d45] px-2 py-1 rounded-lg">
              Generated {new Date(forecastData.generated_at).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {forecastData.forecasts.map((f) => (
              <div
                key={f.horizon}
                className={`p-4 rounded-xl border transition-all hover:scale-[1.02] ${SIGNAL_COLOR[f.signal] || "border-[#1a2744] bg-[#0f1f35]"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-[#4a6fa5] tracking-wider">{f.label.toUpperCase()}</span>
                  {f.predicted_change > 0
                    ? <ArrowUpRight size={12} className="text-red-400" />
                    : <ArrowDownRight size={12} className="text-emerald-400" />
                  }
                </div>
                <div className={`text-lg font-black font-mono ${SIGNAL_TEXT[f.signal]}`}>
                  {f.predicted_change > 0 ? "+" : ""}{f.predicted_change?.toFixed(3)}%
                </div>
                <div className="text-[11px] text-white font-bold font-mono mt-0.5">
                  ₦{f.predicted_rate?.toFixed(0)}
                </div>
                <div className="text-[9px] text-[#4a6fa5] mt-1">{f.forecast_date}</div>
                <div className={`text-[9px] font-bold mt-1.5 ${SIGNAL_TEXT[f.signal]}`}>{f.signal}</div>
              </div>
            ))}
          </div>

          <p className="text-[9px] text-[#2a3a5a] mt-3 border-t border-[#1a2744] pt-3">
            ⚠️ {forecastData.disclaimer}
          </p>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Actual vs Predicted % Change</h3>
                <p className="text-[10px] text-[#4a6fa5] mt-0.5">Historical model performance on test data</p>
              </div>
              <SignalBadge signal={l.signal} />
            </div>
            <PredictionChart data={predictions} />
          </div>

          {/* AI Insight */}
          <div className="bg-gradient-to-br from-[#0d1525] to-[#0a1020] border border-[#1a2744] rounded-2xl p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                <Zap size={13} className="text-[#818cf8]" />
              </div>
              <span className="text-sm font-bold text-white">AI Insights</span>
              <span className="ml-auto text-[9px] bg-[#6366f1]/10 text-[#818cf8] border border-[#6366f1]/20 px-2 py-0.5 rounded-full">LIVE</span>
            </div>
            <div className="space-y-3 flex-1">
              <div className="p-3 rounded-xl bg-[#1a2744]/50 border border-[#1e2d45]">
                <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                  Model projects{" "}
                  <span className={`font-semibold ${forecastData.forecasts[4]?.predicted_change > 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {forecastData.forecasts[4]?.predicted_change > 0 ? "NGN depreciation" : "NGN appreciation"}
                  </span>{" "}
                  of{" "}
                  <span className="text-white font-bold">
                    {Math.abs(forecastData.forecasts[4]?.predicted_change)?.toFixed(3)}%
                  </span>{" "}
                  over 7 days. Highest model weight on{" "}
                  <span className="text-[#60a5fa] font-semibold">fx_rolling_mean_7</span>.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#1a2744]/50 border border-[#1e2d45]">
                <p className="text-[10px] text-[#4a6fa5] uppercase tracking-wider font-bold mb-1">Action</p>
                <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                  {l.high_volatility_flag
                    ? "⚠️ High volatility. Widen spreads. Accelerate USD payments. Brief FX desks."
                    : "✅ Normal volatility. Maintain standard hedging posture."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-[#0f1f35] border border-[#1a2744] text-center">
                  <div className="text-[9px] text-[#4a6fa5]">Dir. Accuracy</div>
                  <div className="text-xs font-bold text-[#34d399]">{signals.metrics.direction_accuracy_best?.toFixed(1)}%</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#0f1f35] border border-[#1a2744] text-center">
                  <div className="text-[9px] text-[#4a6fa5]">RMSE</div>
                  <div className="text-xs font-bold text-white">{signals.metrics.rmse?.toFixed(4)}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#0f1f35] border border-[#1a2744] text-center">
                  <div className="text-[9px] text-[#4a6fa5]">R²</div>
                  <div className="text-xs font-bold text-white">{signals.metrics.r2?.toFixed(4)}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#0f1f35] border border-[#1a2744] text-center">
                  <div className="text-[9px] text-[#4a6fa5]">Oil Source</div>
                  <div className="text-[9px] font-bold text-[#60a5fa] truncate">{forecastData.sources_used?.oil}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Volatility Monitor</h3>
                <p className="text-[10px] text-[#4a6fa5] mt-0.5">7-day rolling standard deviation</p>
              </div>
              <span className="text-[9px] text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 px-2 py-0.5 rounded-full font-bold">
                THRESHOLD: {vt.toFixed(1)}
              </span>
            </div>
            <VolatilityChart data={volatility} threshold={vt} />
          </div>
          <div className="bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-white">Feature Importance</h3>
              <p className="text-[10px] text-[#4a6fa5] mt-0.5">What drives the forward predictions</p>
            </div>
            <FeatureChart data={features} />
          </div>
        </div>

      </div>
    </Shell>
  );
}
