import AdminNavigation from "../../components/AdminNavigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { getAdminLandlordRiskSignals, getAdminRiskSignals, refreshAdminRiskSignals, updateAdminLandlordRiskSignal, updateAdminRiskSignal } from "../../services/api";
import type { AdminLandlordRiskSignal, AdminRiskSignal, RiskSignalStatus } from "../../services/api";
import "../../App.css";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

function AdminRisk() {
  const [signals, setSignals] = useState<AdminRiskSignal[]>([]);
  const [landlordSignals, setLandlordSignals] = useState<AdminLandlordRiskSignal[]>([]);
  const [subjectTab, setSubjectTab] = useState<"students" | "landlords">("students");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [landlordNotes, setLandlordNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingLandlordId, setSavingLandlordId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load(filters = { search, status: statusFilter, severity: severityFilter }) {
    setLoading(true);
    setError("");
    try {
      const [studentSignals, providerSignals] = await Promise.all([
        getAdminRiskSignals(filters),
        getAdminLandlordRiskSignals(filters),
      ]);
      setSignals(studentSignals);
      setLandlordSignals(providerSignals);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load review signals.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load({ search: "", status: "", severity: "" });
  }, []);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load();
  }

  async function refreshSignals() {
    setRefreshing(true);
    setError("");
    setNotice("");
    try {
      const result = await refreshAdminRiskSignals();
      setNotice(`${result.message} ${result.new_signals} new signal${result.new_signals === 1 ? "" : "s"} recorded.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh review signals.");
    } finally {
      setRefreshing(false);
    }
  }

  async function decide(signal: AdminRiskSignal, nextStatus: RiskSignalStatus) {
    const note = (notes[signal.id] || "").trim();
    if ((nextStatus === "DISMISSED" || nextStatus === "RESOLVED") && !note) {
      setError("Add a short review note before dismissing or resolving a signal.");
      return;
    }
    setSavingId(signal.id);
    setError("");
    setNotice("");
    try {
      await updateAdminRiskSignal(signal.id, nextStatus, note);
      setNotice(`Review updated for ${signal.application_number}.`);
      setNotes((current) => ({ ...current, [signal.id]: "" }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update this review signal.");
    } finally {
      setSavingId(null);
    }
  }

  async function decideLandlord(signal: AdminLandlordRiskSignal, nextStatus: RiskSignalStatus) {
    const note = (landlordNotes[signal.id] || "").trim();
    if ((nextStatus === "DISMISSED" || nextStatus === "RESOLVED") && !note) {
      setError("Add a short review note before dismissing or resolving a signal.");
      return;
    }
    setSavingLandlordId(signal.id);
    setError("");
    setNotice("");
    try {
      await updateAdminLandlordRiskSignal(signal.id, nextStatus, note);
      setNotice(`Landlord review updated for ${signal.landlord_name}.`);
      setLandlordNotes((current) => ({ ...current, [signal.id]: "" }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update this landlord review signal.");
    } finally {
      setSavingLandlordId(null);
    }
  }

  const allSignals = [...signals, ...landlordSignals];
  const openCount = allSignals.filter((signal) => signal.status === "OPEN").length;
  const inReviewCount = allSignals.filter((signal) => signal.status === "IN_REVIEW").length;
  const highCount = allSignals.filter((signal) => signal.severity === "HIGH" && signal.status !== "DISMISSED" && signal.status !== "RESOLVED").length;

  return (
    <div className="admin-dashboard-page admin-operations-page">
      <header className="admin-header">
        <Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link>
        <div className="admin-header-title">Risk review</div>
      </header>
      <div className="admin-layout">
        <AdminNavigation />
        <main className="admin-content">
          <section className="admin-welcome risk-page-heading"><div><span className="eyebrow">STUDENT & LANDLORD REVIEW SIGNALS</span><h1>Risk review</h1><p>Review unusual activity patterns and record a reasoned human decision.</p></div><button className="dashboard-primary-action" disabled={refreshing} onClick={() => void refreshSignals()}>{refreshing ? "Scanning recent activity…" : "Scan recent activity"}</button></section>

          <div className="risk-review-notice" role="note"><strong>Signals are prompts for review, not findings of misconduct.</strong><span>They never change an application or student’s eligibility automatically. Check the context and record your decision.</span></div>
          <section className="risk-summary-grid" aria-label="Review signal counts"><article><span>Open</span><strong>{openCount}</strong></article><article><span>Under review</span><strong>{inReviewCount}</strong></article><article><span>High severity, open</span><strong>{highCount}</strong></article></section>

          <div className="risk-subject-tabs" role="tablist" aria-label="Risk signal subject"><button type="button" role="tab" aria-selected={subjectTab === "students"} className={subjectTab === "students" ? "active" : ""} onClick={() => setSubjectTab("students")}>Students <span>{signals.length}</span></button><button type="button" role="tab" aria-selected={subjectTab === "landlords"} className={subjectTab === "landlords" ? "active" : ""} onClick={() => setSubjectTab("landlords")}>Landlords <span>{landlordSignals.length}</span></button></div>

          <form className="audit-filter-bar risk-filter-bar" onSubmit={applyFilters}>
            <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={subjectTab === "students" ? "Student, application or property" : "Landlord or property"} /></label>
            <label>Review status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="OPEN">Open</option><option value="IN_REVIEW">Under review</option><option value="DISMISSED">Dismissed</option><option value="RESOLVED">Resolved</option></select></label>
            <label>Severity<select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}><option value="">All severities</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label>
            <button className="dashboard-primary-action">Apply filters</button>
          </form>

          {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}
          {notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}
          {loading ? <div className="property-empty-state">Loading review signals…</div> : subjectTab === "students" && signals.length === 0 ? <div className="property-empty-state"><h2>No student review signals found</h2><p>Use the scan to check recent applications and document uploads, or adjust the filters.</p></div> : subjectTab === "landlords" && landlordSignals.length === 0 ? <div className="property-empty-state"><h2>No landlord review signals found</h2><p>Use the scan to check recent property activity, or adjust the filters.</p></div> : subjectTab === "students" ? <section className="risk-signal-list" aria-label="Student review signals">
            {signals.map((signal) => <article className="risk-signal-card" key={signal.id}>
              <div className="risk-signal-topline"><span className={`risk-severity risk-severity-${signal.severity.toLowerCase()}`}>{signal.severity} severity</span><span className={`risk-status risk-status-${signal.status.toLowerCase()}`}>{signal.status.replaceAll("_", " ")}</span><time>{formatDate(signal.created_at)}</time></div>
              <div className="risk-signal-main"><div><h2>{signal.signal_type_display}</h2><p>{signal.explanation}</p></div><dl><div><dt>Student</dt><dd>{signal.student_name}<small>{signal.student_email}</small></dd></div><div><dt>Application</dt><dd><Link to={`/admin/applications/${signal.application}`}>{signal.application_number}</Link><small>{signal.property_name}</small></dd></div><div><dt>Occurrences</dt><dd>{signal.occurrence_count}</dd></div></dl></div>
              {signal.review_note && <p className="risk-review-history"><strong>Last review:</strong> {signal.review_note}{signal.reviewed_by ? ` — ${signal.reviewed_by}` : ""}</p>}
              {signal.status !== "DISMISSED" && signal.status !== "RESOLVED" && <div className="risk-review-actions"><label htmlFor={`risk-note-${signal.id}`}>Review note{signal.status !== "IN_REVIEW" && <span> (required to close)</span>}<textarea id={`risk-note-${signal.id}`} rows={2} value={notes[signal.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [signal.id]: event.target.value }))} placeholder="Record what you checked and why…" /></label><div><button disabled={savingId === signal.id} onClick={() => void decide(signal, "IN_REVIEW")}>{savingId === signal.id ? "Saving…" : "Mark under review"}</button><button disabled={savingId === signal.id} onClick={() => void decide(signal, "DISMISSED")}>Dismiss</button><button disabled={savingId === signal.id} onClick={() => void decide(signal, "RESOLVED")}>Resolve</button></div></div>}
            </article>)}
          </section> : <section className="risk-signal-list" aria-label="Landlord review signals">
            {landlordSignals.map((signal) => <article className="risk-signal-card" key={signal.id}>
              <div className="risk-signal-topline"><span className={`risk-severity risk-severity-${signal.severity.toLowerCase()}`}>{signal.severity} severity</span><span className={`risk-status risk-status-${signal.status.toLowerCase()}`}>{signal.status.replaceAll("_", " ")}</span><time>{formatDate(signal.created_at)}</time></div>
              <div className="risk-signal-main"><div><h2>{signal.signal_type_display}</h2><p>{signal.explanation}</p></div><dl><div><dt>Landlord</dt><dd>{signal.landlord_name}<small>{signal.landlord_email}</small></dd></div><div><dt>Related listing</dt><dd>{signal.property_name}{signal.property && <small>Listing #{signal.property}</small>}</dd></div><div><dt>Occurrences</dt><dd>{signal.occurrence_count}</dd></div></dl></div>
              {signal.review_note && <p className="risk-review-history"><strong>Last review:</strong> {signal.review_note}{signal.reviewed_by ? ` — ${signal.reviewed_by}` : ""}</p>}
              {signal.status !== "DISMISSED" && signal.status !== "RESOLVED" && <div className="risk-review-actions"><label htmlFor={`landlord-risk-note-${signal.id}`}>Review note{signal.status !== "IN_REVIEW" && <span> (required to close)</span>}<textarea id={`landlord-risk-note-${signal.id}`} rows={2} value={landlordNotes[signal.id] || ""} onChange={(event) => setLandlordNotes((current) => ({ ...current, [signal.id]: event.target.value }))} placeholder="Record what you checked and why…" /></label><div><button disabled={savingLandlordId === signal.id} onClick={() => void decideLandlord(signal, "IN_REVIEW")}>{savingLandlordId === signal.id ? "Saving…" : "Mark under review"}</button><button disabled={savingLandlordId === signal.id} onClick={() => void decideLandlord(signal, "DISMISSED")}>Dismiss</button><button disabled={savingLandlordId === signal.id} onClick={() => void decideLandlord(signal, "RESOLVED")}>Resolve</button></div></div>}
            </article>)}
          </section>}
          <p className="analytics-generated">Showing up to 500 matching signals per group. Signals never suspend accounts or decide applications; staff review actions are audited.</p>
        </main>
      </div>
    </div>
  );
}

export default AdminRisk;
