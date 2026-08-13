"""Single source of truth for turning a raw transaction dict into the
numeric feature vector the model trains and predicts on. Used by both
train/train_model.py (on the historical dataset) and app/ml_model.py (on a
single live request) so there is no train/serve skew.
"""

FEATURE_ORDER = [
    "amount_to_customer_average",
    "cross_border_transaction",
    "ip_country_mismatch",
    "transaction_country_mismatch",
    "merchant_high_risk",
    "customer_high_risk",
    "is_new_device",
    "is_new_beneficiary",
    "transactions_last_10_minutes",
    "failed_attempts_last_24_hours",
    "days_since_last_transaction",
    "account_age_days",
    "session_duration_seconds",
]

HIGH_RISK_MERCHANT_CATEGORIES = {"crypto", "gambling"}


def engineer_features(req: dict) -> dict:
    """req fields are all point-in-time-correct as of the transaction: the
    caller (frontend form, CSV row, or the synthetic data generator) is
    responsible for only ever populating velocity/behavioral fields (e.g.
    transactions_last_10_minutes, days_since_last_transaction) from events
    strictly before this transaction's timestamp.
    """
    return {
        "amount_to_customer_average": req["amount"] / (req["average_transaction_amount"] or 1),
        "cross_border_transaction": int(req["country"] != req["customer_home_country"]),
        "ip_country_mismatch": int(req["ip_country"] != req["customer_home_country"]),
        "transaction_country_mismatch": int(req["country"] != req["ip_country"]),
        "merchant_high_risk": int(
            req["merchant_risk_score"] >= 70 or req["merchant_category"] in HIGH_RISK_MERCHANT_CATEGORIES
        ),
        "customer_high_risk": int(req["customer_risk_score"] >= 70),
        "is_new_device": int(req["is_new_device"]),
        "is_new_beneficiary": int(req["is_new_beneficiary"]),
        "transactions_last_10_minutes": req["transactions_last_10_minutes"],
        "failed_attempts_last_24_hours": req["failed_attempts_last_24_hours"],
        "days_since_last_transaction": req["days_since_last_transaction"],
        "account_age_days": req["account_age_days"],
        "session_duration_seconds": req["session_duration_seconds"],
    }


def feature_vector(req: dict) -> list:
    features = engineer_features(req)
    return [features[name] for name in FEATURE_ORDER]
