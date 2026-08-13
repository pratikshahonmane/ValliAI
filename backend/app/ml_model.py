"""Loads the trained XGBoost booster + its metadata once at import time, and
exposes predictions plus native SHAP contributions (XGBoost's built-in
pred_contribs) for per-decision explainability -- no separate `shap` package
needed, since XGBoost computes exact SHAP values itself from the trees.
"""

import json
from pathlib import Path

import xgboost as xgb

from .feature_engineering import FEATURE_ORDER

ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "xgb_model.json"
META_PATH = ARTIFACTS_DIR / "model_meta.json"

if not MODEL_PATH.exists() or not META_PATH.exists():
    raise RuntimeError(
        "No trained model artifacts found in backend/app/artifacts/. From backend/, run:\n"
        "  .venv/Scripts/python train/generate_synthetic_data.py\n"
        "  .venv/Scripts/python train/train_model.py"
    )

with open(META_PATH, "r", encoding="utf-8") as f:
    MODEL_META = json.load(f)

_booster = xgb.Booster()
_booster.load_model(str(MODEL_PATH))


def predict(features: dict) -> dict:
    """Returns the model's fraud probability for this transaction plus a
    feature -> SHAP contribution map (signed: positive pushes risk up,
    negative pushes it down).
    """
    vector = [[features[name] for name in FEATURE_ORDER]]
    dmatrix = xgb.DMatrix(vector, feature_names=FEATURE_ORDER)

    probability = float(_booster.predict(dmatrix)[0])

    contribs = _booster.predict(dmatrix, pred_contribs=True)[0]
    shap_values = {name: float(v) for name, v in zip(FEATURE_ORDER, contribs[:-1])}
    # contribs[-1] is the bias/base-value term -- not tied to any one feature.

    return {"probability": probability, "shap_values": shap_values}
