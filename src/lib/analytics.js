export function aggregateOverview(records) {
  const total = records.length;
  const byDecision = {};
  const ruleCounts = {};
  let riskSum = 0;
  let procTimeSum = 0;

  for (const { response } of records) {
    byDecision[response.decision] = (byDecision[response.decision] ?? 0) + 1;
    riskSum += response.risk_score;
    procTimeSum += response.processing_time_ms;
    for (const hit of response.rule_hits) {
      ruleCounts[hit.rule_id] = (ruleCounts[hit.rule_id] ?? 0) + 1;
    }
  }

  const declineLike = (byDecision.DECLINE ?? 0) + (byDecision.HOLD ?? 0);

  return {
    total,
    avgRiskScore: total ? riskSum / total : 0,
    avgProcessingMs: total ? procTimeSum / total : 0,
    declineRate: total ? declineLike / total : 0,
    byDecision,
    topRules: Object.entries(ruleCounts)
      .map(([rule_id, count]) => ({ rule_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
  };
}

export function dailyRiskTrend(records, days = 14) {
  const now = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.push({ key: d.toISOString().slice(0, 10), sum: 0, count: 0 });
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));

  for (const { request, response } of records) {
    const key = (request.transaction_time ?? "").slice(0, 10);
    const bucket = byKey[key];
    if (bucket) {
      bucket.sum += response.risk_score;
      bucket.count += 1;
    }
  }

  return buckets.map((b) => ({
    date: b.key.slice(5),
    avgRisk: b.count ? Math.round((b.sum / b.count) * 10) / 10 : 0,
    count: b.count,
  }));
}
