// Plain-English layer on top of the raw reason_codes / rule_hits the engine
// returns. Nothing here changes the decision -- it only translates codes an
// analyst already trusts into sentences a first-time viewer can act on
// without cross-referencing a glossary.

export const REASON_EXPLANATIONS = {
  AMOUNT_SIGNIFICANTLY_ABOVE_CUSTOMER_AVERAGE:
    "The amount is far above this customer's typical spending pattern.",
  AMOUNT_ABOVE_CUSTOMER_AVERAGE:
    "The amount is noticeably higher than this customer's typical spend.",
  DEVICE_FIRST_SEEN_RECENTLY: "This device hasn't been seen with this customer before.",
  NEW_PAYEE_ADDED: "Funds are being sent to a new, first-time beneficiary.",
  CROSS_BORDER_TRANSACTION_DETECTED:
    "The transaction is being made in a different country than the customer's home country.",
  IP_LOCATION_MISMATCH:
    "The connecting IP address doesn't match the customer's home country.",
  TRANSACTION_LOCATION_MISMATCH:
    "The transaction country doesn't match the IP-detected location.",
  MERCHANT_CATEGORY_ELEVATED_RISK: "This merchant falls into a higher-risk category.",
  CUSTOMER_RISK_PROFILE_ELEVATED: "The customer's own KYC/AML risk profile is elevated.",
  HIGH_TRANSACTION_VELOCITY:
    "There have been an unusually high number of transactions in the last 10 minutes.",
  RECENT_AUTH_FAILURES:
    "There have been multiple failed login or authentication attempts in the last 24 hours.",
  DORMANT_ACCOUNT_REACTIVATED:
    "This account was dormant and has suddenly become active again with a sizeable transaction.",
  NEW_ACCOUNT_HIGH_VALUE_TXN: "This is a relatively new account making a high-value transaction.",
  ABBREVIATED_SESSION_NEW_DEVICE:
    "The session was unusually short, on a device that hasn't been seen before.",
};

export const DECISION_EXPLANATION = {
  APPROVE: "No meaningful risk signals were found -- safe to process normally.",
  MONITOR: "No action needed right now. Logged for passive review in case a pattern emerges.",
  STEP_UP_AUTH: "Verify the customer's identity (OTP or biometric) before letting this through.",
  MANUAL_REVIEW: "Hand this to an analyst -- it needs a human decision before it proceeds.",
  DECLINE: "Block this transaction. The combined risk signals are too strong to proceed.",
  HOLD: "Pause this transaction. It only releases after manual review, per mandatory policy.",
};

const FACTOR_PHRASES = {
  amount_to_customer_average: "an unusually large amount for this customer",
  is_new_device: "an unrecognized device",
  is_new_beneficiary: "a first-time payee",
  cross_border_transaction: "a cross-border transaction",
  ip_country_mismatch: "an IP address that doesn't match the customer's home country",
  transaction_country_mismatch: "a location mismatch",
  merchant_risk_score: "a high-risk merchant category",
  customer_risk_score: "an elevated customer risk profile",
  transactions_last_10_minutes: "unusually high transaction velocity",
  failed_attempts_last_24_hours: "recent authentication failures",
  days_since_last_transaction: "a long-dormant account suddenly transacting",
  account_age_days: "a new account making a high-value transaction",
  session_duration_seconds: "an unusually short session on a new device",
};

function factorPhrase(feature) {
  return FACTOR_PHRASES[feature] ?? feature.replace(/_/g, " ");
}

// "This transaction was flagged as HIGH risk, mainly due to an unusually
// large amount for this customer and an unrecognized device."
export function buildSummarySentence(response) {
  const level = response.risk_level;
  const factors = response.top_model_factors.slice(0, 2).map((f) => factorPhrase(f.feature));

  if (response.decision === "APPROVE" || factors.length === 0) {
    return "No significant risk signals were found for this transaction.";
  }

  const reason =
    factors.length === 1
      ? factors[0]
      : `${factors[0]} and ${factors[1]}`;

  return `This transaction was flagged as ${level} risk, mainly due to ${reason}.`;
}
