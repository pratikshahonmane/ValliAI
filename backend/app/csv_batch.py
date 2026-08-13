"""CSV batch scoring: parses an uploaded CSV, coerces + validates each row
(port of the frontend's former src/lib/bulkProcessing.js coerceRow), and
scores the valid ones. Mirrors the column contract in the frontend's
src/lib/bulkTemplate.js.
"""

import csv
import io
import random
from datetime import datetime, timezone

from .hybrid_scoring import score_transaction

REQUIRED_HEADERS = [
    "customer_id",
    "merchant_id",
    "device_id",
    "amount",
    "currency",
    "country",
    "customer_home_country",
    "ip_country",
    "channel",
    "merchant_category",
    "device_age_days",
    "account_age_days",
    "average_transaction_amount",
]

TRUE_VALUES = {"true", "1", "yes", "y"}
FALSE_VALUES = {"false", "0", "no", "n", ""}


def _gen_transaction_id(used_ids: set) -> str:
    while True:
        candidate = f"txn_{random.randint(100000, 999999)}"
        if candidate not in used_ids:
            return candidate


def _parse_bool(raw, field, errors):
    v = (raw or "").strip().lower()
    if v in TRUE_VALUES:
        return True
    if v in FALSE_VALUES:
        return False
    errors.append(f'{field}: "{raw}" is not a recognized true/false value')
    return False


def _parse_required_number(raw, field, errors, integer=False, positive=False):
    raw_str = "" if raw is None else str(raw).strip()
    try:
        n = float(raw_str)
    except ValueError:
        errors.append(f'{field}: "{raw}" is not a number')
        return 0
    if integer and not n.is_integer():
        errors.append(f"{field}: must be a whole number")
        return round(n)
    if positive and n <= 0:
        errors.append(f"{field}: must be greater than 0")
    if n < 0:
        errors.append(f"{field}: must be ≥ 0")
        return 0
    return int(n) if integer else n


def _parse_optional_number(raw, fallback=0):
    if raw is None or str(raw).strip() == "":
        return fallback
    try:
        n = float(raw)
    except ValueError:
        return fallback
    return fallback if n < 0 else n


def _clamp(n, lo, hi):
    return max(lo, min(hi, n))


def _coerce_row(raw: dict, row_index: int, used_ids: set) -> dict:
    errors = []

    for field in REQUIRED_HEADERS:
        if not str(raw.get(field, "")).strip():
            errors.append(f"{field}: required")

    amount = _parse_required_number(raw.get("amount"), "amount", errors, positive=True)
    average_transaction_amount = _parse_required_number(
        raw.get("average_transaction_amount"), "average_transaction_amount", errors, positive=True
    )
    device_age_days = _parse_required_number(raw.get("device_age_days"), "device_age_days", errors, integer=True)
    account_age_days = _parse_required_number(raw.get("account_age_days"), "account_age_days", errors, integer=True)

    is_new_device = _parse_bool(raw.get("is_new_device"), "is_new_device", errors)
    is_new_beneficiary = _parse_bool(raw.get("is_new_beneficiary"), "is_new_beneficiary", errors)

    if is_new_beneficiary and not str(raw.get("beneficiary_id", "")).strip():
        errors.append("beneficiary_id: required when is_new_beneficiary is true")

    transaction_id = str(raw.get("transaction_id", "")).strip()
    if not transaction_id:
        transaction_id = _gen_transaction_id(used_ids)
    if transaction_id in used_ids:
        errors.append(f'transaction_id: "{transaction_id}" is duplicated in this file')
    used_ids.add(transaction_id)

    transaction_time = str(raw.get("transaction_time", "")).strip()
    parsed_time = None
    if transaction_time:
        try:
            parsed_time = datetime.fromisoformat(transaction_time.replace("Z", "+00:00"))
        except ValueError:
            parsed_time = None
    if parsed_time is None:
        parsed_time = datetime.now(timezone.utc)
    transaction_time = parsed_time.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    if errors:
        return {"rowIndex": row_index, "error": "; ".join(errors), "raw": raw}

    request = {
        "transaction_id": transaction_id,
        "customer_id": raw["customer_id"].strip(),
        "account_id": (raw.get("account_id") or "").strip() or None,
        "merchant_id": raw["merchant_id"].strip(),
        "device_id": raw["device_id"].strip(),
        "beneficiary_id": raw.get("beneficiary_id", "").strip() if is_new_beneficiary else None,
        "amount": round(amount * 100) / 100,
        "currency": raw["currency"].strip().upper(),
        "country": raw["country"].strip().upper(),
        "customer_home_country": raw["customer_home_country"].strip().upper(),
        "ip_country": raw["ip_country"].strip().upper(),
        "channel": raw["channel"].strip().lower(),
        "merchant_category": raw["merchant_category"].strip().lower(),
        "transaction_time": transaction_time,
        "session_duration_seconds": _parse_optional_number(raw.get("session_duration_seconds")),
        "device_age_days": device_age_days,
        "account_age_days": account_age_days,
        "average_transaction_amount": round(average_transaction_amount * 100) / 100,
        "transactions_last_10_minutes": _parse_optional_number(raw.get("transactions_last_10_minutes")),
        "failed_attempts_last_24_hours": _parse_optional_number(raw.get("failed_attempts_last_24_hours")),
        "days_since_last_transaction": _parse_optional_number(raw.get("days_since_last_transaction")),
        "merchant_risk_score": _clamp(_parse_optional_number(raw.get("merchant_risk_score")), 0, 100),
        "customer_risk_score": _clamp(_parse_optional_number(raw.get("customer_risk_score")), 0, 100),
        "is_new_device": is_new_device,
        "is_new_beneficiary": is_new_beneficiary,
    }

    return {"rowIndex": row_index, "request": request}


def process_csv_batch(raw_text: str) -> list:
    text = raw_text.lstrip("﻿")  # strip BOM
    reader = csv.DictReader(io.StringIO(text))
    rows = [{(k or "").strip(): (v or "").strip() for k, v in row.items()} for row in reader]

    used_ids = set()
    results = []
    for i, raw in enumerate(rows):
        coerced = _coerce_row(raw, i, used_ids)
        if "error" in coerced:
            results.append(coerced)
        else:
            response = score_transaction(coerced["request"])
            results.append({"rowIndex": i, "request": coerced["request"], "response": response})
    return results
