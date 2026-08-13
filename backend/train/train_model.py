"""Trains the XGBoost half of the hybrid scoring engine on
backend/train/data/transactions.csv (see generate_synthetic_data.py).

- 70/15/15 TIME-BASED split (not shuffled): the dataset is already sorted by
  transaction_time, so train is strictly earlier than validation, which is
  strictly earlier than test. This prevents the model from ever training on
  a transaction that happened after one it's being validated/tested on.
- Decision thresholds (step-up / manual review / decline) are picked by
  minimizing an expected-cost function on the validation set, not by
  maximizing raw accuracy -- see pick_threshold() below.
- Feature engineering is imported from app/feature_engineering.py, the same
  module the live API uses, so there's exactly one code path from raw
  transaction fields to model input.

Run: backend/.venv/Scripts/python backend/train/train_model.py
Output: backend/app/artifacts/xgb_model.json, backend/app/artifacts/model_meta.json
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import average_precision_score, roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.feature_engineering import FEATURE_ORDER, engineer_features  # noqa: E402

DATA_PATH = Path(__file__).parent / "data" / "transactions.csv"
ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "app" / "artifacts"

# Expected-cost assumptions behind the decision ladder: how bad is a missed
# fraud (false negative) vs. how annoying is a wrongly-flagged legitimate
# transaction (false positive), per action. Declining a good transaction is
# far more disruptive to a customer than asking for step-up auth, so it
# demands more confidence (a higher threshold) before firing.
COST_FRAUD_LOSS = 250.0  # assumed average loss if a fraud transaction goes through undetected
ACTION_COSTS = {
    "step_up": 12.5,  # cheap: one extra OTP/biometric prompt, but not free -- still customer friction
    "manual_review": 37.5,  # analyst time + delay
    "decline": 90.0,  # blocked legitimate transaction -- the costliest friction (churn risk)
}


def build_feature_matrix(df: pd.DataFrame) -> pd.DataFrame:
    rows = [engineer_features(r) for r in df.to_dict("records")]
    return pd.DataFrame(rows, columns=FEATURE_ORDER)


def pick_threshold(y_true, probs, cost_fp) -> float:
    best_threshold, best_cost = 0.5, float("inf")
    for t in np.arange(0.01, 0.99, 0.01):
        pred = probs >= t
        fn = int(((y_true == 1) & ~pred).sum())
        fp = int(((y_true == 0) & pred).sum())
        cost = fn * COST_FRAUD_LOSS + fp * cost_fp
        if cost < best_cost:
            best_cost, best_threshold = cost, float(t)
    return best_threshold


def main():
    df = pd.read_csv(DATA_PATH, parse_dates=["transaction_time"])
    df = df.sort_values("transaction_time").reset_index(drop=True)

    n = len(df)
    train_end = int(n * 0.70)
    val_end = int(n * 0.85)
    train_df, val_df, test_df = df.iloc[:train_end], df.iloc[train_end:val_end], df.iloc[val_end:]

    X_train, y_train = build_feature_matrix(train_df), train_df["is_fraud"].to_numpy()
    X_val, y_val = build_feature_matrix(val_df), val_df["is_fraud"].to_numpy()
    X_test, y_test = build_feature_matrix(test_df), test_df["is_fraud"].to_numpy()

    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=FEATURE_ORDER)
    dval = xgb.DMatrix(X_val, label=y_val, feature_names=FEATURE_ORDER)
    dtest = xgb.DMatrix(X_test, label=y_test, feature_names=FEATURE_ORDER)

    params = {
        "objective": "binary:logistic",
        "eval_metric": "auc",
        "max_depth": 3,
        "eta": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "min_child_weight": 5,
        # No scale_pos_weight: it distorts predicted probabilities away from
        # the true fraud rate (great for ranking, bad for cost-based
        # thresholding, which needs calibrated probabilities to compare
        # against dollar-cost assumptions).
        "seed": 20260810,
    }

    booster = xgb.train(
        params,
        dtrain,
        num_boost_round=600,
        evals=[(dtrain, "train"), (dval, "validation")],
        early_stopping_rounds=50,
        verbose_eval=False,
    )

    val_probs = booster.predict(dval, iteration_range=(0, booster.best_iteration + 1))
    test_probs = booster.predict(dtest, iteration_range=(0, booster.best_iteration + 1))

    thresholds = {
        action: pick_threshold(y_val, val_probs, cost_fp) for action, cost_fp in ACTION_COSTS.items()
    }
    # Enforce the natural ordering of the decision ladder even if the cost
    # sweep lands two tiers on the same value for a small validation slice.
    thresholds["manual_review"] = max(thresholds["manual_review"], thresholds["step_up"])
    thresholds["decline"] = max(thresholds["decline"], thresholds["manual_review"])

    metrics = {
        "val_auc": round(float(roc_auc_score(y_val, val_probs)), 4),
        "val_pr_auc": round(float(average_precision_score(y_val, val_probs)), 4),
        "test_auc": round(float(roc_auc_score(y_test, test_probs)), 4),
        "test_pr_auc": round(float(average_precision_score(y_test, test_probs)), 4),
    }

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = ARTIFACTS_DIR / "xgb_model.json"
    booster.save_model(str(model_path))

    trained_at = datetime.now(timezone.utc).isoformat()
    meta = {
        "version": f"vaaligard-xgb-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "trained_at": trained_at,
        "feature_order": FEATURE_ORDER,
        "best_iteration": booster.best_iteration,
        "thresholds": thresholds,
        "cost_assumptions": {"fraud_loss": COST_FRAUD_LOSS, "action_costs": ACTION_COSTS},
        "metrics": metrics,
        "split": {"train_rows": len(train_df), "val_rows": len(val_df), "test_rows": len(test_df)},
        "fraud_rate": round(float(df["is_fraud"].mean()), 4),
    }
    with open(ARTIFACTS_DIR / "model_meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"Trained on {len(train_df):,} / validated on {len(val_df):,} / tested on {len(test_df):,} rows")
    print(f"Best iteration: {booster.best_iteration}")
    print(f"Metrics: {metrics}")
    print(f"Thresholds (probability of fraud): {thresholds}")
    print(f"Saved model -> {model_path}")


if __name__ == "__main__":
    main()
