import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { actOnStudentWaitingList, getStudentWaitingList } from "../../services/api";
import type { WaitingListEntry } from "../../services/api";
import "../../App.css";

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function WaitingList() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try { setEntries(await getStudentWaitingList()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load your waiting list."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function takeAction(entry: WaitingListEntry, action: "accept" | "cancel") {
    setBusyId(entry.id); setError(""); setMessage("");
    try {
      const result = await actOnStudentWaitingList(entry.id, action);
      if (action === "accept" && result.application_id) {
        navigate(`/applications/new?property=${entry.property}&room=${entry.offered_room}`);
        return;
      }
      setMessage(result.message);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update this waiting-list entry."); }
    finally { setBusyId(null); }
  }

  const activeCount = entries.filter((entry) => ["WAITING", "OFFERED"].includes(entry.status)).length;

  return <main className="student-page waiting-list-page">
    <section className="notifications-header"><div><p className="page-eyebrow">ACCOMMODATION JOURNEY</p><h1>My waiting list</h1><p>Track your queue position and accept a matching room offer before its deadline.</p></div><div className="notifications-summary"><strong>{activeCount}</strong><span>Active entries</span></div></section>
    <div className="waiting-list-actions"><Link to="/student/dashboard" className="dashboard-secondary-action">Back to dashboard</Link><Link to="/accommodation" className="dashboard-primary-action">Browse accommodation</Link></div>
    {error && <div className="notification-state notification-error" role="alert"><strong>Unable to update the waiting list</strong><span>{error}</span><button onClick={() => void load()}>Try again</button></div>}
    {message && <div className="form-message success-message" role="status">{message}</div>}
    {loading ? <div className="notification-state"><strong>Loading your queue…</strong></div> : entries.length === 0 ? <section className="notification-state waiting-list-empty"><strong>You have no waiting-list entries</strong><span>Open a property with no available rooms and join its waiting list to be notified about suitable vacancies.</span><Link to="/accommodation" className="dashboard-primary-action">Find accommodation</Link></section> : <section className="waiting-list-cards" aria-label="Waiting list entries">
      {entries.map((entry) => <article className="waiting-list-card" key={entry.id}>
        <div className="waiting-list-card-heading"><div><span className="eyebrow">{entry.campus_name}</span><h2>{entry.property_name}</h2></div><span className={`property-status-pill property-status-${entry.status.toLowerCase()}`}>{entry.status.replaceAll("_", " ")}</span></div>
        <div className="waiting-list-facts"><div><span>Preference</span><strong>{entry.room_type_name}</strong></div><div><span>Budget</span><strong>{entry.max_monthly_price ? `Up to R${Number(entry.max_monthly_price).toLocaleString()}/month` : "Any listed price"}</strong></div><div><span>Accessibility</span><strong>{entry.accessibility_required ? "Required" : "No preference"}</strong></div><div><span>Queue position</span><strong>{entry.queue_position ? `#${entry.queue_position}` : entry.status === "WAITING" ? "Calculating" : "—"}</strong></div></div>
        {entry.status === "OFFERED" && <div className="waiting-list-offer"><strong>Room {entry.offered_room_number}{entry.offered_bed_number ? ` · Bed ${entry.offered_bed_number}` : ""} is available</strong><span>Respond by {displayDate(entry.respond_by)}. Accepting opens a draft application for the landlord to review.</span><div><button className="dashboard-primary-action" disabled={busyId === entry.id} onClick={() => void takeAction(entry, "accept")}>{busyId === entry.id ? "Opening application…" : "Accept room offer"}</button><button className="admin-directory-secondary-button" disabled={busyId === entry.id} onClick={() => void takeAction(entry, "cancel")}>Decline and leave queue</button></div></div>}
        {entry.status === "WAITING" && <div className="waiting-list-entry-footer"><span>Joined {displayDate(entry.created_at)}</span><button className="admin-directory-secondary-button" disabled={busyId === entry.id} onClick={() => void takeAction(entry, "cancel")}>Leave waiting list</button></div>}
        {entry.status === "ACCEPTED" && <div className="waiting-list-offer"><strong>Offer accepted</strong><span>Your application is ready to complete and submit for review.</span><Link to={`/applications/new?property=${entry.property}&room=${entry.offered_room}`} className="dashboard-primary-action">Continue application</Link></div>}
        {entry.status === "EXPIRED" && <div className="waiting-list-entry-footer"><span>This offer expired. Join again from the property page to receive future offers.</span></div>}
      </article>)}
    </section>}
    <p className="waiting-list-note">Offers are time limited. A completed application still goes through StudentHaven’s regular review and approval steps.</p>
  </main>;
}

export default WaitingList;
