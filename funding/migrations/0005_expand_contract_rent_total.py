import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations


CENT = Decimal("0.01")


def _next_month_anniversary(day, anchor_day):
    month_index = day.month
    year = day.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, min(anchor_day, calendar.monthrange(year, month)[1]))


def _stay_total(start_date, end_date, monthly_fee):
    if not start_date or not end_date or end_date <= start_date or monthly_fee <= 0:
        return None
    anchor_day = start_date.day
    period_start = start_date
    total = Decimal("0.00")
    while period_start < end_date:
        full_period_end = _next_month_anniversary(period_start, anchor_day)
        period_end = min(full_period_end, end_date)
        occupied_days = (period_end - period_start).days
        full_period_days = (full_period_end - period_start).days
        total += (monthly_fee * Decimal(occupied_days) / Decimal(full_period_days)).quantize(CENT, rounding=ROUND_HALF_UP)
        period_start = period_end
    return total


def expand_existing_contract_totals(apps, schema_editor):
    FundingPayment = apps.get_model("funding", "FundingPayment")
    PaymentTransaction = apps.get_model("funding", "PaymentTransaction")
    for payment in FundingPayment.objects.select_related("contract").iterator():
        contract = payment.contract
        total = _stay_total(contract.start_date, contract.end_date, contract.monthly_fee)
        if total is None:
            continue
        payment.amount_due = total
        if not payment.due_date:
            payment.due_date = contract.start_date
        pending_checkout = PaymentTransaction.objects.filter(
            funding_payment_id=payment.id,
            provider__in=["PAYFAST", "PAYFAST_SANDBOX"],
            status="PROCESSING",
        ).exists()
        balance = max(Decimal("0.00"), total - payment.amount_paid)
        if balance == 0:
            payment.payment_status = "SUCCESSFUL"
            payment.funding_status = "VERIFIED"
        elif payment.amount_paid > 0:
            payment.payment_status = "PROCESSING" if pending_checkout else "PENDING"
            payment.funding_status = "PARTIALLY_FUNDED"
        elif pending_checkout:
            payment.payment_status = "PROCESSING"
            payment.funding_status = "PENDING"
        elif payment.payment_status not in {"FAILED", "REVERSED"}:
            payment.payment_status = "PENDING"
            payment.funding_status = "PENDING"
        payment.save(update_fields=["amount_due", "due_date", "payment_status", "funding_status"])


class Migration(migrations.Migration):
    dependencies = [
        ("funding", "0004_refundrequest"),
        ("contracts", "0002_contract_signature_evidence"),
    ]

    operations = [
        migrations.RunPython(expand_existing_contract_totals, migrations.RunPython.noop),
    ]
