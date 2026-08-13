import { useMemo, useState } from "react";
import { useTransactions } from "../context/TransactionContext";
import { DECISION_META } from "../lib/decisions";
import { exportTransactionsCsv } from "../lib/csv";
import DecisionBadge from "../components/DecisionBadge";
import RiskLevelPill from "../components/RiskLevelPill";
import ResultPanel from "../components/ResultPanel";
import Icon from "../components/Icon";
import "./Report.css";

const DECISION_FILTERS = ["ALL", ...Object.keys(DECISION_META)];
const RISK_FILTERS = ["ALL", "LOW", "MEDIUM", "HIGH"];

export default function Report() {
  const { records } = useTransactions();
  const [decisionFilter, setDecisionFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter(({ request, response }) => {
      if (decisionFilter !== "ALL" && response.decision !== decisionFilter) return false;
      if (riskFilter !== "ALL" && response.risk_level !== riskFilter) return false;
      if (q) {
        const hay = `${request.transaction_id} ${request.customer_id} ${request.merchant_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, decisionFilter, riskFilter, search]);

  const selected = filtered.find((r) => r.request.transaction_id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Report</h1>
        <p>Full history of analyzed transactions -- filter, inspect, and export.</p>
      </div>

      <div className="report-toolbar">
        <div className="report-search">
          <Icon name="search" size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search transaction, customer, or merchant ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)}>
          {DECISION_FILTERS.map((d) => (
            <option key={d} value={d}>
              {d === "ALL" ? "All decisions" : DECISION_META[d].label}
            </option>
          ))}
        </select>

        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
          {RISK_FILTERS.map((r) => (
            <option key={r} value={r}>
              {r === "ALL" ? "All risk levels" : r}
            </option>
          ))}
        </select>

        <button className="btn-secondary" onClick={() => exportTransactionsCsv(filtered)}>
          <Icon name="download" size={14} />
          Export CSV
        </button>
      </div>

      <div className="report-layout">
        <div className="report-table-wrap scroll-x">
          <table className="report-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Transaction</th>
                <th>Customer</th>
                <th>Merchant</th>
                <th>Amount</th>
                <th>Decision</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="report-empty">
                    No transactions match these filters.
                  </td>
                </tr>
              )}
              {filtered.map(({ request, response, analyzedAt }) => (
                <tr
                  key={request.transaction_id}
                  className={selected?.request.transaction_id === request.transaction_id ? "active" : ""}
                  onClick={() => setSelectedId(request.transaction_id)}
                >
                  <td className="muted">{new Date(analyzedAt).toLocaleString()}</td>
                  <td className="mono">{request.transaction_id}</td>
                  <td>{request.customer_id}</td>
                  <td>{request.merchant_id}</td>
                  <td className="tabular">
                    {request.amount.toLocaleString(undefined, { style: "currency", currency: request.currency })}
                  </td>
                  <td>
                    <DecisionBadge decision={response.decision} size="sm" />
                  </td>
                  <td>
                    <RiskLevelPill level={response.risk_level} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="report-count">
            {filtered.length.toLocaleString()} of {records.length.toLocaleString()} transactions
          </div>
        </div>

        <div className="report-detail">
          {selected ? (
            <>
              <div className="report-detail-head">
                <span className="mono">{selected.request.transaction_id}</span>
                <span className="muted">{new Date(selected.analyzedAt).toLocaleString()}</span>
              </div>
              <ResultPanel response={selected.response} />
            </>
          ) : (
            <div className="result-placeholder">
              <Icon name="file" size={28} color="var(--text-muted)" />
              <p>Select a row to view the full decision detail.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
