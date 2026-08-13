import { useMemo } from "react";
import { useTransactions } from "../context/TransactionContext";
import { aggregateOverview, dailyRiskTrend } from "../lib/analytics";
import { useCountUp } from "../hooks/useCountUp";
import StatTile from "../components/StatTile";
import KnownIssueBanner from "../components/KnownIssueBanner";
import LiveClock from "../components/LiveClock";
import DecisionDistributionChart from "../components/charts/DecisionDistributionChart";
import RiskTrendChart from "../components/charts/RiskTrendChart";
import TopRulesChart from "../components/charts/TopRulesChart";
import "./Overview.css";

export default function Overview() {
  const { records } = useTransactions();
  const stats = useMemo(() => aggregateOverview(records), [records]);
  const trend = useMemo(() => dailyRiskTrend(records), [records]);

  const animTotal = useCountUp(stats.total);
  const animDeclineRate = useCountUp(stats.declineRate * 100);
  const animAvgRisk = useCountUp(stats.avgRiskScore);
  const animAvgProcessing = useCountUp(stats.avgProcessingMs);

  return (
    <div className="page-enter">
      <div className="page-header overview-header">
        <div>
          <h1>Overview</h1>
          <p>Fraud &amp; risk engine activity across all analyzed transactions.</p>
        </div>
        <LiveClock />
      </div>

      <KnownIssueBanner />

      <div className="stat-grid">
        <StatTile
          label="Transactions analyzed"
          value={Math.round(animTotal).toLocaleString()}
          icon="activity"
        />
        <StatTile
          label="Decline / hold rate"
          value={`${animDeclineRate.toFixed(1)}%`}
          accent={stats.declineRate > 0.15 ? "var(--status-critical)" : undefined}
          icon="percent"
        />
        <StatTile
          label="Avg risk score"
          value={animAvgRisk.toFixed(1)}
          sublabel="out of 100"
          icon="shield"
        />
        <StatTile
          label="Avg processing time"
          value={`${animAvgProcessing.toFixed(1)} ms`}
          sublabel="engine latency"
          icon="clock"
        />
      </div>

      <div className="chart-grid">
        <DecisionDistributionChart byDecision={stats.byDecision} total={stats.total} />
        <RiskTrendChart data={trend} />
        <TopRulesChart topRules={stats.topRules} />
      </div>
    </div>
  );
}
