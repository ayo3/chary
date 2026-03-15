const API = process.env.NEXT_PUBLIC_API_URL || "";

export interface PredictionRow {
  date: string; date_full: string; rate: number;
  actual_change: number; predicted_change: number;
  signal: string; volatility: number;
  high_volatility_flag: number; oil_price: number;
}
export interface VolatilityRow { date: string; volatility: number; high_flag: number; }
export interface FeatureImportanceRow { feature: string; importance: number; }
export interface Metrics {
  rmse: number; mae: number; r2: number;
  direction_accuracy_best: number;
  direction_accuracy_rf: number;
  direction_accuracy_gb: number;
}
export interface ForecastRow {
  horizon: number; label: string; forecast_date: string;
  current_rate: number; predicted_rate: number;
  predicted_change: number; signal: string;
}
export interface ForecastResponse {
  generated_at: string; data_through: string;
  current_rate: number; model: string;
  direction_accuracy: number;
  sources_used: Record<string, string>;
  forecasts: ForecastRow[];
  disclaimer: string;
}
export interface SignalsResponse {
  latest: PredictionRow; signal_distribution: Record<string, number>;
  metrics: Metrics; model_name: string; vol_threshold: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  predictions:       () => get<{ predictions: PredictionRow[] }>("/api/predictions"),
  volatility:        () => get<{ volatility: VolatilityRow[]; threshold: number }>("/api/volatility"),
  featureImportance: () => get<{ feature_importance: FeatureImportanceRow[] }>("/api/feature-importance"),
  signals:           () => get<SignalsResponse>("/api/signals"),
  forecast:          () => get<ForecastResponse>("/api/forecast"),
  health:            () => get<{ status: string; model: string; trained_at: string; data_through: string; sources_used: Record<string,string> }>("/api/health"),
};
