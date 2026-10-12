import LandlordNavigation from "../../components/LandlordNavigation";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../../App.css";
import {
  getLandlordApplications,
  reopenApplicationReview,
  startApplicationReview,
  submitApplicationDecision,
} from "../../services/api";
import type { LandlordApplication } from "../../services/api";

function LandlordApplications() {
  const [applications, setApplications] = useState<LandlordApplication[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionNotes, setActionNotes] = useState<Record<number, string>>({});
  const [declineReasons, setDeclineReasons] = useState<Record<number, string>>({});
  const [decisionFeedback, setDecisionFeedback] = useState<Record<number, { type: "error" | "success"; message: string; field?: "request" | "decline" | "action" }>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setApplications(await getLandlordApplications({ q: search.trim(), status: statusFilter }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load property applications.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadApplications(); }, 180);
    return () => window.clearTimeout(timer);
  }, [loadApplications]);

  async function startReview(applicationId: number) {
    setBusyId(applicationId);
    setError("");
    setNotice("");
    try {
      const result = await startApplicationReview(applicationId);
      setNotice(result.message || "Application moved into review.");
      await loadApplications();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start application review.");
    } finally {
      setBusyId(null);
    }
  }

  async function makeDecision(applicationId: number, decision: "APPROVED" | "DECLINED" | "WAITING_LIST" | "ADDITIONAL_INFO") {
    const note = (actionNotes[applicationId] || "").trim();
    const declineReason = (declineReasons[applicationId] || "").trim();
    if (decision === "DECLINED" && !declineReason) {
      setDecisionFeedback((current) => ({ ...current, [applicationId]: { type: "error", field: "decline", message: "Add a reason before declining this application." } }));
      return;
    }
    if (decision === "ADDITIONAL_INFO" && !note) {
      setDecisionFeedback((current) => ({ ...current, [applicationId]: { type: "error", field: "request", message: "Type the information you are requesting from the student." } }));
      return;
    }

    setBusyId(applicationId);
    setDecisionFeedback((current) => {
      const next = { ...current };
      delete next[applicationId];
      return next;
    });
    try {
      const result = await submitApplicationDecision(applicationId, decision, note, declineReason);
      setDecisionFeedback((current) => ({ ...current, [applicationId]: {
        type: "success",
        message: decision === "ADDITIONAL_INFO" ? "Request sent to the student." : result.message || "Application decision saved.",
      } }));
      setActionNotes((current) => ({ ...current, [applicationId]: "" }));
      setDeclineReasons((current) => ({ ...current, [applicationId]: "" }));
      await loadApplications();
    } catch (caught) {
      setDecisionFeedback((current) => ({ ...current, [applicationId]: {
        type: "error",
        field: "action",
        message: caught instanceof Error ? caught.message : "Unable to save the application decision.",
      } }));
    } finally {
      setBusyId(null);
    }
  }

  async function reopenReview(applicationId: number) {
    setBusyId(applicationId);
    setError("");
    setNotice("");
    try {
      const result = await reopenApplicationReview(applicationId, (actionNotes[applicationId] || "").trim());
      setNotice(result.message || "Application returned to review.");
      setActionNotes((current) => ({ ...current, [applicationId]: "" }));
      await loadApplications();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reopen application review.");
    } finally {
      setBusyId(null);
    }
  }

  const counts = applications.reduce<Record<string, number>>((all, item) => ({ ...all, [item.status]: (all[item.status] || 0) + 1 }), {});
  const formatDate = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "Not set";

  return (
    <div className="landlord-dashboard-page">
      <header className="landlord-header">
        <Link to="/landlord/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Landlord Portal</span></div></Link>
        <Link to="/account/security" className="occupancy-security-link">Account Security</Link>
      </header>
      <div className="occupancy-shell">
        <LandlordNavigation variant="occupancy" />
        <main className="occupancy-content">
          <div className="occupancy-heading"><div><span className="section-eyebrow">LANDLORD OPERATIONS</span><h1>Property applications</h1><p>Review student applications for your properties and make the accommodation decision.</p></div><Link to="/landlord/messages" className="secondary-button">Open messages</Link></div>
          <section className="occupancy-summary" aria-label="Application status counts">
            <article><span>Awaiting landlord decision</span><strong>{(counts.SUBMITTED || 0) + (counts.UNDER_REVIEW || 0)}</strong></article>
            <article><span>Approved</span><strong>{counts.APPROVED || 0}</strong></article>
            <article><span>All visible applications</span><strong>{applications.length}</strong></article>
          </section>
          <div className="landlord-app-filter">
            <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student, application, course or property" /></label>
            <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="SUBMITTED">Submitted</option><option value="UNDER_REVIEW">Under review</option><option value="ADDITIONAL_INFO">Additional information</option><option value="APPROVED">Approved</option><option value="DECLINED">Declined</option><option value="WAITLISTED">Waitlisted</option><option value="WAITING_LIST">Waiting list</option></select></label>
          </div>
          {error && <div className="property-alert property-alert-error" role="alert">{error}</div>}
          {notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}
          {loading ? <div className="dashboard-loading">Loading student applications…</div> : applications.length === 0 ? (
            <div className="change-requests-empty"><strong>No applications found</strong><p>Applications submitted for your approved properties will appear here.</p></div>
          ) : (
            <div className="occupancy-records">
              {applications.map((application) => (
                <article className="occupancy-record landlord-application-card" key={application.id}>
                  <div className="occupancy-record-title"><div><span className="section-eyebrow">{application.application_number} · {application.property_name}</span><h2>{application.student_name}</h2></div><span className={`change-request-status change-request-${application.status === "APPROVED" ? "approved" : application.status === "DECLINED" ? "declined" : "pending"}`}>{application.status.replaceAll("_", " ")}</span></div>
                  <div className="occupancy-record-grid">
                    <span><small>Requested room</small><strong>{application.room_number}</strong></span>
                    <span><small>University / campus</small><strong>{application.university || "—"} · {application.campus || "—"}</strong></span>
                    <span><small>Course / year</small><strong>{application.course || "—"}{application.year_of_study ? ` · Year ${application.year_of_study}` : ""}</strong></span>
                    <span><small>Requested stay</small><strong>{formatDate(application.expected_sign_in_date)} – {formatDate(application.expected_sign_out_date)}</strong></span>
                    <span><small>Funding method</small><strong>{application.funding_method.replaceAll("_", " ")}</strong></span>
                    <span><small>Accessibility</small><strong>{application.accessibility_required ? "Requested" : "Not requested"}</strong></span>
                    <span><small>Submitted</small><strong>{formatDate(application.submitted_at)}</strong></span>
                  </div>
                  <div className="occupancy-record-footer"><span>{application.meal_preference ? `Meal preference: ${application.meal_preference}` : "No meal preference provided"}</span><Link to={`/landlord/applications/${application.id}/documents`}>Review documents</Link><Link to="/landlord/accommodation-requests">View stay requests</Link></div>
                  {decisionFeedback[application.id]?.type === "success" && <div className="property-alert property-alert-success" role="status">{decisionFeedback[application.id].message}</div>}
                  {application.status === "ADDITIONAL_INFO" && application.admin_notes && <div className="landlord-information-request"><strong>Request sent to student</strong><p>{application.admin_notes}</p></div>}
                  {(["SUBMITTED", "ADDITIONAL_INFO"].includes(application.status)) && <div className="landlord-application-actions"><p>{application.status === "ADDITIONAL_INFO" ? "Continue reviewing this application after the student responds." : "This application is ready for your review."}</p><button className="dashboard-primary-action" disabled={busyId === application.id} onClick={() => void startReview(application.id)}>{busyId === application.id ? "Opening review…" : application.status === "ADDITIONAL_INFO" ? "Continue review" : "Start review"}</button></div>}
                  {application.status === "UNDER_REVIEW" && <div className="landlord-application-actions">
                    <label className="landlord-application-feedback">Message to the student<textarea rows={3} value={actionNotes[application.id] || ""} onChange={(event) => { setActionNotes((current) => ({ ...current, [application.id]: event.target.value })); setDecisionFeedback((current) => { if (current[application.id]?.type !== "error" || current[application.id]?.field !== "request") return current; const next = { ...current }; delete next[application.id]; return next; }); }} placeholder="Type any information or documents the student needs to provide." />{decisionFeedback[application.id]?.field === "request" && <span className="landlord-application-inline-error" role="alert">{decisionFeedback[application.id].message}</span>}</label>
                    <label className="landlord-application-feedback">Decline reason<textarea rows={2} value={declineReasons[application.id] || ""} onChange={(event) => { setDeclineReasons((current) => ({ ...current, [application.id]: event.target.value })); setDecisionFeedback((current) => { if (current[application.id]?.type !== "error" || current[application.id]?.field !== "decline") return current; const next = { ...current }; delete next[application.id]; return next; }); }} placeholder="Required only when declining." />{decisionFeedback[application.id]?.field === "decline" && <span className="landlord-application-inline-error" role="alert">{decisionFeedback[application.id].message}</span>}</label>
                    {decisionFeedback[application.id]?.field === "action" && <p className="landlord-application-inline-error" role="alert">{decisionFeedback[application.id].message}</p>}
                    <div className="landlord-application-buttons"><button className="dashboard-primary-action" disabled={busyId === application.id} onClick={() => void makeDecision(application.id, "APPROVED")}>{busyId === application.id ? "Saving…" : "Approve"}</button><button className="admin-directory-secondary-button" disabled={busyId === application.id} onClick={() => void makeDecision(application.id, "WAITING_LIST")}>Add to waiting list</button><button className="admin-directory-secondary-button" disabled={busyId === application.id} onClick={() => void makeDecision(application.id, "ADDITIONAL_INFO")}>Request information</button><button className="admin-directory-secondary-button" disabled={busyId === application.id} onClick={() => void makeDecision(application.id, "DECLINED")}>Decline application</button></div>
                  </div>}
                  {["APPROVED", "DECLINED", "WAITING_LIST", "WAITLISTED"].includes(application.status) && <div className="landlord-application-actions"><label className="landlord-application-feedback">Note for reopening (optional)<textarea rows={2} value={actionNotes[application.id] || ""} onChange={(event) => setActionNotes((current) => ({ ...current, [application.id]: event.target.value }))} placeholder="Add context for the student." /></label><button className="admin-directory-secondary-button" disabled={busyId === application.id} onClick={() => void reopenReview(application.id)}>{busyId === application.id ? "Reopening…" : "Reopen for review"}</button></div>}
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default LandlordApplications;
