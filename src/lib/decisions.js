// Fixed status-family mapping for the 6-value decision enum from the v2
// integration spec. Colors follow the dataviz status palette; each state also
// carries an icon + label so meaning never rests on hue alone.
export const DECISION_META = {
  APPROVE: { label: "Approve", color: "var(--status-good)", icon: "check" },
  MONITOR: { label: "Monitor", color: "var(--status-info)", icon: "eye" },
  STEP_UP_AUTH: { label: "Step-up auth", color: "var(--status-warning)", icon: "shield" },
  MANUAL_REVIEW: { label: "Manual review", color: "var(--status-serious)", icon: "flag" },
  DECLINE: { label: "Decline", color: "var(--status-critical)", icon: "x" },
  HOLD: { label: "Hold", color: "var(--status-critical)", icon: "pause" },
};

// Risk % buckets: 0-30 low (green), 31-60 medium (orange), 61-100 high (red).
export const RISK_LEVEL_META = {
  LOW: { label: "Low", color: "var(--risk-low)" },
  MEDIUM: { label: "Medium", color: "var(--risk-medium)" },
  HIGH: { label: "High", color: "var(--risk-high)" },
};

export const SEVERITY_META = {
  LOW: { label: "Low", color: "var(--status-good)" },
  MEDIUM: { label: "Medium", color: "var(--status-warning)" },
  HIGH: { label: "High", color: "var(--status-serious)" },
};
