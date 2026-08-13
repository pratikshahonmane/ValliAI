import { useEffect, useState } from "react";
import RiskGauge from "./RiskGauge";
import DecisionBadge from "./DecisionBadge";
import ExplanationCard from "./ExplanationCard";
import Icon from "./Icon";
import { SEVERITY_META } from "../lib/decisions";
import "./ResultPanel.css";

function AnimatedBar({ pct }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(raf);
  }, [pct]);
  return (
    <div className="factor-bar-track">
      <div className="factor-bar-fill" style={{ width: `${width}%` }} />
    </div>
  );
}

export default function ResultPanel({ response }) {
  const maxImportance = Math.max(0.01, ...response.top_model_factors.map((f) => f.importance));

  return (
    <div className="result-panel">
      <div className="result-top">
        <RiskGauge score={response.risk_score} level={response.risk_level} />
        <div className="result-decision">
          <DecisionBadge decision={response.decision} />
        </div>
      </div>

      <ExplanationCard response={response} />

      <details className="tech-details">
        <summary>
          <Icon name="chevronRight" size={14} className="tech-chevron" />
          Technical detail
        </summary>

        <div className="tech-details-body">
          {response.rule_hits.length > 0 && (
            <section className="result-section">
              <h4>Rule hits</h4>
              <ul className="rule-hit-list">
                {response.rule_hits.map((hit) => {
                  const meta = SEVERITY_META[hit.severity] ?? {
                    label: hit.severity,
                    color: "var(--text-muted)",
                  };
                  return (
                    <li key={hit.rule_id}>
                      <span className="dot" style={{ "--dot-color": meta.color }} />
                      <span className="rule-id">{hit.rule_id}</span>
                      <span className="rule-severity" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {response.reason_codes.length > 0 && (
            <section className="result-section">
              <h4>Reason codes</h4>
              <div className="reason-chips">
                {response.reason_codes.map((code) => (
                  <span key={code} className="reason-chip">
                    {code}
                  </span>
                ))}
              </div>
            </section>
          )}

          {response.top_model_factors.length > 0 && (
            <section className="result-section">
              <h4>Top model factors</h4>
              <div className="factor-list">
                {response.top_model_factors.map((f) => (
                  <div className="factor-row" key={f.feature}>
                    <span className="factor-name">{f.feature}</span>
                    <AnimatedBar pct={(f.importance / maxImportance) * 100} />
                    <span className="factor-importance tabular">{f.importance.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="result-section">
            <h4>Decision metadata</h4>
            <dl className="meta-grid">
              <div>
                <dt>Decision ID</dt>
                <dd>{response.decision_id}</dd>
              </div>
              <div>
                <dt>Fraud probability</dt>
                <dd className="tabular">{response.fraud_probability.toFixed(4)}</dd>
              </div>
              <div>
                <dt>Processing time</dt>
                <dd className="tabular">{response.processing_time_ms.toFixed(2)} ms</dd>
              </div>
              <div>
                <dt>Model version</dt>
                <dd>{response.model_version}</dd>
              </div>
              <div>
                <dt>Feature set</dt>
                <dd>{response.feature_set_version}</dd>
              </div>
              <div>
                <dt>Ruleset</dt>
                <dd>{response.ruleset_version}</dd>
              </div>
              <div>
                <dt>Decision policy</dt>
                <dd>{response.decision_policy_version}</dd>
              </div>
              <div>
                <dt>Idempotent replay</dt>
                <dd>{response.idempotent ? "Yes" : "No"}</dd>
              </div>
            </dl>
          </section>
        </div>
      </details>
    </div>
  );
}
