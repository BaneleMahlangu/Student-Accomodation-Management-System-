import LandlordNavigation from "../../components/LandlordNavigation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getLandlordContracts,
  getLandlordFundingPayments,
  getManagedBookings,
} from "../../services/api";
import type { FundingPayment, ManagedBooking, StudentContract } from "../../services/api";
import "../../App.css";

type ReportData = { bookings: ManagedBooking[]; contracts: StudentContract[]; payments: FundingPayment[] };

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function LandlordReports() {
  const [data, setData] = useState<ReportData>({ bookings: [], contracts: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [bookings, contracts, payments] = await Promise.all([
        getManagedBookings(),
        getLandlordContracts(),
        getLandlordFundingPayments(),
      ]);
      setData({ bookings, contracts, payments });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to prepare your property reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="landlord-dashboard-page">
      <header className="landlord-header"><Link to="/landlord/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Landlord Portal</span></div></Link><Link to="/account/security" className="occupancy-security-link">Account Security</Link></header>
      <div className="occupancy-shell">
        <LandlordNavigation variant="occupancy" />
        <main className="occupancy-content">
          <div className="occupancy-heading"><div><span className="section-eyebrow">LANDLORD OPERATIONS</span><h1>Property reports</h1><p>Review current accommodation records and export the records your account can access.</p></div><button type="button" className="dashboard-secondary-action" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh reports"}</button></div>
          <div className="occupancy-summary"><article><span>Bookings</span><strong>{loading ? "—" : data.bookings.length}</strong></article><article><span>Contracts</span><strong>{loading ? "—" : data.contracts.length}</strong></article><article><span>Funding records</span><strong>{loading ? "—" : data.payments.length}</strong></article></div>
          {error && <div className="property-alert property-alert-error" role="alert">{error}<button type="button" onClick={() => void load()}>Try again</button></div>}
          {loading ? <div className="dashboard-loading">Preparing scoped property data…</div> : (
            <section className="occupancy-records report-export-grid" aria-label="Available exports">
              <article className="occupancy-record"><span className="section-eyebrow">OCCUPANCY</span><h2>Booking register</h2><p>Room allocations, student contact details, accommodation dates and booking status.</p><button className="dashboard-primary-action" disabled={!data.bookings.length} onClick={() => downloadCsv("student-haven-bookings.csv", ["Booking", "Student", "Email", "Mobile", "Property", "Room", "Bed", "Start date", "End date", "Monthly fee", "Status"], data.bookings.map((item) => [item.booking_number, item.student_name, item.student_email, item.student_mobile, item.property_name, item.room_number, item.bed_number, item.start_date, item.end_date, item.monthly_fee, item.status]))}>Download bookings CSV</button></article>
              <article className="occupancy-record"><span className="section-eyebrow">AGREEMENTS</span><h2>Contract register</h2><p>Contract status, accommodation period, signature date and monthly fee.</p><button className="dashboard-primary-action" disabled={!data.contracts.length} onClick={() => downloadCsv("student-haven-contracts.csv", ["Contract", "Student", "Property", "Room", "Start date", "End date", "Monthly fee", "Status", "Signed at", "Created"], data.contracts.map((item) => [item.contract_number, item.student_name, item.property_name, item.room_number, item.start_date, item.end_date, item.monthly_fee, item.status, item.signed_at, item.created_at]))}>Download contracts CSV</button></article>
              <article className="occupancy-record"><span className="section-eyebrow">ACCOUNTS</span><h2>Funding & payments</h2><p>Monthly rent, accommodation dates, contract total, payments received, remaining months and outstanding balance.</p><button className="dashboard-primary-action" disabled={!data.payments.length} onClick={() => downloadCsv("student-haven-funding.csv", ["Reference", "Student", "Property", "Funding method", "Funding status", "Payment status", "Monthly rent", "Stay start", "Stay end", "Contract rent total", "Amount paid", "Balance", "Months remaining", "Currency", "First rent due"], data.payments.map((item) => [item.payment_reference, item.student_name, item.property_name, item.funding_method, item.funding_status, item.payment_status, item.monthly_rent, item.stay_start_date, item.stay_end_date, item.amount_due, item.amount_paid, item.balance, item.remaining_months, item.currency, item.due_date]))}>Download funding CSV</button></article>
            </section>
          )}
          {!loading && !error && <p className="analytics-generated">Exports include only records for properties managed by your landlord account. Recorded payment information is not a payment gateway settlement statement.</p>}
        </main>
      </div>
    </div>
  );
}
