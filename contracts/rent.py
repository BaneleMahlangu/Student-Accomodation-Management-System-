import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP


CENT = Decimal("0.01")


def _next_month_anniversary(day: date, anchor_day: int) -> date:
    month_index = day.month  # one-based month becomes the next month index
    year = day.year + (month_index // 12)
    month = (month_index % 12) + 1
    return date(year, month, min(anchor_day, calendar.monthrange(year, month)[1]))


def calculate_rent_schedule(start_date: date | None, end_date: date | None, monthly_fee: Decimal):
    """Build monthly, check-in-anniversary rent periods; checkout is exclusive."""
    if not start_date or not end_date or end_date <= start_date or monthly_fee <= 0:
        return []

    rows = []
    period_start = start_date
    anchor_day = start_date.day
    while period_start < end_date:
        full_period_end = _next_month_anniversary(period_start, anchor_day)
        period_end = min(full_period_end, end_date)
        occupied_days = (period_end - period_start).days
        full_period_days = (full_period_end - period_start).days
        amount = (monthly_fee * Decimal(occupied_days) / Decimal(full_period_days)).quantize(
            CENT, rounding=ROUND_HALF_UP
        )
        rows.append({
            "due_date": period_start,
            "start_date": period_start,
            "end_date": period_end,
            "amount": amount,
        })
        period_start = period_end
    return rows


def calculate_stay_rent(start_date: date | None, end_date: date | None, monthly_fee: Decimal) -> Decimal:
    return sum((row["amount"] for row in calculate_rent_schedule(start_date, end_date, monthly_fee)), Decimal("0.00"))
