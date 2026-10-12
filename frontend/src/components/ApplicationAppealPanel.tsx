import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { API_BASE_URL, getCSRFToken } from "../services/api";

interface Appeal {
  id: number;
  status: string;
  status_display: string;
  grounds: string;
  student_response: string;
  review_note: string;
  reviewed_by_name: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

interface Props {
  applicationId: number;
  status: string;
  reviewedAt: string | null;
}

export default function ApplicationAppealPanel({ applicationId, status, reviewedAt }: Props) {
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [windowDays, setWindowDays] = useState(14);
  const [grounds, setGrounds] = useState("");
  const [studentResponse, setStudentResponse] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAppeal() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/applications/${applicationId}/appeal/`, { credentials: "include", headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || data.detail || "Unable to load appeal information.");
      setAppeal(data.appeal);
      setWindowDays(data.appeal_window_days || 14);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load appeal information.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAppeal(); }, [applicationId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      await getCSRFToken();
      const csrf = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith("csrftoken="))?.split("=").slice(1).join("=");
      const hasAppealInfoRequest = appeal?.status === "NEEDS_INFO";
      const response = await fetch(`${API_BASE_URL}/applications/${applicationId}/appeal/`, {
        method: hasAppealInfoRequest ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(csrf ? { "X-CSRFToken": decodeURIComponent(csrf) } : {}) },
        body: JSON.stringify(hasAppealInfoRequest ? { student_response: studentResponse } : { grounds }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || data.detail || "Unable to submit the appeal update.");
      setAppeal(data.appeal); setMessage(data.message || "Your update has been submitted."); setGrounds(""); setStudentResponse("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit the appeal update.");
    } finally {
      setSaving(false);
    }
  }

  const appealExpired = reviewedAt ? Date.now() > new Date(reviewedAt).getTime() + windowDays * 86400000 : true;
  if (status !== "DECLINED" && !appeal && !loading) return null;

  return <section className="application-details-card application-appeal-panel" aria-labelledby="application-appeal-title">
    <div className="application-details-card-header"><div><span className="application-eyebrow">DECISION REVIEW</span><h2 id="application-appeal-title">Appeal an application decision</h2></div></div>
    {loading ? <p role="status">Loading appeal status…</p> : <>
      {error && <div className="property-alert property-alert-error" role="alert">{error}<button type="button" onClick={() => void loadAppeal()}>Try again</button></div>}
      {message && <div className="property-alert property-alert-success" role="status">{message}</div>}
      {appeal ? <div className="application-appeal-status">
        <span className={`application-appeal-badge appeal-${appeal.status.toLowerCase()}`}>{appeal.status_display}</span>
        <p><strong>Your appeal:</strong> {appeal.grounds}</p>
        {appeal.student_response && <p><strong>Your response:</strong> {appeal.student_response}</p>}
        {appeal.review_note && <p><strong>Administrator update:</strong> {appeal.review_note}</p>}
        <small>Submitted {new Date(appeal.submitted_at).toLocaleString("en-ZA")}{appeal.reviewed_by_name ? ` · Reviewed by ${appeal.reviewed_by_name}` : ""}</small>
        {appeal.status === "NEEDS_INFO" && <form className="application-appeal-form" onSubmit={(event) => void submit(event)}><label htmlFor="appeal-response">Reply to the administrator’s information request<textarea id="appeal-response" required minLength={10} maxLength={5000} rows={4} value={studentResponse} onChange={(event) => setStudentResponse(event.target.value)} /></label><button className="dashboard-primary-action" disabled={saving || studentResponse.trim().length < 10}>{saving ? "Sending…" : "Send response"}</button></form>}
      </div> : status === "DECLINED" ? <>
        <p className="application-details-note">If you believe the decision was based on incorrect or incomplete information, submit one appeal within {windowDays} days of the decision. An appeal requests a new human review; it does not automatically approve accommodation.</p>
        {appealExpired ? <div className="risk-review-notice" role="status"><strong>The appeal period has ended.</strong><span>Contact StudentHaven support if you need help with an exceptional circumstance.</span></div> : <form className="application-appeal-form" onSubmit={(event) => void submit(event)}><label htmlFor="appeal-grounds">Why are you appealing this decision?<textarea id="appeal-grounds" required minLength={30} maxLength={5000} rows={5} value={grounds} onChange={(event) => setGrounds(event.target.value)} placeholder="Explain what information should be reviewed and why." /><small>{grounds.length}/5,000 characters</small></label><button className="dashboard-primary-action" disabled={saving || grounds.trim().length < 30}>{saving ? "Submitting…" : "Submit appeal"}</button></form>}
      </> : null}
    </>}
  </section>;
}
