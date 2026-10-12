import LandlordNavigation from "../../components/LandlordNavigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getLandlordApplications, getLandlordWaitingList, updateLandlordWaitingListPriority } from "../../services/api";
import type { LandlordApplication, WaitingListEntry } from "../../services/api";
import "../../App.css";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function LandlordWaitingList() {
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [approvedApplications, setApprovedApplications] = useState<LandlordApplication[]>([]);
  const [draftPriorities, setDraftPriorities] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const includeApprovedApplications = filter === "" || filter === "ACCEPTED";
      const [records, approved] = await Promise.all([
        getLandlordWaitingList(filter),
        includeApprovedApplications ? getLandlordApplications({ status: "APPROVED" }) : Promise.resolve([]),
      ]);
      if (currentRequest !== requestId.current) return;
      const approvedApplicationIds = new Set(approved.map((application) => application.id));
      const visibleEntries = records.filter((entry) => entry.status !== "ACCEPTED" || !entry.application_id || !approvedApplicationIds.has(entry.application_id));
      setEntries(visibleEntries);
      setApprovedApplications(approved);
      setDraftPriorities(Object.fromEntries(visibleEntries.map((entry) => [entry.id, String(entry.priority_score)])));
    } catch (caught) {
      if (currentRequest !== requestId.current) return;
      setEntries([]);
      setApprovedApplications([]);
      setError(caught instanceof Error ? caught.message : "Unable to load waiting-list entries.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [filter]);

  async function savePriority(entry: WaitingListEntry) {
    const value = Number(draftPriorities[entry.id]);
    setSavingId(entry.id);
    setError("");
    setMessage("");
    try {
      await updateLandlordWaitingListPriority(entry.id, value);
      setMessage(`Priority updated for ${entry.student_name}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save queue priority.");
    } finally {
      setSavingId(null);
    }
  }

  const counts = useMemo(() => ({
    waiting: entries.filter((item) => item.status === "WAITING").length,
    offered: entries.filter((item) => item.status === "OFFERED").length,
    accepted: entries.filter((item) => item.status === "ACCEPTED").length + approvedApplications.length,
  }), [entries, approvedApplications]);

  const visibleCount = entries.length + approvedApplications.length;

  return <div className="admin-dashboard-page admin-waiting-list-page">
    <header className="admin-header"><Link to="/landlord/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Landlord Portal</span></div></Link><div className="admin-header-title">Offer list management</div></header>
    <div className="admin-layout"><LandlordNavigation />
      <main className="admin-content">
        <section className="admin-welcome"><div><span className="eyebrow">ROOM ALLOCATION</span><h1>Offer list management</h1><p>Review queue order, room preferences, pending offers and student responses for your properties.</p></div><label className="waiting-list-filter">Filter entries<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All statuses</option><option value="WAITING">Waiting</option><option value="OFFERED">Offer sent</option><option value="ACCEPTED">Accepted</option><option value="EXPIRED">Expired</option><option value="CANCELLED">Cancelled</option></select></label></section>
        <section className="admin-metrics waiting-list-metrics"><div><span>Waiting</span><strong>{counts.waiting}</strong></div><div><span>Offers sent</span><strong>{counts.offered}</strong></div><div><span>Accepted</span><strong>{counts.accepted}</strong></div><div><span>Showing</span><strong>{visibleCount}</strong></div></section>
        {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}
        {message && <div className="property-alert property-alert-success" role="status">{message}</div>}
        {loading ? <div className="property-empty-state">Loading offer-list entries…</div> : visibleCount === 0 ? <div className="property-empty-state"><h2>No entries match this filter</h2><p>Student entries and approved applications for your properties will appear here.</p></div> : <section className="admin-waiting-list-records">{entries.map((entry) => <article className="admin-waiting-list-record" key={`entry-${entry.id}`}>
          <div className="admin-waiting-list-record-heading"><div><span className="eyebrow">{entry.property_name} · {entry.campus_name}</span><h2>{entry.student_name}</h2><p>{entry.student_email}</p></div><span className={`property-status-pill property-status-${entry.status.toLowerCase()}`}>{entry.status.replaceAll("_", " ")}</span></div>
          <div className="waiting-list-facts"><div><span>Room preference</span><strong>{entry.room_type_name}</strong></div><div><span>Budget limit</span><strong>{entry.max_monthly_price ? `R${Number(entry.max_monthly_price).toLocaleString()}/month` : "No limit set"}</strong></div><div><span>Accessibility</span><strong>{entry.accessibility_required ? "Required" : "No preference"}</strong></div><div><span>Offer / deadline</span><strong>{entry.offered_room_number ? `Room ${entry.offered_room_number} · ${formatDate(entry.respond_by)}` : "—"}</strong></div></div>
          <footer className="admin-waiting-list-record-footer"><span>Joined {formatDate(entry.created_at)}{entry.queue_position ? ` · Queue #${entry.queue_position}` : ""}</span>{entry.status === "WAITING" ? <label>Priority (0–100)<input type="number" min={0} max={100} value={draftPriorities[entry.id] ?? ""} onChange={(event) => setDraftPriorities((current) => ({ ...current, [entry.id]: event.target.value }))} /><button className="dashboard-secondary-action" disabled={savingId === entry.id || Number(draftPriorities[entry.id]) === entry.priority_score || Number(draftPriorities[entry.id]) < 0 || Number(draftPriorities[entry.id]) > 100} onClick={() => void savePriority(entry)}>{savingId === entry.id ? "Saving…" : "Update priority"}</button></label> : <span>Priority {entry.priority_score}</span>}</footer>
        </article>)}{approvedApplications.map((application) => <article className="admin-waiting-list-record" key={`application-${application.id}`}>
          <div className="admin-waiting-list-record-heading"><div><span className="eyebrow">{application.application_number} · {application.property_name}</span><h2>{application.student_name}</h2><p>Accommodation application approved by you</p></div><span className="property-status-pill property-status-approved">Accepted</span></div>
          <div className="waiting-list-facts"><div><span>Room</span><strong>{application.room_number || "—"}</strong></div><div><span>University / campus</span><strong>{application.university || "—"} · {application.campus || "—"}</strong></div><div><span>Course / year</span><strong>{application.course || "—"}{application.year_of_study ? ` · Year ${application.year_of_study}` : ""}</strong></div><div><span>Requested stay</span><strong>{application.expected_sign_in_date || "—"} – {application.expected_sign_out_date || "—"}</strong></div></div>
          <footer className="admin-waiting-list-record-footer"><span>Approved {formatDate(application.reviewed_at)}</span><span>Application {application.application_number}</span></footer>
        </article>)}</section>}
      </main>
    </div>
  </div>;
}

export default LandlordWaitingList;
