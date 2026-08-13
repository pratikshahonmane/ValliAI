// CSV/JSON row formatting for downloading batch scoring results. Parsing,
// validation and scoring itself now happen server-side (see
// backend/app/csv_batch.py) -- this file only shapes the backend's results
// array into flat rows for the downloadable CSV.

export function buildOutputRows(results) {
  return results.map(({ request, response, error, raw }) => {
    if (error) {
      return { ...raw, status: "ERROR", error };
    }
    return {
      ...request,
      status: "OK",
      error: "",
      decision_id: response.decision_id,
      risk_score: response.risk_score,
      fraud_probability: response.fraud_probability,
      risk_level: response.risk_level,
      decision: response.decision,
      recommended_action: response.recommended_action,
      rule_hits: response.rule_hits.map((h) => h.rule_id).join(" | "),
      reason_codes: response.reason_codes.join(" | "),
      top_model_factors: response.top_model_factors
        .map((f) => `${f.feature}:${f.importance}`)
        .join(" | "),
      model_version: response.model_version,
      processing_time_ms: response.processing_time_ms,
    };
  });
}

export const OUTPUT_HEADERS = [
  "transaction_id",
  "customer_id",
  "account_id",
  "merchant_id",
  "device_id",
  "beneficiary_id",
  "amount",
  "currency",
  "country",
  "customer_home_country",
  "ip_country",
  "channel",
  "merchant_category",
  "transaction_time",
  "session_duration_seconds",
  "device_age_days",
  "account_age_days",
  "average_transaction_amount",
  "transactions_last_10_minutes",
  "failed_attempts_last_24_hours",
  "days_since_last_transaction",
  "merchant_risk_score",
  "customer_risk_score",
  "is_new_device",
  "is_new_beneficiary",
  "status",
  "error",
  "decision_id",
  "risk_score",
  "fraud_probability",
  "risk_level",
  "decision",
  "recommended_action",
  "rule_hits",
  "reason_codes",
  "top_model_factors",
  "model_version",
  "processing_time_ms",
];
