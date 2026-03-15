export interface Sector {
  id: string;
  label: string;
  subtitle: string;
  actions: string[];
  insight: (latest: any, volThreshold: number) => string;
}

export const SECTORS: Sector[] = [
  {
    id: "fintech",
    label: "Fintech",
    subtitle: "How FX predictions help payment platforms protect margins and optimize conversion timing.",
    actions: [
      "Widen FX spreads by 0.3–0.5% during high-volatility windows",
      "Delay NGN conversions when STRONG RISE signal is active",
      "Trigger dynamic pricing engine 2 hours before market open",
      "Alert treasury team when 7-day volatility exceeds threshold",
    ],
    insight: (l, vt) =>
      `USD/NGN momentum of ${l.predicted_change > 0 ? "+" : ""}${l.predicted_change?.toFixed(3)}% suggests ${l.predicted_change > 0 ? "upward pressure on NGN" : "slight NGN recovery"}. Platforms should ${l.high_volatility_flag ? "widen spreads and pause rate locks" : "maintain current spread policy"}. Current volatility ${l.volatility?.toFixed(1)} vs threshold ${vt.toFixed(1)}.`,
  },
  {
    id: "banks",
    label: "Banks",
    subtitle: "FX desk optimization and interbank rate positioning for commercial banks.",
    actions: [
      "Rebalance FX desk exposure before predicted high-volatility sessions",
      "Adjust interbank offer rates based on predicted next-day direction",
      "Pre-position NGN liquidity on STRONG DROP signals",
      "Issue client FX alerts 24hrs ahead of risk windows",
    ],
    insight: (l, vt) =>
      `Model predicts a ${Math.abs(l.predicted_change)?.toFixed(3)}% ${l.predicted_change > 0 ? "rise" : "fall"} in USD/NGN. Banks should ${l.high_volatility_flag ? "increase FX reserve buffers and brief trading desks" : "maintain standard hedging posture"}.`,
  },
  {
    id: "ecommerce",
    label: "E-commerce",
    subtitle: "Dynamic pricing and checkout FX management for online retailers.",
    actions: [
      "Freeze NGN prices for 4–6 hours max during high-volatility periods",
      "Apply auto-refresh on checkout FX rates every 15 minutes",
      "Route USD payments preferentially when NGN weakening predicted",
      "Push promotional NGN pricing when SLIGHT DROP signal is active",
    ],
    insight: (l, vt) =>
      `With ${l.signal} signal and volatility score ${l.volatility?.toFixed(1)}, e-commerce platforms face ${l.high_volatility_flag ? "elevated margin risk — refresh checkout rates more frequently" : "stable conditions — standard pricing policies apply"}.`,
  },
  {
    id: "import-export",
    label: "Import / Export",
    subtitle: "Payment hedging and invoice timing for cross-border trade businesses.",
    actions: [
      "Accelerate USD payments when NGN weakening is predicted",
      "Delay NGN-denominated invoicing during STRONG RISE windows",
      "Lock forward contracts on days following STRONG RISE signals",
      "Review import duty FX exposure weekly against model signals",
    ],
    insight: (l, vt) =>
      `Predicted ${l.predicted_change > 0 ? "NGN depreciation" : "NGN appreciation"} of ${Math.abs(l.predicted_change)?.toFixed(3)}%. Importers should ${l.predicted_change > 0 ? "accelerate USD disbursements and review open NGN invoices" : "hold USD and negotiate NGN-denominated contracts"}.`,
  },
  {
    id: "logistics",
    label: "Logistics",
    subtitle: "Contract pricing and fuel cost hedging for cross-border logistics operators.",
    actions: [
      "Build 1.5–2% FX buffer into new cross-border contracts",
      "Renegotiate fuel cost clauses when 7-day vol exceeds threshold",
      "Invoice in USD for routes with NGN exposure above 30%",
      "Trigger FX review clause in long-term contracts on STRONG RISE",
    ],
    insight: (l, vt) =>
      `Current volatility at ${l.volatility?.toFixed(1)} (threshold: ${vt.toFixed(1)}). Logistics firms with NGN-denominated contracts face ${l.high_volatility_flag ? "high cost overrun risk — activate FX review clauses" : "manageable exposure — monitor weekly"}.`,
  },
  {
    id: "travel",
    label: "Travel / Airlines",
    subtitle: "Dynamic airfare pricing and FX hedging for travel companies and airlines.",
    actions: [
      "Adjust NGN ticket prices dynamically based on predicted direction",
      "Hedge fuel costs denominated in USD when NGN drop predicted",
      "Extend price guarantee windows on STABLE signal days only",
      "Alert revenue management team on STRONG RISE signal activation",
    ],
    insight: (l, vt) =>
      `${l.signal} signal with ${l.high_volatility_flag ? "HIGH" : "NORMAL"} volatility. Airlines should ${l.predicted_change > 0 ? "revise NGN fare floors upward and limit price guarantees" : "maintain current fares but hedge USD fuel exposure"}.`,
  },
  {
    id: "asset-mgmt",
    label: "Asset Management",
    subtitle: "Portfolio FX risk monitoring and rebalancing signals for fund managers.",
    actions: [
      "Reduce NGN-denominated asset exposure on STRONG RISE signals",
      "Rebalance towards USD-linked equities during high-vol windows",
      "Use predicted direction to time cross-currency bond settlements",
      "Flag portfolio NAV sensitivity when volatility exceeds threshold",
    ],
    insight: (l, vt) =>
      `Model flags ${l.high_volatility_flag ? "HIGH" : "MODERATE"} FX risk. Fund managers with NGN exposure should ${l.high_volatility_flag ? "consider defensive rebalancing — reduce NGN positions by 10–15%" : "maintain positions but set tighter stop-loss triggers"}.`,
  },
  {
    id: "treasury",
    label: "Corporate Treasury",
    subtitle: "Working capital protection and FX exposure management for CFOs and treasurers.",
    actions: [
      "Time payables in USD ahead of predicted NGN weakening",
      "Accelerate USD receivables conversion on STRONG DROP signals",
      "Review 30-day cash flow FX exposure against model forecasts",
      "Set board-level FX alert at volatility score above 15",
    ],
    insight: (l, vt) =>
      `Next-day predicted change: ${l.predicted_change > 0 ? "+" : ""}${l.predicted_change?.toFixed(3)}%. Corporate treasurers should ${l.predicted_change > 0 ? "bring forward USD payments and defer NGN outflows" : "consider accelerating NGN collections before potential recovery reverses"}.`,
  },
  {
    id: "government",
    label: "Government & Policy",
    subtitle: "Macro FX monitoring and policy response intelligence for regulators and ministries.",
    actions: [
      "Monitor predicted volatility for CBN intervention triggers",
      "Brief economic advisors when 3+ consecutive STRONG RISE signals appear",
      "Adjust foreign reserve deployment based on model directional signals",
      "Publish FX stability bulletins aligned with model risk windows",
    ],
    insight: (l, vt) =>
      `Model detects ${l.high_volatility_flag ? "ELEVATED systemic FX volatility" : "contained FX movements"}. Policy teams should ${l.high_volatility_flag ? "prepare CBN communication strategy and review intervention thresholds" : "continue standard monitoring — no immediate policy action required"}.`,
  },
];
