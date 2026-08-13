// Client-side stand-in for the backend engineer_features() + hybrid decision
// engine described in the integration specs. This is the active scoring path
// for both single-transaction and bulk upload -- lib/api.js has a real fetch()
// client ready to swap in once a backend is available, it's just not wired
// into the UI right now. Nothing here should be mistaken for the real model.

const RULES = [
  {
    id: "AMOUNT_ABOVE_5X_BASELINE",
    reason: "AMOUNT_SIGNIFICANTLY_ABOVE_CUSTOMER_AVERAGE",
    severity: "HIGH",
    weight: 0.3,
    test: (f) => f.amount_to_customer_average >= 5,
  },
  {
    id: "AMOUNT_ABOVE_2X_BASELINE",
    reason: "AMOUNT_ABOVE_CUSTOMER_AVERAGE",
    severity: "MEDIUM",
    weight: 0.12,
    test: (f) => f.amount_to_customer_average >= 2 && f.amount_to_customer_average < 5,
  },
  {
    id: "NEW_DEVICE",
    reason: "DEVICE_FIRST_SEEN_RECENTLY",
    severity: "MEDIUM",
    weight: 0.15,
    test: (f) => f.is_new_device,
  },
  {
    id: "NEW_BENEFICIARY",
    reason: "NEW_PAYEE_ADDED",
    severity: "MEDIUM",
    weight: 0.1,
    test: (f) => f.is_new_beneficiary,
  },
  {
    id: "CROSS_BORDER_TRANSACTION",
    reason: "CROSS_BORDER_TRANSACTION_DETECTED",
    severity: "LOW",
    weight: 0.08,
    test: (f) => f.cross_border_transaction,
  },
  {
    id: "IP_COUNTRY_MISMATCH",
    reason: "IP_LOCATION_MISMATCH",
    severity: "MEDIUM",
    weight: 0.12,
    test: (f) => f.ip_country_mismatch,
  },
  {
    id: "TRANSACTION_COUNTRY_MISMATCH",
    reason: "TRANSACTION_LOCATION_MISMATCH",
    severity: "MEDIUM",
    weight: 0.1,
    test: (f) => f.transaction_country_mismatch,
  },
  {
    id: "HIGH_RISK_MERCHANT",
    reason: "MERCHANT_CATEGORY_ELEVATED_RISK",
    severity: "MEDIUM",
    weight: 0.15,
    test: (f) => f.merchant_high_risk,
  },
  {
    id: "HIGH_RISK_CUSTOMER",
    reason: "CUSTOMER_RISK_PROFILE_ELEVATED",
    severity: "MEDIUM",
    weight: 0.12,
    test: (f) => f.customer_high_risk,
  },
  {
    id: "VELOCITY_ABUSE",
    reason: "HIGH_TRANSACTION_VELOCITY",
    severity: "HIGH",
    weight: 0.2,
    test: (f) => f.transactions_last_10_minutes >= 4,
  },
  {
    id: "AUTH_FAILURES_DETECTED",
    reason: "RECENT_AUTH_FAILURES",
    severity: "MEDIUM",
    weight: 0.1,
    test: (f) => f.failed_attempts_last_24_hours >= 3,
  },
  {
    id: "DORMANT_ACCOUNT_REACTIVATION",
    reason: "DORMANT_ACCOUNT_REACTIVATED",
    severity: "MEDIUM",
    weight: 0.12,
    test: (f) => f.days_since_last_transaction >= 180 && f.amount_to_customer_average >= 2,
  },
  {
    id: "NEW_ACCOUNT_HIGH_VALUE",
    reason: "NEW_ACCOUNT_HIGH_VALUE_TXN",
    severity: "HIGH",
    weight: 0.18,
    test: (f) => f.account_age_days < 30 && f.amount_to_customer_average >= 3,
  },
  {
    id: "NEW_DEVICE_SHORT_SESSION",
    reason: "ABBREVIATED_SESSION_NEW_DEVICE",
    severity: "LOW",
    weight: 0.06,
    test: (f) => f.is_new_device && f.session_duration_seconds < 10,
  },
];

function engineerFeatures(req) {
  return {
    amount_to_customer_average: req.amount / (req.average_transaction_amount || 1),
    cross_border_transaction: req.country !== req.customer_home_country,
    ip_country_mismatch: req.ip_country !== req.customer_home_country,
    transaction_country_mismatch: req.country !== req.ip_country,
    merchant_high_risk:
      req.merchant_risk_score >= 70 || ["crypto", "gambling"].includes(req.merchant_category),
    customer_high_risk: req.customer_risk_score >= 70,
    is_new_device: req.is_new_device,
    is_new_beneficiary: req.is_new_beneficiary,
    transactions_last_10_minutes: req.transactions_last_10_minutes,
    failed_attempts_last_24_hours: req.failed_attempts_last_24_hours,
    days_since_last_transaction: req.days_since_last_transaction,
    account_age_days: req.account_age_days,
    session_duration_seconds: req.session_duration_seconds,
  };
}

