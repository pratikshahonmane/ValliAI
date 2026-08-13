"""Generates a synthetic labeled transaction history for training, since no
real historical data is available for this prototype. Each customer's
transactions are simulated in chronological order and every velocity/
behavioral feature (transactions_last_10_minutes, days_since_last_transaction,
is_new_device, average_transaction_amount, ...) is computed causally from
only that customer's *prior* events -- never from transactions that happen
later -- so the resulting dataset has no lookahead bias baked in before it
even reaches the time-based train/validation/test split in train_model.py.

Run: backend/.venv/Scripts/python backend/train/generate_synthetic_data.py
Output: backend/train/data/transactions.csv
"""

import math
import random
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

random.seed(20260810)

N_CUSTOMERS = 2500
SIM_DAYS = 270
SIM_START = datetime(2025, 12, 1)

COUNTRIES = ["AE", "AU", "BR", "GB", "IN", "MY", "SG", "US"]
CHANNELS = ["api", "atm", "mobile_app", "pos", "web"]
MERCHANT_CATEGORIES = [
    ("grocery", 0.22), ("restaurant", 0.16), ("fuel", 0.12), ("fashion", 0.12),
    ("electronics", 0.10), ("travel", 0.08), ("pharmacy", 0.08), ("utilities", 0.06),
    ("gambling", 0.03), ("crypto", 0.03),
]

N_MERCHANTS = 60
MERCHANTS = []
for i in range(N_MERCHANTS):
    category = random.choices([c for c, _ in MERCHANT_CATEGORIES], weights=[w for _, w in MERCHANT_CATEGORIES])[0]
    base_risk = 65 + random.random() * 30 if category in ("crypto", "gambling") else random.random() * 45
    MERCHANTS.append({"id": f"merchant_{200 + i}", "category": category, "risk_score": round(base_risk)})


def sigmoid(x):
    return 1 / (1 + math.exp(-x))


