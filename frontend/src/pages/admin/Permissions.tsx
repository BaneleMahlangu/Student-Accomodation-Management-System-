import AdminNavigation from "../../components/AdminNavigation";
import { Link } from "react-router-dom";
import "../../App.css";

const roleAccess = [
  {
    role: "Student",
    scope: "The signed-in student’s own profile and accommodation records.",
    capabilities: "Search approved accommodation, submit applications and documents, sign eligible contracts, manage funding records, bookings, maintenance and support conversations.",
  },
  {
    role: "Landlord",
    scope: "Properties owned by the signed-in landlord account.",
    capabilities: "Manage property inventory, view related applications and occupancy, review contracts and payment records, respond to maintenance requests and communicate with students.",
  },
  {
    role: "Administrator",
    scope: "Platform-wide operational records.",
    capabilities: "Review applications and documents, verify accounts and properties, oversee funding, waiting lists, complaints, maintenance, risk alerts, analytics and audit records.",
  },
];

export default function Permissions() {
  return (
    <div className="admin-dashboard-page admin-directory-page">
      <header className="admin-header"><Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link><div className="admin-header-title">Roles & access</div></header>
      <div className="admin-layout">
        <AdminNavigation />
        <main className="admin-content admin-directory-content">
          <section className="admin-welcome admin-directory-title"><div><span className="eyebrow">ACCESS CONTROL</span><h1>Role access boundaries</h1><p>StudentHaven applies server-side role checks and limits landlord records to properties managed by that account.</p></div></section>
          <div className="risk-review-notice" role="note"><strong>Custom permission rules are not configurable here.</strong><span>Access is assigned by account role and enforced by the application. Use account management to verify or suspend accounts; changing access rules requires a platform policy update.</span></div>
          <section className="occupancy-records" aria-label="Current role permissions">
            {roleAccess.map((item) => <article className="occupancy-record" key={item.role}><span className="section-eyebrow">ROLE POLICY</span><h2>{item.role}</h2><p><strong>Record scope</strong><br />{item.scope}</p><p><strong>Available actions</strong><br />{item.capabilities}</p></article>)}
          </section>
          <div className="occupancy-heading-links"><Link to="/admin/students">Manage student accounts</Link><Link to="/admin/landlords">Manage landlord accounts</Link><Link to="/admin/audit-logs">Review access audit trail</Link></div>
        </main>
      </div>
    </div>
  );
}
