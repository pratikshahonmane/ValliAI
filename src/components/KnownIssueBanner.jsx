import Icon from "./Icon";
import "./KnownIssueBanner.css";

export default function KnownIssueBanner() {
  return (
    <div className="issue-banner" role="note">
      <Icon name="alert" size={18} color="var(--status-warning)" />
      <div>
        <strong>Known calibration issue -- device tracking.</strong> Shadow-mode
        testing found the device-tracking component flags <code>is_new_device</code>{" "}
        for effectively 100% of transactions in this environment (no real device
        history to bootstrap from yet). This inflated the false-positive rate from
        1.3% (model alone) to 28% in the shadow run. <code>NEW_DEVICE</code> rule
        hits and <strong>MONITOR</strong>/<strong>STEP_UP_AUTH</strong> volume are
        overstated until real device history is integrated -- do not use current
        decision-band distributions to size analyst headcount or step-up capacity.
      </div>
    </div>
  );
}
