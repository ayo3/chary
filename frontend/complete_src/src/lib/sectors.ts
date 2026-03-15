export interface Sector {
  id: string;
  name: string;
  icon: string;
  description: string;
  actions: string[];
  getInsights?: (signals: any) => string[];
}

export const SECTORS: Sector[] = [
  {
    id: "fintech", name: "Fintech", icon: "💳",
    description: "FX predictions for payment platforms to protect margins and optimize conversion timing.",
    actions: [
      "Widen FX spreads by 0.3–0.5% during high-volatility windows",
      "Delay NGN conversions when STRONG RISE signal is active",
      "Trigger dynamic pricing engine 2 hours before market open",
      "Alert treasury team when 7-day volatility exceeds threshold",
    ],
    getInsights: (s) => {
      const l = s?.latest; if (!l) return [];
      return [
        `USD/NGN predicted ${l.predicted_change > 0 ? "+" : ""}${l.predicted_change?.toFixed(3)}% tomorrow — ${l.predicted_change > 0 ? "consider widening spreads" : "stable conditions for conversions"}.`,
        l.high_volatility_flag ? "⚠️ High volatility detected — pause rate locks and widen bid/ask spreads." : "✅ Normal volatility — standard spread policy applies.",
        `Model direction accuracy: ${s?.metrics?.direction_accuracy_best?.toFixed(1)}% on test data.`,
      ];
    },
  },
  {
    id: "banks", name: "Banks", icon: "🏦",
    description: "FX desk optimization and interbank rate positioning for commercial banks.",
    actions: [
      "Rebalance FX desk exposure before predicted high-volatility sessions",
      "Adjust interbank offer rates based on predicted next-day direction",
      "Pre-position NGN liquidity on STRONG DROP signals",
      "Communicate FX outlook to corporate clients proactively",
    ],
    getInsights: (s) => {
      const l = s?.latest; if (!l) return [];
      return [
        `FX desk signal: ${l.signal} — ${l.predicted_change > 0 ? "consider net long USD position" : "reduce USD exposure"}.`,
        `Volatility at ${l.volatility?.toFixed(1)} — ${l.high_volatility_flag ? "recommend tightening client FX limits" : "normal trading conditions"}.`,
      ];
    },
  },
  {
    id: "ecommerce", name: "E-Commerce", icon: "🛒",
    description: "Dynamic pricing and margin protection for cross-border e-commerce.",
    actions: [
      "Auto-adjust USD-priced inventory by predicted FX move",
      "Delay large USD purchases when STRONG RISE signal fires",
      "Lock in supplier USD rates 48h before predicted spikes",
      "Display NGN prices with FX buffer during high volatility",
    ],
    getInsights: (s) => {
      const l = s?.latest; if (!l) return [];
      return [
        `Import cost exposure: predicted ${l.predicted_change > 0 ? "+" : ""}${l.predicted_change?.toFixed(3)}% NGN move — ${l.predicted_change > 0 ? "consider price adjustments" : "stable margins expected"}.`,
        l.high_volatility_flag ? "⚠️ Consider adding 1–2% FX buffer to NGN prices until volatility normalizes." : "✅ FX conditions stable for standard pricing.",
      ];
    },
  },
  {
    id: "import-export", name: "Import / Export", icon: "🚢",
    description: "Supplier payment timing and FX purchase scheduling for trade businesses.",
    actions: [
      "Schedule USD supplier payments on predicted NGN strength days",
      "Pre-purchase USD 5–7 days ahead of major import shipments",
      "Use volatility alerts to trigger forward contract discussions",
      "Monitor oil price correlation as leading indicator",
    ],
    getInsights: (s) => {
      const l = s?.latest; if (!l) return [];
      return [
        `Optimal payment timing: ${l.predicted_change > 0 ? "pay USD invoices NOW before NGN weakens further" : "NGN may strengthen — consider delaying USD purchases 1–2 days"}.`,
        `Oil/FX correlation active — Brent at $${l.oil_price?.toFixed(1)} is a leading indicator for NGN direction.`,
      ];
    },
  },
  {
    id: "logistics", name: "Logistics", icon: "🚛",
    description: "Freight pricing optimization and route exposure management.",
    actions: [
      "Adjust USD-denominated freight rates by predicted FX move",
      "Flag high-risk trade routes during volatility spikes",
      "Build FX buffer into multi-month shipping contracts",
      "Hedge fuel costs when strong NGN drop predicted",
    ],
    getInsights: (s) => {
      const l = s?.latest; if (!l) return [];
      return [
        `Freight repricing signal: ${l.signal} — ${l.predicted_change > 0 ? "recommend adding FX surcharge to USD routes" : "hold current rates"}.`,
        l.high_volatility_flag ? "⚠️ Consider inserting FX adjustment clauses into new logistics contracts." : "✅ Stable FX — standard contract terms appropriate.",
      ];
    },
  },
  {
    id: "travel", name: "Travel & Airlines", icon: "✈️",
    description: "Ticket pricing risk management and revenue conversion planning.",
    actions: [
      "Adjust NGN ticket prices daily based on FX prediction",
      "Convert USD revenue to NGN on predicted NGN strength days",
      "Pre-hedge fuel costs when STRONG RISE signal fires",
      "Monitor USD/NGN for ancillary pricing adjustments",
    ],
    getInsights: (s) => {
      const l = s?.latest; if (!l) return [];
      return [
        `Revenue conversion: ${l.predicted_change > 0 ? "convert USD revenue to NGN now — NGN weakening predicted" : "hold USD revenue — NGN may strengthen"}.`,
        `Fuel cost exposure: oil at $${l.oil_price?.toFixed(1)}/barrel with ${l.signal} FX signal.`,
      ];
    },
  },
  {
    id: "asset-mgmt", name: "Asset Management", icon: "📊",
    description: "Currency overlay strategies and portfolio FX exposure management.",
    actions: [
      "Increase USD allocation on STRONG RISE signals",
      "Rotate to NGN assets on STRONG DROP signals",
      "Use volatility score as risk-off trigger",
      "Integrate FX signal into factor model weekly",
    ],
    getInsights: (s) => {
      const l = s?.latest; if (!l) return [];
      return [
        `Portfolio signal: ${l.signal} — ${l.predicted_change > 0 ? "increase USD-denominated asset exposure" : "favour NGN assets short-term"}.`,
        `Volatility score ${l.volatility?.toFixed(1)} — ${l.high_volatility_flag ? "risk-off posture recommended" : "normal risk allocation appropriate"}.`,
        `Model confidence: ${s?.metrics?.direction_accuracy_best?.toFixed(1)}% directional accuracy.`,
      ];
    },
  },
  {
    id: "treasury", name: "Corporate Treasury", icon: "🏛️",
    description: "Cash conversion planning and hedging budget allocation.",
    actions: [
      "Convert USD to NGN on predicted NGN appreciation days",
      "Allocate hedging budget based on volatility forecast",
      "Pre-fund NGN payroll on STRONG RISE signals",
      "Adjust intercompany settlement timing weekly",
    ],
    getInsights: (s) => {
      const l = s?.latest; if (!l) return [];
      return [
        `Treasury action: ${l.predicted_change > 0 ? "accelerate USD → NGN conversion before further depreciation" : "hold USD — NGN may recover"}.`,
        `Hedging budget signal: volatility ${l.high_volatility_flag ? "ELEVATED — allocate more to forward contracts" : "NORMAL — standard hedging ratio appropriate"}.`,
      ];
    },
  },
  {
    id: "government", name: "Government & Policy", icon: "🏛️",
    description: "Currency stability monitoring and macro policy impact analysis.",
    actions: [
      "Monitor volatility index for early instability signals",
      "Simulate reserve intervention scenarios on STRONG DROP",
      "Track FX pass-through to CPI weekly",
      "Alert monetary policy committee on extreme signals",
    ],
    getInsights: (s) => {
      const l = s?.latest; if (!l) return [];
      return [
        `Stability monitor: ${l.high_volatility_flag ? "⚠️ Volatility above threshold — review intervention criteria" : "✅ Market stable — no intervention signal"}.`,
        `Predicted move ${l.predicted_change > 0 ? "+" : ""}${l.predicted_change?.toFixed(3)}% — ${Math.abs(l.predicted_change) > 0.5 ? "notable directional pressure detected" : "within normal range"}.`,
      ];
    },
  },
];
