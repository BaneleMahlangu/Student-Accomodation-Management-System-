import AdminNavigation from "../../components/AdminNavigation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminAnalytics } from "../../services/api";
import type { AdminAnalyticsOverview } from "../../services/api";
import "../../App.css";

function money(value: string | number) {
  return `R${Number(value).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
}

function AdminAnalytics() {
  const [overview, setOverview] = useState<AdminAnalyticsOverview | null>(null);
  const [days, setDays] = useState(30);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    getAdminAnalytics(days).then((result) => { if (active) setOverview(result); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Unable to load analytics."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days, retry]);

  return <div className="admin-dashboard-page admin-operations-page">
    <header className="admin-header"><Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link><div className="admin-header-title">Platform analytics</div></header>
    <div className="admin-layout"><AdminNavigation />
      <main className="admin-content"><section className="admin-welcome analytics-heading"><div><span className="eyebrow">PLATFORM PERFORMANCE</span><h1>Analytics overview</h1><p>Operational, accommodation and payment measures from current StudentHaven records.</p></div><label>Activity period<select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 12 months</option></select></label></section>
        {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
        {loading || !overview ? <div className="property-empty-state">Loading platform metrics…</div> : <>
          <section className="admin-metrics analytics-kpis"><div><span>Students</span><strong>{overview.users.students.toLocaleString()}</strong><small>{overview.users.new_in_period} new accounts in period</small></div><div><span>Verified landlords</span><strong>{overview.users.verified_landlords.toLocaleString()}</strong><small>{overview.users.pending_landlord_verification} pending verification</small></div><div><span>Approved properties</span><strong>{overview.properties.approved.toLocaleString()}</strong><small>{overview.properties.pending} awaiting review</small></div><div><span>Bed occupancy</span><strong>{overview.beds.occupancy_percent}%</strong><small>{overview.beds.occupied} occupied · {overview.beds.available} available</small></div></section>
          <section className="analytics-summary-grid"><article className="analytics-panel"><div className="analytics-panel-heading"><div><span className="eyebrow">APPLICATIONS</span><h2>Application status</h2></div><strong>{overview.applications.in_period} <small>in period</small></strong></div><div className="analytics-status-list">{Object.entries(overview.applications.by_status).map(([status, count]) => <div key={status}><span>{status.replaceAll("_", " ")}</span><div><i style={{ width: `${overview.applications.total ? Math.max(2, count / overview.applications.total * 100) : 0}%` }} /></div><strong>{count}</strong></div>)}</div></article>
            <article className="analytics-panel"><div className="analytics-panel-heading"><div><span className="eyebrow">FINANCE</span><h2>Payment position</h2></div><Link to="/admin/reports">Export reports</Link></div><div className="analytics-finance-facts"><div><span>Funding due</span><strong>{money(overview.finance.amount_due)}</strong></div><div><span>Recorded as paid</span><strong>{money(overview.finance.amount_paid)}</strong></div><div><span>Successful transaction total</span><strong>{money(overview.finance.successful_transaction_total)}</strong></div><div><span>Transactions</span><strong>{overview.finance.successful_transaction_count}</strong></div></div></article>
          </section>
          <section className="analytics-panel analytics-property-panel"><div className="analytics-panel-heading"><div><span className="eyebrow">ACCOMMODATION</span><h2>Occupancy by property</h2></div><span>{overview.beds.total} beds across platform</span></div>{overview.property_occupancy.length === 0 ? <p>No approved accommodation inventory yet.</p> : <div className="analytics-property-list">{overview.property_occupancy.map((property) => <article key={property.id}><div><strong>{property.name}</strong><span>{property.occupied_beds} occupied · {property.available_beds} available of {property.total_beds}</span></div><div className="analytics-progress"><i style={{ width: `${property.occupancy_percent}%` }} /></div><b>{property.occupancy_percent}%</b></article>)}</div>}</section>
          <section className="analytics-summary-grid"><article className="analytics-panel"><div className="analytics-panel-heading"><div><span className="eyebrow">KNOWN BOOKINGS</span><h2>Six-month occupancy outlook</h2></div><span>{overview.occupancy_outlook.approved_bed_capacity} approved beds</span></div>{overview.occupancy_outlook.monthly.length === 0 ? <p>No booking outlook is available yet.</p> : <div className="analytics-property-list">{overview.occupancy_outlook.monthly.map((item) => <article key={item.month}><div><strong>{new Date(`${item.month}T00:00:00`).toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}</strong><span>{item.known_occupied_beds} beds covered by bookings at month end · {item.known_move_ins} move-ins · {item.scheduled_vacancies} scheduled move-outs</span></div><div className="analytics-progress"><i style={{ width: `${item.known_occupancy_percent}%` }} /></div><b>{item.known_occupancy_percent}%</b></article>)}</div>}<p className="analytics-generated">{overview.occupancy_outlook.method}</p></article>
            <article className="analytics-panel"><div className="analytics-panel-heading"><div><span className="eyebrow">RECENT DEMAND</span><h2>Planning indicators</h2></div></div><div className="analytics-finance-facts"><div><span>Applications per month (90-day average)</span><strong>{overview.occupancy_outlook.average_monthly_applications}</strong></div><div><span>Wait-list entries per month (90-day average)</span><strong>{overview.occupancy_outlook.average_monthly_waitlist_entries}</strong></div></div><h3>Application demand by campus and room type</h3>{overview.occupancy_outlook.demand_by_type_and_location.length === 0 ? <p>No recent submitted applications to compare.</p> : <div className="analytics-status-list">{overview.occupancy_outlook.demand_by_type_and_location.map((item) => <div key={`${item.campus}-${item.room_type}`}><span>{item.campus} · {item.room_type}</span><div><i style={{ width: `${Math.max(3, item.application_count / Math.max(...overview.occupancy_outlook.demand_by_type_and_location.map((row) => row.application_count)) * 100)}%` }} /></div><strong>{item.application_count}</strong></div>)}</div>}<p className="analytics-generated">Demand volume is historical application activity, not a confirmed booking or a trained prediction.</p></article>
          </section>
          <section className="analytics-operations-strip"><div><span>Students waiting</span><strong>{overview.waiting_list.waiting}</strong></div><div><span>Room offers open</span><strong>{overview.waiting_list.offers}</strong></div><div><span>Open complaints</span><strong>{overview.complaints.open}</strong></div><div><span>Open maintenance</span><strong>{overview.maintenance.open}</strong></div></section>
          <footer className="analytics-generated">Generated {new Date(overview.generated_at).toLocaleString("en-ZA")}. Metrics use current records; payment totals are not bank reconciliation.</footer>
        </>}
      </main>
    </div>
  </div>;
}

export default AdminAnalytics;