// 3-tier risk % bucketing for display: 0-30 low, 31-60 medium, 61-100 high.
function riskLevelFor(score) {
  if (score >= 61) return "HIGH";
  if (score >= 31) return "MEDIUM";
  return "LOW";
}

// Decision severity keeps its own finer-grained score thresholds (independent
// of the 3-tier risk_level label above) so APPROVE/MONITOR/STEP_UP_AUTH/
// MANUAL_REVIEW/DECLINE keep behaving the same as before that label changed.
function decisionFor(score, hitIds, features) {
  const holdOverride =
    features.is_new_device &&
    features.is_new_beneficiary &&
    features.amount_to_customer_average >= 5;

  if (holdOverride) return "HOLD";
  if (score >= 75) return "DECLINE";
  if (score >= 50) return "MANUAL_REVIEW";
  if (score >= 25) {
    const stepUpTriggers = ["NEW_DEVICE", "IP_COUNTRY_MISMATCH", "TRANSACTION_COUNTRY_MISMATCH"];
    return hitIds.some((id) => stepUpTriggers.includes(id)) ? "STEP_UP_AUTH" : "MONITOR";
  }
  return hitIds.length > 0 ? "MONITOR" : "APPROVE";
}

const RECOMMENDED_ACTION = {
  APPROVE: "Process normally",
  MONITOR: "Process normally, flagged for passive monitoring",
  STEP_UP_AUTH: "Trigger step-up authentication (OTP/biometric) before completing",
  MANUAL_REVIEW: "Route to analyst queue for manual review before completing",
  DECLINE: "Decline transaction",
  HOLD: "Decline or hold, subject to mandatory bank policy",
};

function randomHex(len) {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function scoreTransaction(req) {
  const features = engineerFeatures(req);
  const hits = RULES.filter((r) => r.test(features));
  const rawScore = hits.reduce((sum, r) => sum + r.weight, 0);
  const score = Math.max(0, Math.min(1, rawScore));

  const riskScore = Math.round(score * 1000) / 10; // 0-100, 1 decimal
  const riskLevel = riskLevelFor(riskScore);
  const decision = decisionFor(riskScore, hits.map((h) => h.id), features);

  const topFactors = [...hits]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((r) => ({
      feature: featureNameFor(r.id),
      importance: Math.round((r.weight / (rawScore || 1)) * score * 1000) / 1000,
      direction: "increases_risk",
    }));

  return {
    transaction_id: req.transaction_id,
    decision_id: `DEC-${randomHex(10)}`,
    risk_score: riskScore,
    fraud_probability: Math.round(score * 10000) / 10000,
    risk_level: riskLevel,
    decision,
    recommended_action: RECOMMENDED_ACTION[decision],
    rule_hits: hits.map((h) => ({ rule_id: h.id, severity: h.severity, rule_version: "1.0" })),
    reason_codes: hits.map((h) => h.reason),
    top_model_factors: topFactors,
    model_version: "vaaligard-lgbm-0.1.0",
    feature_set_version: "features-v1.0.0",
    ruleset_version: "rules-1.0.0",
    decision_policy_version: "policy-v1.0.0",
    processing_time_ms: Math.round((5 + Math.random() * 15) * 100) / 100,
    idempotent: false,
    account_id: req.account_id || null,
    beneficiary_id: req.beneficiary_id || null,
  };
}

function featureNameFor(ruleId) {
  const map = {
    AMOUNT_ABOVE_5X_BASELINE: "amount_to_customer_average",
    AMOUNT_ABOVE_2X_BASELINE: "amount_to_customer_average",
    NEW_DEVICE: "is_new_device",
    NEW_BENEFICIARY: "is_new_beneficiary",
    CROSS_BORDER_TRANSACTION: "cross_border_transaction",
    IP_COUNTRY_MISMATCH: "ip_country_mismatch",
    TRANSACTION_COUNTRY_MISMATCH: "transaction_country_mismatch",
    HIGH_RISK_MERCHANT: "merchant_risk_score",
    HIGH_RISK_CUSTOMER: "customer_risk_score",
    VELOCITY_ABUSE: "transactions_last_10_minutes",
    AUTH_FAILURES_DETECTED: "failed_attempts_last_24_hours",
    DORMANT_ACCOUNT_REACTIVATION: "days_since_last_transaction",
    NEW_ACCOUNT_HIGH_VALUE: "account_age_days",
    NEW_DEVICE_SHORT_SESSION: "session_duration_seconds",
  };
  return map[ruleId] ?? ruleId.toLowerCase();
}
