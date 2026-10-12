import AdminNavigation from "../../components/AdminNavigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { getAdminAuditEvents } from "../../services/api";
import type { AdminAuditEvent } from "../../services/api";
import "../../App.css";

function AuditLogs() {
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(filters = { search, action, entity_type: entityType }) {
    setLoading(true); setError("");
    try { setEvents(await getAdminAuditEvents(filters)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load audit events."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load({ search: "", action: "", entity_type: "" }); }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load();
  }

  return <div className="admin-dashboard-page admin-operations-page"><header className="admin-header"><Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link><div className="admin-header-title">Audit logs</div></header><div className="admin-layout"><AdminNavigation /><main className="admin-content"><section className="admin-welcome"><div><span className="eyebrow">ADMINISTRATIVE ACTIVITY</span><h1>Audit log</h1><p>Search significant account, application, property, complaint and queue decisions.</p></div></section><form className="audit-filter-bar" onSubmit={submit}><label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Action, record or administrator" /></label><label>Action<input value={action} onChange={(event) => setAction(event.target.value)} placeholder="e.g. APPLICATION_APPROVED" /></label><label>Record type<select value={entityType} onChange={(event) => setEntityType(event.target.value)}><option value="">All types</option><option value="student">Student</option><option value="landlord">Landlord</option><option value="application">Application</option><option value="property">Property</option><option value="complaint">Complaint</option><option value="waiting_list_entry">Waiting list</option></select></label><button className="dashboard-primary-action">Apply filters</button></form>{error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}{loading ? <div className="property-empty-state">Loading audit records…</div> : events.length === 0 ? <div className="property-empty-state"><h2>No audit events found</h2><p>Important administrator actions will be recorded here.</p></div> : <div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>When</th><th>Administrator</th><th>Action</th><th>Record</th><th>Summary</th><th>Changes</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{new Date(event.created_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}</td><td><strong>{event.actor_name}</strong><small>{event.actor_email}</small></td><td><code>{event.action}</code></td><td>{event.entity_type.replaceAll("_", " ")} {event.entity_id ? `#${event.entity_id}` : ""}</td><td>{event.summary}</td><td>{Object.entries(event.metadata).map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`).join(" · ") || "—"}</td></tr>)}</tbody></table></div>}<p className="analytics-generated">Showing up to 500 recent matching records.</p></main></div></div>;
}

export default AuditLogs;
