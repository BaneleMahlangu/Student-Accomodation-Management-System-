import LandlordNavigation from "../../components/LandlordNavigation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getLandlordContracts,
  getLandlordFundingPayments,
  getLandlordProperties,
  getManagedBookings,
} from "../../services/api";
import type { FundingPayment, ManagedBooking, ManagedProperty, StudentContract } from "../../services/api";
import "../../App.css";

type AnalyticsData = { properties: ManagedProperty[]; bookings: ManagedBooking[]; contracts: StudentContract[]; payments: FundingPayment[] };

export default function LandlordAnalytics() {
  const [data, setData] = useState<AnalyticsData>({ properties: [], bookings: [], contracts: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [properties, bookings, contracts, payments] = await Promise.all([
        getLandlordProperties(),
        getManagedBookings(),
        getLandlordContracts(),
        getLandlordFundingPayments(),
      ]);
      setData({ properties, bookings, contracts, payments });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load property analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const occupied = data.properties.reduce((sum, property) => sum + property.occupied_beds, 0);
  const capacity = data.properties.reduce((sum, property) => sum + property.total_beds, 0);
  const occupancyRate = capacity ? Math.round((occupied / capacity) * 100) : 0;
  const activeBookings = data.bookings.filter((booking) => booking.status === "ACTIVE");
  const confirmedBookings = data.bookings.filter((booking) => booking.status === "CONFIRMED");
  const monthlyBookedRent = [...activeBookings, ...confirmedBookings].reduce((sum, booking) => sum + Number(booking.monthly_fee || 0), 0);
  const outstandingBalance = data.payments.reduce((sum, payment) => sum + Number(payment.balance || 0), 0);
  const currency = (amount: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="landlord-dashboard-page">
      <header className="landlord-header"><Link to="/landlord/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Landlord Portal</span></div></Link><Link to="/account/security" className="occupancy-security-link">Account Security</Link></header>
      <div className="occupancy-shell">
        <LandlordNavigation variant="occupancy" />
        <main className="occupancy-content">
          <div className="occupancy-heading"><div><span className="section-eyebrow">LANDLORD OPERATIONS</span><h1>Property analytics</h1><p>Current occupancy and financial indicators from records for your properties.</p></div><button type="button" className="dashboard-secondary-action" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh metrics"}</button></div>
          {error && <div className="property-alert property-alert-error" role="alert">{error}<button type="button" onClick={() => void load()}>Try again</button></div>}
          <section className="occupancy-summary" aria-label="Portfolio metrics">
            <article><span>Listed beds</span><strong>{loading ? "—" : capacity}</strong></article>
            <article><span>Occupied beds</span><strong>{loading ? "—" : occupied}</strong></article>
            <article><span>Occupancy</span><strong>{loading ? "—" : `${occupancyRate}%`}</strong></article>
            <article><span>Confirmed / active rent</span><strong>{loading ? "—" : currency(monthlyBookedRent)}</strong></article>
            <article><span>Outstanding balance</span><strong>{loading ? "—" : currency(outstandingBalance)}</strong></article>
            <article><span>Signed contracts</span><strong>{loading ? "—" : data.contracts.filter((contract) => contract.status === "SIGNED").length}</strong></article>
          </section>
          {loading ? <div className="dashboard-loading">Calculating property metrics…</div> : data.properties.length === 0 ? <div className="change-requests-empty"><strong>No property analytics yet</strong><p>Property activity will appear after you add accommodation and receive bookings.</p><Link to="/landlord/properties">Manage properties</Link></div> : (
            <section className="occupancy-records" aria-label="Property occupancy detail">
              {data.properties.map((property) => {
                const rate = property.total_beds ? Math.round((property.occupied_beds / property.total_beds) * 100) : 0;
                const bookings = data.bookings.filter((booking) => booking.property === property.id);
                const rent = bookings.filter((booking) => ["ACTIVE", "CONFIRMED"].includes(booking.status)).reduce((sum, booking) => sum + Number(booking.monthly_fee || 0), 0);
                return <article className="occupancy-record landlord-analytics-property" key={property.id}>
                  <div className="occupancy-record-title"><div><span className="section-eyebrow">{property.campus_name} · {property.university_name}</span><h2>{property.name}</h2></div><span className={`property-status-pill property-status-${property.status.toLowerCase()}`}>{property.status.replaceAll("_", " ")}</span></div>
                  <div className="occupancy-record-grid"><span><small>Occupied beds</small><strong>{property.occupied_beds} / {property.total_beds}</strong></span><span><small>Available beds</small><strong>{property.available_beds}</strong></span><span><small>Bookings</small><strong>{bookings.length}</strong></span><span><small>Confirmed / active monthly rent</small><strong>{currency(rent)}</strong></span></div>
                  <div className="landlord-occupancy-meter" role="img" aria-label={`${rate}% of listed beds occupied`}><span style={{ width: `${rate}%` }} /></div><small>{rate}% of listed beds occupied</small>
                </article>;
              })}
            </section>
          )}
          <p className="analytics-generated">Rent reflects confirmed and active booking records. Outstanding balances are recorded account data, not settled cash or a payment forecast.</p>
        </main>
      </div>
    </div>
  );
}
