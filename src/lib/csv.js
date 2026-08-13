export function exportTransactionsCsv(records) {
  const headers = [
    "transaction_id",
    "analyzed_at",
    "customer_id",
    "merchant_id",
    "amount",
    "currency",
    "decision",
    "risk_score",
    "risk_level",
    "fraud_probability",
    "reason_codes",
  ];

  const rows = records.map(({ request, response, analyzedAt }) => [
    request.transaction_id,
    analyzedAt,
    request.customer_id,
    request.merchant_id,
    request.amount,
    request.currency,
    response.decision,
    response.risk_score,
    response.risk_level,
    response.fraud_probability,
    response.reason_codes.join(" | "),
  ]);

  const escape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vaaligard-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
