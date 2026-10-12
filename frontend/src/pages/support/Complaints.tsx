import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  createComplaint,
  getComplaint,
  getComplaints,
  getProperties,
  sendComplaintMessage,
} from "../../services/api";
import type { ComplaintCategory, Property, StudentComplaint } from "../../services/api";
import "../../App.css";

type Audience = "student" | "landlord";

const categories: { value: ComplaintCategory; label: string }[] = [
  { value: "SAFETY", label: "Safety or security" },
  { value: "FACILITIES", label: "Facilities or room condition" },
  { value: "LANDLORD_SERVICE", label: "Landlord service" },
  { value: "ROOMMATE", label: "Roommate concern" },
  { value: "BILLING", label: "Billing or funding" },
  { value: "DISCRIMINATION", label: "Discrimination or harassment" },
  { value: "OTHER", label: "Other concern" },
];

function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

function Complaints({ audience }: { audience: Audience }) {
  const [complaints, setComplaints] = useState<StudentComplaint[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<StudentComplaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [reply, setReply] = useState("");
  const [newComplaint, setNewComplaint] = useState({
    property_id: "",
    category: "OTHER" as ComplaintCategory,
    title: "",
    description: "",
  });

  const title = audience === "landlord" ? "Property complaints" : "My complaints";
  const newCount = useMemo(() => complaints.filter((item) => ["OPEN", "UNDER_REVIEW", "ESCALATED"].includes(item.status)).length, [complaints]);

  async function loadList() {
    setLoading(true);
    setError("");
    try {
      const data = await getComplaints();
      setComplaints(data);
      if (!data.some((item) => item.id === selectedId)) setSelectedId(data[0]?.id ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load complaints.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    void loadList();
    if (audience === "student") getProperties().then((data) => setProperties(data.properties)).catch(() => setProperties([]));
  }, [audience]);

  useEffect(() => {
    if (selectedId === null) { setSelected(null); return; }
    let active = true;
    setDetailLoading(true);
    getComplaint(selectedId).then((data) => {
      if (!active) return;
      setSelected(data);
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "Unable to load this complaint.");
    }).finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  async function submitNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const created = await createComplaint({
        property_id: Number(newComplaint.property_id),
        category: newComplaint.category,
        title: newComplaint.title,
        description: newComplaint.description,
      });
      setShowNew(false);
      setNewComplaint({ property_id: "", category: "OTHER", title: "", description: "" });
      setNotice("Your complaint has been submitted.");
      await loadList();
      setSelectedId(created.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to submit your complaint."); }
    finally { setSaving(false); }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const updated = await sendComplaintMessage(selected.id, reply);
      setSelected(updated); setReply(""); setNotice("Your response has been added."); await loadList();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to add your response."); }
    finally { setSaving(false); }
  }

  const dashboardPath = audience === "landlord" ? "/landlord/dashboard" : "/student/dashboard";

  return <div className="student-page complaint-page">
    <header className="dashboard-header"><Link to={dashboardPath} className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>{audience === "landlord" ? "Landlord Portal" : "Student Portal"}</span></div></Link><Link to={dashboardPath} className="dashboard-secondary-action">Dashboard</Link></header>
    <main className="complaint-content">
      <section className="complaint-page-heading"><div><span className="eyebrow">SUPPORT CENTRE</span><h1>{title}</h1><p>{audience === "student" ? "Submit a concern and follow the conversation through to resolution." : "Review and respond to concerns linked to your properties."}</p></div><div className="complaint-count"><strong>{newCount}</strong><span>Active</span></div></section>
      {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
      {notice && <div className="property-alert property-alert-success" role="status">{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}
      <div className="complaint-workspace">
        <aside className="complaint-list-panel"><div className="complaint-list-title"><div><span className="eyebrow">INBOX</span><h2>Cases</h2></div>{audience === "student" && <button className="dashboard-primary-action" onClick={() => { setShowNew((value) => !value); setError(""); }}>{showNew ? "Close" : "New complaint"}</button>}</div>
          {loading ? <div className="property-empty-state">Loading cases…</div> : complaints.length === 0 ? <div className="property-empty-state"><h3>No complaints yet</h3><p>Submitted concerns will appear here.</p></div> : complaints.map((item) => <button className={`complaint-list-item ${selectedId === item.id ? "selected" : ""}`} key={item.id} onClick={() => { setSelectedId(item.id); setShowNew(false); }}><span className="eyebrow">{item.reference_number}</span><strong>{item.title}</strong><small>{item.property_name}</small><span className={`property-status-pill property-status-${item.status.toLowerCase()}`}>{item.status.replaceAll("_", " ")}</span></button>)}
        </aside>
        <section className="complaint-detail-panel">
          {showNew && audience === "student" ? <><div className="complaint-detail-heading"><div><span className="eyebrow">NEW CASE</span><h2>Submit a complaint</h2><p>Use this form for concerns that need follow-up from StudentHaven or a property provider.</p></div></div><form className="complaint-form" onSubmit={(event) => void submitNew(event)}>
            <label>Property<select required value={newComplaint.property_id} onChange={(event) => setNewComplaint((current) => ({ ...current, property_id: event.target.value }))}><option value="">Choose a property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.campus}</option>)}</select></label>
            <label>Category<select value={newComplaint.category} onChange={(event) => setNewComplaint((current) => ({ ...current, category: event.target.value as ComplaintCategory }))}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label>Title<input maxLength={150} value={newComplaint.title} onChange={(event) => setNewComplaint((current) => ({ ...current, title: event.target.value }))} required placeholder="Briefly describe the concern" /></label>
            <label>Details<textarea minLength={10} maxLength={10000} rows={7} value={newComplaint.description} onChange={(event) => setNewComplaint((current) => ({ ...current, description: event.target.value }))} required placeholder="Include what happened, when it happened, and what help you need." /></label>
            <button className="dashboard-primary-action" disabled={saving}>{saving ? "Submitting…" : "Submit complaint"}</button>
          </form></> : detailLoading ? <div className="property-empty-state">Loading case details…</div> : selected ? <>
            <div className="complaint-detail-heading"><div><span className="eyebrow">{selected.reference_number} · {selected.category_display}</span><h2>{selected.title}</h2><p>{selected.property_name} · Reported by {audience === "student" ? "you" : selected.student_name} · {dateLabel(selected.created_at)}</p></div><span className={`property-status-pill property-status-${selected.status.toLowerCase()}`}>{selected.status.replaceAll("_", " ")}</span></div>
            <div className="complaint-description"><strong>Student report</strong><p>{selected.description}</p></div>
            <section className="complaint-conversation"><div className="complaint-conversation-heading"><div><span className="eyebrow">CASE CONVERSATION</span><h3>Messages</h3></div><span>{selected.messages?.length ?? 0}</span></div>
              {(selected.messages ?? []).length === 0 ? <p className="complaint-no-messages">No responses yet. Use the reply box to keep the case moving.</p> : <div className="complaint-messages">{selected.messages?.map((item) => <article className={`complaint-message ${item.sender_role === "STUDENT" ? "from-student" : "from-staff"}`} key={item.id}><div><strong>{item.sender_name}{item.is_internal ? " · Internal note" : ""}</strong><time>{dateLabel(item.created_at)}</time></div><p>{item.body}</p></article>)}</div>}
              <form className="complaint-reply-form" onSubmit={(event) => void submitReply(event)}><label>{audience === "student" ? "Add information" : "Reply to student"}<textarea rows={4} value={reply} onChange={(event) => setReply(event.target.value)} maxLength={5000} required placeholder="Write a clear, helpful response…" /></label><button className="dashboard-primary-action" disabled={saving}>{saving ? "Sending…" : "Send response"}</button></form>
            </section>
          </> : <div className="property-empty-state"><h2>Select a case</h2><p>Choose a complaint from the inbox to view its details and conversation.</p></div>}
        </section>
      </div>
      <Link className="complaint-back-link" to={dashboardPath}>Back to dashboard</Link>
    </main>
  </div>;
}

export default Complaints;
