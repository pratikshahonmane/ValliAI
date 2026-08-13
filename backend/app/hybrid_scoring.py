"""The hybrid decision layer: blends the trained XGBoost model's fraud
probability with the YAML rules engine's rule-based score into one
transaction-scoring response.

- fraud_probability is the model's raw, calibrated probability estimate.
- risk_score/risk_level (the 0-30/31-60/61-100 green/orange/red buckets the
  frontend renders) come from a blend of the model and the rules engine, so
  a transaction that trips several analyst-authored rules still reads as
  elevated risk even in the rare case the model itself is lukewarm on it.
- decision (APPROVE/MONITOR/STEP_UP_AUTH/MANUAL_REVIEW/DECLINE/HOLD) is
  driven by the model's raw probability against the cost-function-calibrated
  thresholds from training (see train/train_model.py), since those
  thresholds were tuned specifically against that probability's calibration.
- top_model_factors are the model's real per-prediction SHAP contributions,
  not an approximation -- this is the "SHAP values computed per-decision"
  piece of the audit trail.
"""

import secrets
import time

from . import ml_model, rules_engine
from .feature_engineering import engineer_features

MODEL_WEIGHT = 0.65  # blend weight for risk_score/risk_level display only

RECOMMENDED_ACTION = {
    "APPROVE": "Process normally",
    "MONITOR": "Process normally, flagged for passive monitoring",
    "STEP_UP_AUTH": "Trigger step-up authentication (OTP/biometric) before completing",
    "MANUAL_REVIEW": "Route to analyst queue for manual review before completing",
    "DECLINE": "Decline transaction",
    "HOLD": "Decline or hold, subject to mandatory bank policy",
}

STEP_UP_TRIGGER_RULES = ("NEW_DEVICE", "IP_COUNTRY_MISMATCH", "TRANSACTION_COUNTRY_MISMATCH")


# 3-tier risk % bucketing for display: 0-30 low (green), 31-60 medium
# (orange), 61-100 high (red) -- matches the frontend's RISK_LEVEL_META.
def risk_level_for(score: float) -> str:
    if score >= 61:
        return "HIGH"
    if score >= 31:
        return "MEDIUM"
    return "LOW"


def decision_for(model_prob: float, hit_ids: list, features: dict, thresholds: dict) -> str:
    hold_override = (
        features["is_new_device"]
        and features["is_new_beneficiary"]
        and features["amount_to_customer_average"] >= 5
    )
    if hold_override:
        return "HOLD"
    if model_prob >= thresholds["decline"]:
        return "DECLINE"
    if model_prob >= thresholds["manual_review"]:
        return "MANUAL_REVIEW"
    if model_prob >= thresholds["step_up"]:
        return "STEP_UP_AUTH" if any(hid in STEP_UP_TRIGGER_RULES for hid in hit_ids) else "MONITOR"
    return "MONITOR" if hit_ids else "APPROVE"


def _top_factors(shap_values: dict, limit=3) -> list:
    # Risk-increasing contributions first (the frontend's explanation copy
    # reads these as "flagged as X risk, mainly due to ..."), each ranked by
    # magnitude; only fall back to protective (risk-decreasing) factors to
    # fill out the list when there aren't enough risk-increasing ones.
    increasing = sorted((kv for kv in shap_values.items() if kv[1] >= 0), key=lambda kv: kv[1], reverse=True)
    decreasing = sorted((kv for kv in shap_values.items() if kv[1] < 0), key=lambda kv: kv[1])
    ranked = (increasing + decreasing)[:limit]
    return [
        {
            "feature": name,
            "importance": round(abs(value), 4),
            "direction": "increases_risk" if value >= 0 else "decreases_risk",
        }
        for name, value in ranked
    ]


def score_transaction(req: dict) -> dict:
    start = time.perf_counter()

    features = engineer_features(req)
    rules_result = rules_engine.evaluate(features)
    model_result = ml_model.predict(features)

    model_prob = model_result["probability"]
    combined = max(0.0, min(1.0, MODEL_WEIGHT * model_prob + (1 - MODEL_WEIGHT) * rules_result["rules_score"]))

    risk_score = round(combined * 1000) / 10  # 0-100, 1 decimal
    risk_level = risk_level_for(risk_score)
    decision = decision_for(model_prob, rules_result["hit_ids"], features, ml_model.MODEL_META["thresholds"])

    processing_time_ms = round((time.perf_counter() - start) * 1000 * 100) / 100

    return {
        "transaction_id": req["transaction_id"],
        "decision_id": f"DEC-{secrets.token_hex(5)}",
        "risk_score": risk_score,
        "fraud_probability": round(model_prob * 10000) / 10000,
        "risk_level": risk_level,
        "decision": decision,
        "recommended_action": RECOMMENDED_ACTION[decision],
        "rule_hits": rules_result["rule_hits"],
        "reason_codes": rules_result["reason_codes"],
        "top_model_factors": _top_factors(model_result["shap_values"]),
        "model_version": ml_model.MODEL_META["version"],
        "feature_set_version": "features-v1.0.0",
        "ruleset_version": rules_engine.RULES_VERSION,
        "decision_policy_version": ml_model.MODEL_META["version"],
        "processing_time_ms": processing_time_ms,
        "idempotent": False,
        "account_id": req.get("account_id"),
        "beneficiary_id": req.get("beneficiary_id"),
    }
