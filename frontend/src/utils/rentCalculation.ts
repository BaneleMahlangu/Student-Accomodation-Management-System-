import type { FundingPayment } from "../services/api";

type RentPayment = Pick<FundingPayment, "monthly_rent" | "amount_due" | "currency" | "rent_schedule">;

function money(amount: string, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function shortDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
  });
}

export function formatRentCalculation(payment: RentPayment) {
  const fullMonths = payment.rent_schedule.filter(
    (period) => Math.abs(Number(period.amount_due) - Number(payment.monthly_rent)) < 0.01,
  );
  const proratedPeriods = payment.rent_schedule.filter(
    (period) => Math.abs(Number(period.amount_due) - Number(payment.monthly_rent)) >= 0.01,
  );
  const parts = [
    ...(fullMonths.length > 0
      ? [`${money(payment.monthly_rent, payment.currency)} × ${fullMonths.length} ${fullMonths.length === 1 ? "full month" : "full months"}`]
      : []),
    ...proratedPeriods.map((period) =>
      `${money(period.amount_due, payment.currency)} prorated (${shortDate(period.start_date)}–${shortDate(period.end_date)})`,
    ),
  ];

  return `${parts.length > 0 ? parts.join(" + ") : "Calculated from the signed stay dates"} = ${money(payment.amount_due, payment.currency)}`;
}
