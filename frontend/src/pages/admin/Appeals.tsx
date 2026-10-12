import AdminNavigation from "../../components/AdminNavigation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { FormEvent } from "react";
import { API_BASE_URL, getCSRFToken } from "../../services/api";
import "../../App.css";

interface Appeal {
  id: number;
  application: number;
  application_number: string;
  student_name: string;
  student_email: string;
  property_name: string;
  status: "PENDING" | "IN_REVIEW" | "NEEDS_INFO" | "UPHELD" | "OVERTURNED";
  status_display: string;
  grounds: string;
  student_response: string;
  review_note: string;
  submitted_at: string;
  reviewed_at: string | null;
}

const actions: Appeal["status"][] = ["IN_REVIEW", "NEEDS_INFO", "UPHELD", "OVERTURNED"];

export default function AdminAppeals() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [filter, setFilter] = useState("");
  const [decisions, setDecisions] = useState<Record<number, Appeal["status"]>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load(nextFilter = filter) {
    setLoading(true); setError("");
    try {
      const query = nextFilter ? `?status=${encodeURIComponent(nextFilter)}` : "";
      const response = await fetch(`${API_BASE_URL}/applications/appeals/admin/${query}`, { credentials: "include", headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || data.detail || "Unable to load application appeals.");
      setAppeals(data.appeals);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load application appeals.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(""); }, []);

  async function decide(event: FormEvent, appeal: Appeal) {
    event.preventDefault();
    setSavingId(appeal.id); setError(""); setNotice("");
    try {
      await getCSRFToken();
      const csrf = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith("csrftoken="))?.split("=").slice(1).join("=");
      const response = await fetch(`${API_BASE_URL}/applications/appeals/admin/${appeal.id}/`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(csrf ? { "X-CSRFToken": decodeURIComponent(csrf) } : {}) },
        body: JSON.stringify({ decision: decisions[appeal.id] || "IN_REVIEW", review_note: notes[appeal.id] || "" }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || data.detail || "Unable to save appeal review.");
      setNotice(data.message || "Appeal review saved.");
      setNotes((current) => ({ ...current, [appeal.id]: "" }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save appeal review.");
    } finally {
      setSavingId(null);
    }
  }

  return <div className="admin-dashboard-page application-appeals-page">
    <header className="admin-header"><Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link><strong>Application Appeals</strong></header>
    <div className="admin-layout">
      <AdminNavigation />
      <main className="admin-main-content"><section className="admin-welcome"><span className="eyebrow">INDEPENDENT DECISION REVIEW</span><h1>Student application appeals</h1><p>Review the student’s grounds, request further information, uphold the original decision, or return it for a fresh application review.</p></section>
        {error && <div className="property-alert property-alert-error" role="alert">{error}<button type="button" onClick={() => void load()}>Try again</button></div>}
        {notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}
        <form className="appeal-filter" onSubmit={(event) => { event.preventDefault(); void load(filter); }}><label htmlFor="appeal-status-filter">Appeal status</label><select id="appeal-status-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All</option><option value="PENDING">Pending review</option><option value="IN_REVIEW">Under review</option><option value="NEEDS_INFO">More information requested</option><option value="UPHELD">Original decision upheld</option><option value="OVERTURNED">Returned for fresh review</option></select><button className="dashboard-primary-action">Apply filter</button><span>{appeals.length} appeal{appeals.length === 1 ? "" : "s"}</span></form>
        {loading ? <div className="property-empty-state" role="status">Loading appeals…</div> : appeals.length === 0 ? <div className="property-empty-state"><h2>No appeals in this view</h2><p>New student appeals will appear here for staff review.</p></div> : <section className="application-appeal-queue">{appeals.map((appeal) => <article className="application-appeal-review-card" key={appeal.id}>
          <header><div><span className="eyebrow">{appeal.application_number}</span><h2>{appeal.student_name}</h2><p>{appeal.student_email} · {appeal.property_name}</p></div><span className={`application-appeal-badge appeal-${appeal.status.toLowerCase()}`}>{appeal.status_display}</span></header>
          <p><strong>Appeal grounds</strong><br />{appeal.grounds}</p>{appeal.student_response && <p><strong>Student response</strong><br />{appeal.student_response}</p>}{appeal.review_note && <p><strong>Previous review note</strong><br />{appeal.review_note}</p>}
          <small>Submitted {new Date(appeal.submitted_at).toLocaleString("en-ZA")}{appeal.reviewed_at ? ` · Last reviewed ${new Date(appeal.reviewed_at).toLocaleString("en-ZA")}` : ""}</small>
          {!(["UPHELD", "OVERTURNED"] as string[]).includes(appeal.status) && <form className="application-appeal-review-form" onSubmit={(event) => void decide(event, appeal)}>
            <label>Review action<select value={decisions[appeal.id] || "IN_REVIEW"} onChange={(event) => setDecisions((current) => ({ ...current, [appeal.id]: event.target.value as Appeal["status"] }))}>{actions.map((action) => <option key={action} value={action}>{action.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())}</option>)}</select></label>
            <label>Review note<textarea rows={3} maxLength={3000} value={notes[appeal.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [appeal.id]: event.target.value }))} placeholder="Record the reason for your action." /></label>
            <button className="dashboard-primary-action" disabled={savingId === appeal.id}>{savingId === appeal.id ? "Saving…" : "Save review"}</button>
            <Link to={`/admin/applications/${appeal.application}`}>Open application record</Link>
          </form>}
        </article>)}</section>}
      </main>
    </div>
  </div>;
}
