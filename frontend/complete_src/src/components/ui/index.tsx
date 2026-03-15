"use client";
import { ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";

export function RiskBadge({ flag, vol }: { flag: number; vol: number }) {
  const level = flag ? "HIGH" : vol > 10 ? "MEDIUM" : "LOW";
  const styles: Record<string, string> = {
    HIGH:   "bg-red-500/20 text-red-400 border-red-500/30",
    MEDIUM: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    LOW:    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };
  const dots: Record<string, string> = {
    HIGH: "bg-red-400", MEDIUM: "bg-amber-400", LOW: "bg-emerald-400",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${styles[level]}`}>
      <span className={`w-1.5 h-1.5 rounded-full pulse-dot ${dots[level]}`} />
      {level} RISK
    </span>
  );
}

export function SignalBadge({ signal }: { signal: string }) {
  const map: Record<string, string> = {
    "STRONG RISE": "text-red-400 bg-red-500/10 border-red-500/20",
    "SLIGHT RISE":  "text-orange-400 bg-orange-500/10 border-orange-500/20",
    "STABLE":       "text-sky-400 bg-sky-500/10 border-sky-500/20",
    "SLIGHT DROP":  "text-teal-400 bg-teal-500/10 border-teal-500/20",
    "STRONG DROP":  "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  };
  const Icon = signal?.includes("RISE")
    ? ArrowUpRight : signal?.includes("DROP")
    ? ArrowDownRight : Activity;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${map[signal] || "text-gray-400 bg-gray-500/10 border-gray-500/20"}`}>
      <Icon size={11} /> {signal}
    </span>
  );
}

export function StatCard({
  label, value, sub, accent = "#3b82f6",
}: {
  label: string; value: React.ReactNode; sub?: string;
  icon?: unknown; accent?: string;
}) {
  return (
    <div
      className="relative bg-[#0d1525] border border-[#1a2744] rounded-2xl p-5 overflow-hidden group hover:border-[#2a4a8a] transition-all duration-300"
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(circle at 80% 20%, ${accent}10 0%, transparent 60%)` }}
      />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-bold tracking-widest text-[#4a6fa5] uppercase">{label}</span>
        <div className="p-2 rounded-xl" style={{ background: `${accent}18` }}>
          <span style={{ color: accent }}>●</span>
        </div>
      </div>
      <div className="text-xl font-black text-white font-mono tracking-tight">{value}</div>
      {sub && <div className="text-[10px] text-[#4a6fa5] mt-1">{sub}</div>}
    </div>
  );
}

export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1623] border border-[#1e2d45] rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-[#64b5f6] font-semibold mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-mono font-bold">
            {typeof p.value === "number" ? p.value.toFixed(4) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
      ⚠️ {message}
    </div>
  );
}
