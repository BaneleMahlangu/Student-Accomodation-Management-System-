import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../../App.css";
import {
  decideAccommodationChangeRequest,
  getManagedAccommodationChangeRequests,
} from "../../services/api";
import type { AccommodationChangeRequest } from "../../services/api";

type Audience = "landlord" | "admin";

function AccommodationChangeRequests({ audience }: { audience: Audience }) {
  const [requests, setRequests] = useState<AccommodationChangeRequest[]>([]);
  const [filter, setFilter] = useState("PENDING");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRequests(await getManagedAccommodationChangeRequests(filter === "ALL" ? {} : { status: filter }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load accommodation requests.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  async function decide(item: AccommodationChangeRequest, decision: "APPROVED" | "DECLINED") {
    setSavingId(item.id);
    setError("");
    setMessage("");
    try {
      await decideAccommodationChangeRequest(item.id, decision, notes[item.id] || "");
      setMessage(`${item.request_type === "RENEWAL" ? "Renewal" : "Transfer"} request ${decision.toLowerCase()}. The student has been notified.`);
      await loadRequests();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the review decision.");
    } finally {
      setSavingId(null);
    }
  }

  const title = audience === "admin" ? "Renewal & transfer review" : "Tenant stay requests";
  const home = audience === "admin" ? "/admin/dashboard" : "/landlord/dashboard";
  const formatDate = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  return (
    <div className="change-requests-page">
      <header className="change-requests-header">
        <Link to={home}>← Back to {audience === "admin" ? "admin" : "landlord"} dashboard</Link>
        <span>{audience === "admin" ? "ADMINISTRATOR" : "LANDLORD"} · STUDENTHAVEN</span>
      </header>
      <main className="change-requests-main">
        <div className="change-requests-title-row">
          <div>
            <span className="section-eyebrow">ACCOMMODATION LIFECYCLE</span>
            <h1>{title}</h1>
            <p>Review student requests and record a clear decision for the accommodation file.</p>
          </div>
          <label className="change-requests-filter">Show
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="DECLINED">Declined</option>
              <option value="WITHDRAWN">Withdrawn</option>
              <option value="ALL">All requests</option>
            </select>
          </label>
        </div>

        {error && <div className="property-alert property-alert-error" role="alert">{error}</div>}
        {message && <div className="property-alert property-alert-success" role="status">{message}</div>}
        {loading ? <div className="dashboard-loading">Loading requests…</div> : requests.length === 0 ? (
          <div className="change-requests-empty"><strong>No requests in this view</strong><p>New renewal and transfer requests will appear here when students submit them.</p></div>
        ) : (
          <div className="change-requests-list">
            {requests.map((item) => {
              const adminOnlyTransfer = item.request_type === "TRANSFER" && audience !== "admin";
              const canReview = item.status === "PENDING" && !adminOnlyTransfer;
              return (
                <article className="change-review-card" key={item.id}>
                  <div className="change-review-topline">
                    <div><span className="section-eyebrow">{item.request_type === "RENEWAL" ? "RENEWAL" : "TRANSFER"} · {item.booking_number}</span><h2>{item.student_name || `Student ${item.student}`}</h2></div>
                    <span className={`change-request-status change-request-${item.status.toLowerCase()}`}>{item.status.replaceAll("_", " ")}</span>
                  </div>
                  <div className="change-review-facts">
                    <span><small>Current residence</small><strong>{item.current_property_name} · Room {item.current_room_number}</strong></span>
                    <span><small>Submitted</small><strong>{new Date(item.created_at).toLocaleDateString("en-ZA")}</strong></span>
                    {item.requested_end_date && <span><small>Requested end date</small><strong>{formatDate(item.requested_end_date)}</strong></span>}
                    {item.target_property_name && <span><small>Preferred destination</small><strong>{item.target_property_name}</strong></span>}
                  </div>
                  <div className="change-review-reason"><strong>Student’s reason</strong><p>{item.reason}</p></div>
                  {item.decision_note && <div className="change-review-reason"><strong>Review note</strong><p>{item.decision_note}</p></div>}
                  {adminOnlyTransfer && item.status === "PENDING" && <div className="change-review-notice">Transfer requests require administrator review because a move may involve another property and a new room allocation.</div>}
                  {canReview && (
                    <div className="change-review-actions">
                      <label>Review note<textarea rows={2} maxLength={2000} value={notes[item.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Explain the decision. A reason is required when declining." /></label>
                      {item.request_type === "RENEWAL" && <small>Approval records support to proceed with renewal coordination. Update the contract and booking separately after terms are agreed.</small>}
                      {item.request_type === "TRANSFER" && <small>Approval records support to coordinate a move. The current booking remains active until a new allocation and contract are confirmed.</small>}
                      <div>
                        <button type="button" className="secondary-button" disabled={savingId === item.id || (notes[item.id] || "").trim().length < 5} onClick={() => void decide(item, "DECLINED")}>{savingId === item.id ? "Saving…" : "Decline"}</button>
                        <button type="button" className="primary-button" disabled={savingId === item.id} onClick={() => void decide(item, "APPROVED")}>{savingId === item.id ? "Saving…" : "Approve for coordination"}</button>
                      </div>
                    </div>
                  )}
                  {item.status !== "PENDING" && item.reviewed_by_name && <small className="change-review-meta">Reviewed by {item.reviewed_by_name}{item.reviewed_at ? ` on ${new Date(item.reviewed_at).toLocaleDateString("en-ZA")}` : ""}</small>}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default AccommodationChangeRequests;
