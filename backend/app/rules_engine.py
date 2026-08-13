"""Loads backend/app/rules.yaml and evaluates it against an engineered
feature dict. A small structured condition format (feature/op/value) is used
instead of eval()-ing expressions from the YAML file, since rule conditions
never need to be more expressive than comparisons.
"""

import operator
from pathlib import Path

import yaml

RULES_PATH = Path(__file__).parent / "rules.yaml"

_OPS = {
    "gte": operator.ge,
    "gt": operator.gt,
    "lte": operator.le,
    "lt": operator.lt,
    "eq": operator.eq,
    "in": lambda a, b: a in b,
}


def _load():
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        doc = yaml.safe_load(f)
    return doc["version"], doc["rules"]


RULES_VERSION, RULES = _load()


def _rule_matches(rule: dict, features: dict) -> bool:
    for cond in rule["conditions"]:
        op_fn = _OPS[cond["op"]]
        if not op_fn(features[cond["feature"]], cond["value"]):
            return False
    return True


def evaluate(features: dict) -> dict:
    """Returns the matched rules, the summed/capped rules-only risk
    component (0-1), and the rule_hits/reason_codes shapes the API returns.
    """
    hits = [r for r in RULES if _rule_matches(r, features)]
    raw_score = sum(r["weight"] for r in hits)
    rules_score = max(0.0, min(1.0, raw_score))

    return {
        "hits": hits,
        "rules_score": rules_score,
        "rule_hits": [{"rule_id": h["id"], "severity": h["severity"], "rule_version": "1.0"} for h in hits],
        "reason_codes": [h["reason"] for h in hits],
        "hit_ids": [h["id"] for h in hits],
    }
