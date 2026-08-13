import { SAMPLE_CUSTOMERS, SAMPLE_MERCHANTS, COUNTRIES } from "./sampleData";
import { scoreTransaction } from "./mockScoring";

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

// Small deterministic PRNG so the seed dataset (and therefore the Overview
// dashboard on first login) looks the same across reloads until real
// transactions push it out.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSeedTransactions(count = 42) {
  const rand = mulberry32(20260731);
  const out = [];

  for (let i = 0; i < count; i++) {
    const customer = pick(SAMPLE_CUSTOMERS, rand);
    const merchant = pick(SAMPLE_MERCHANTS, rand);
    const country = pick(COUNTRIES, rand).code;
    const ipCountry = rand() < 0.78 ? country : pick(COUNTRIES, rand).code;
    const avgAmount = Math.round((20 + rand() * 300) * 100) / 100;
    const amountMultiplier =
      rand() < 0.08 ? 6 + rand() * 10 : rand() < 0.25 ? 2 + rand() * 3 : 0.3 + rand() * 1.6;
    const amount = Math.round(avgAmount * amountMultiplier * 100) / 100;
    const isNewDevice = rand() < 0.55; // mirrors the cold-start calibration issue in v2 spec
    const isNewBeneficiary = rand() < 0.12;
    const daysAgo = Math.floor(rand() * 60);
    const txnTime = new Date(Date.now() - daysAgo * 86400000 - Math.floor(rand() * 86400000));

    const request = {
      transaction_id: `txn_${100000 + i}`,
      customer_id: customer.id,
      account_id: `acc_${900 + i}`,
      merchant_id: merchant.id,
      device_id: `device_${10 + Math.floor(rand() * 900)}`,
      beneficiary_id: isNewBeneficiary ? `BEN_${100 + Math.floor(rand() * 900)}` : null,
      amount,
      currency: "SGD",
      country,
      customer_home_country: customer.homeCountry,
      ip_country: ipCountry,
      channel: pick(["api", "atm", "mobile_app", "pos", "web"], rand),
      merchant_category: merchant.category,
      transaction_time: txnTime.toISOString(),
      session_duration_seconds: Math.floor(rand() * 180),
      device_age_days: isNewDevice ? Math.floor(rand() * 2) : Math.floor(rand() * 900),
      account_age_days: 30 + Math.floor(rand() * 1500),
      average_transaction_amount: avgAmount,
      transactions_last_10_minutes: rand() < 0.06 ? 4 + Math.floor(rand() * 4) : Math.floor(rand() * 3),
      failed_attempts_last_24_hours: rand() < 0.08 ? 3 + Math.floor(rand() * 3) : 0,
      days_since_last_transaction: rand() < 0.1 ? 180 + Math.floor(rand() * 200) : Math.floor(rand() * 30),
      merchant_risk_score:
        merchant.category === "crypto" || merchant.category === "gambling"
          ? 60 + Math.floor(rand() * 40)
          : Math.floor(rand() * 50),
      customer_risk_score: Math.floor(rand() * 100),
      is_new_device: isNewDevice,
      is_new_beneficiary: isNewBeneficiary,
    };

    const response = scoreTransaction(request);
    out.push({
      request,
      response,
      analyzedAt: txnTime.toISOString(),
    });
  }

  return out.sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt));
}