def gen_customer(cust_idx):
    home_country = random.choice(COUNTRIES)
    base_amount_mean = 20 + random.random() * 250
    activity_level = random.choice([6, 12, 20, 32, 45])  # ~ total transactions over the sim window
    customer_risk_score = min(100, max(0, round(random.gammavariate(2, 8))))
    account_created = SIM_START - timedelta(days=random.randint(10, 1400))
    devices = [f"device_{cust_idx}_0"]
    beneficiaries = []

    events = []
    history_amounts = []
    last_txn_time = None

    def emit(t):
        nonlocal last_txn_time
        is_new_device = random.random() < 0.06 or len(devices) == 0
        if is_new_device:
            devices.append(f"device_{cust_idx}_{len(devices)}")
        device_id = devices[-1] if is_new_device else random.choice(devices)

        is_new_beneficiary = random.random() < 0.05
        if is_new_beneficiary:
            beneficiaries.append(f"BEN_{cust_idx}_{len(beneficiaries)}")
        beneficiary_id = beneficiaries[-1] if (is_new_beneficiary or (beneficiaries and random.random() < 0.15)) else None

        spike = random.random() < 0.05
        amount_mult = (4 + random.random() * 10) if spike else max(0.1, random.gauss(1, 0.5))
        amount = round(max(1, base_amount_mean * amount_mult), 2)

        avg_amount = round(sum(history_amounts) / len(history_amounts), 2) if history_amounts else base_amount_mean

        txns_last_10min = sum(
            1 for pt in events[-6:] if (t - pt["transaction_time"]).total_seconds() <= 600
        )
        days_since_last = (t - last_txn_time).days if last_txn_time else 0

        travel = random.random() < 0.10
        country = random.choice(COUNTRIES) if travel else home_country
        ip_mismatch = random.random() < 0.06
        ip_country = random.choice(COUNTRIES) if ip_mismatch else country

        merchant = random.choice(MERCHANTS)

        failed_attempts = 0
        if random.random() < 0.06:
            failed_attempts = random.randint(1, 2)
        if random.random() < 0.015:
            failed_attempts = random.randint(3, 6)

        account_age_days = (t - account_created).days
        session_duration = max(1, int(random.gauss(6, 4))) if is_new_device and random.random() < 0.3 else max(3, int(random.gauss(60, 40)))

        amount_to_avg = amount / (avg_amount or 1)
        merchant_high_risk = merchant["risk_score"] >= 70 or merchant["category"] in ("crypto", "gambling")
        customer_high_risk = customer_risk_score >= 70

        logit = (
            -4.0
            + 1.8 * (amount_to_avg >= 5)
            + 0.9 * (2 <= amount_to_avg < 5)
            + 1.3 * is_new_device
            + 1.0 * (beneficiary_id is not None and is_new_beneficiary)
            + 1.1 * (ip_country != home_country)
            + 0.8 * (country != ip_country)
            + 1.4 * (txns_last_10min >= 4)
            + 1.0 * (failed_attempts >= 3)
            + 1.1 * (account_age_days < 30 and amount_to_avg >= 3)
            + 0.8 * merchant_high_risk
            + 0.6 * customer_high_risk
            + random.gauss(0, 0.45)
        )
        is_fraud = 1 if random.random() < sigmoid(logit) else 0

        events.append({
            "transaction_id": f"txn_{cust_idx}_{len(events)}",
            "customer_id": f"cust_{1000 + cust_idx}",
            "merchant_id": merchant["id"],
            "device_id": device_id,
            "beneficiary_id": beneficiary_id or "",
            "amount": amount,
            "currency": "SGD",
            "country": country,
            "customer_home_country": home_country,
            "ip_country": ip_country,
            "channel": random.choice(CHANNELS),
            "merchant_category": merchant["category"],
            "merchant_risk_score": merchant["risk_score"],
            "customer_risk_score": customer_risk_score,
            "transaction_time": t,
            "session_duration_seconds": session_duration,
            "device_age_days": 0 if is_new_device else random.randint(1, 900),
            "account_age_days": account_age_days,
            "average_transaction_amount": avg_amount,
            "transactions_last_10_minutes": txns_last_10min,
            "failed_attempts_last_24_hours": failed_attempts,
            "days_since_last_transaction": days_since_last,
            "is_new_device": int(is_new_device),
            "is_new_beneficiary": int(is_new_beneficiary and beneficiary_id is not None),
            "is_fraud": is_fraud,
        })

        history_amounts.append(amount)
        last_txn_time = t

    t = SIM_START + timedelta(days=random.random() * 5)
    n_events = max(1, int(random.gauss(activity_level, activity_level * 0.3)))
    for _ in range(n_events):
        gap_days = random.expovariate(1 / (SIM_DAYS / max(activity_level, 1)))
        t = t + timedelta(days=gap_days, minutes=random.random() * 5)
        if t > SIM_START + timedelta(days=SIM_DAYS):
            break
        emit(t)

        # Occasionally simulate a card-testing / velocity-abuse burst: several
        # rapid-fire transactions seconds apart, right after a normal one.
        if random.random() < 0.035:
            burst_t = t
            for _ in range(random.randint(3, 6)):
                burst_t = burst_t + timedelta(seconds=20 + random.random() * 90)
                if burst_t > SIM_START + timedelta(days=SIM_DAYS):
                    break
                emit(burst_t)
            t = burst_t

    return events


def main():
    all_events = []
    for i in range(N_CUSTOMERS):
        all_events.extend(gen_customer(i))

    df = pd.DataFrame(all_events)
    df = df.sort_values("transaction_time").reset_index(drop=True)

    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "transactions.csv"
    df.to_csv(out_path, index=False)

    print(f"Wrote {len(df):,} rows to {out_path}")
    print(f"Fraud rate: {df['is_fraud'].mean():.3%}")
    print(f"Date range: {df['transaction_time'].min()} -> {df['transaction_time'].max()}")


if __name__ == "__main__":
    main()
