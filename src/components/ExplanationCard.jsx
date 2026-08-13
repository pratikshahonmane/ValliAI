import Icon from "./Icon";
import { DECISION_META } from "../lib/decisions";
import { REASON_EXPLANATIONS, DECISION_EXPLANATION, buildSummarySentence } from "../lib/explainability";
import "./ExplanationCard.css";

export default function ExplanationCard({ response }) {
  const meta = DECISION_META[response.decision] ?? { color: "var(--text-muted)", icon: "flag" };
  const reasons = response.reason_codes.length > 0 ? response.reason_codes : null;

  return (
    <div className="explain-card" style={{ "--card-color": meta.color }}>
      <div className="explain-summary">
        <Icon name="sparkle" size={16} color={meta.color} />
        <p>{buildSummarySentence(response)}</p>
      </div>

      {reasons && (
        <ul className="explain-reasons">
          {reasons.map((code) => (
            <li key={code}>
              <Icon name="check" size={13} color="var(--text-muted)" />
              <span>{REASON_EXPLANATIONS[code] ?? code.replace(/_/g, " ").toLowerCase()}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="explain-action" style={{ "--action-color": meta.color }}>
        <div className="explain-action-icon">
          <Icon name={meta.icon} size={17} color={meta.color} />
        </div>
        <div className="explain-action-body">
          <span className="explain-action-label">Recommended action</span>
          <strong>{response.recommended_action}</strong>
          <p>{DECISION_EXPLANATION[response.decision]}</p>
        </div>
      </div>
    </div>
  );
}
