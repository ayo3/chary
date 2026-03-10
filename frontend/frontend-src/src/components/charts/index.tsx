"use client";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { ChartTooltip } from "../ui";

interface PredictionChartProps {
  data: { date: string; actual_change: number; predicted_change: number }[];
}
export function PredictionChart({ data }: PredictionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -15 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
        <XAxis dataKey="date" tick={{ fill: "#4a6fa5", fontSize: 9 }} tickLine={false} interval={Math.floor(data.length / 5)} />
        <YAxis tick={{ fill: "#4a6fa5", fontSize: 9 }} tickLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: "10px", color: "#4a6fa5" }} />
        <ReferenceLine y={0} stroke="#1e2d45" strokeWidth={1.5} />
        <Line type="monotone" dataKey="actual_change" stroke="#3b82f6" strokeWidth={2} dot={false} name="Actual %" />
        <Line type="monotone" dataKey="predicted_change" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Predicted %" />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface VolatilityChartProps {
  data: { date: string; volatility: number }[];
  threshold: number;
}
export function VolatilityChart({ data, threshold }: VolatilityChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -15 }}>
        <defs>
          <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" />
        <XAxis dataKey="date" tick={{ fill: "#4a6fa5", fontSize: 9 }} tickLine={false} interval={Math.floor(data.length / 5)} />
        <YAxis tick={{ fill: "#4a6fa5", fontSize: 9 }} tickLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5}
          label={{ value: "High Risk", fill: "#ef4444", fontSize: 9, position: "insideTopRight" }} />
        <Area type="monotone" dataKey="volatility" stroke="#3b82f6" fill="url(#volGrad)" strokeWidth={2} name="Volatility" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface FeatureChartProps {
  data: { feature: string; importance: number }[];
}
export function FeatureChart({ data }: FeatureChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 70 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2744" horizontal={false} />
        <XAxis type="number" tick={{ fill: "#4a6fa5", fontSize: 9 }} tickLine={false} />
        <YAxis dataKey="feature" type="category" tick={{ fill: "#64b5f6", fontSize: 9 }} tickLine={false} width={70} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="importance" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Importance" />
      </BarChart>
    </ResponsiveContainer>
  );
}
