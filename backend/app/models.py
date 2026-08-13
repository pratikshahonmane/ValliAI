from typing import Optional

from pydantic import BaseModel


class TransactionRequest(BaseModel):
    transaction_id: str
    customer_id: str
    account_id: Optional[str] = None
    merchant_id: str
    device_id: str
    beneficiary_id: Optional[str] = None
    amount: float
    currency: str
    country: str
    customer_home_country: str
    ip_country: str
    channel: str
    merchant_category: str
    transaction_time: str
    session_duration_seconds: int = 0
    device_age_days: int
    account_age_days: int
    average_transaction_amount: float
    transactions_last_10_minutes: int = 0
    failed_attempts_last_24_hours: int = 0
    days_since_last_transaction: int = 0
    merchant_risk_score: float = 20
    customer_risk_score: float = 20
    is_new_device: bool = False
    is_new_beneficiary: bool = False
