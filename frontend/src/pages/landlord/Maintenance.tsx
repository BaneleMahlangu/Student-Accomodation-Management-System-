import LandlordNavigation from "../../components/LandlordNavigation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../../App.css";
import { getComplaints, getLandlordMaintenanceRequests, updateComplaint, updateLandlordMaintenanceRequest } from "../../services/api";
import type { ComplaintStatus, MaintenanceRequest, MaintenanceStatus, StudentComplaint } from "../../services/api";

const nextStatuses: Partial<Record<MaintenanceStatus, MaintenanceStatus[]>> = {
  SUBMITTED: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS", "WAITING_FOR_PARTS"],
  IN_PROGRESS: ["WAITING_FOR_PARTS", "RESOLVED"],
  WAITING_FOR_PARTS: ["IN_PROGRESS", "RESOLVED"],
};

const complaintStatuses: ComplaintStatus[] = ["OPEN", "UNDER_REVIEW", "AWAITING_RESPONSE", "RESOLVED", "CLOSED", "ESCALATED"];

function LandlordMaintenance() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [filter, setFilter] = useState("");
  const [nextStatus, setNextStatus] = useState<Record<number, MaintenanceStatus>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [complaints, setComplaints] = useState<StudentComplaint[]>([]);
  const [complaintFilter, setComplaintFilter] = useState<ComplaintStatus | "">("");
  const [complaintStatus, setComplaintStatus] = useState<Record<number, ComplaintStatus>>({});
  const [complaintResolution, setComplaintResolution] = useState<Record<number, string>>({});
  const [complaintSavingId, setComplaintSavingId] = useState<number | null>(null);
  const [complaintsLoading, setComplaintsLoading] = useState(true);
  const [complaintError, setComplaintError] = useState("");
  const [complaintNotice, setComplaintNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await getLandlordMaintenanceRequests(filter);
        if (active) setRequests(result);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load maintenance requests.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [filter]);

  useEffect(() => {
    let active = true;
    async function load() {
      setComplaintsLoading(true);
      setComplaintError("");
      try {
        const result = await getComplaints(complaintFilter);
        if (active) setComplaints(result);
      } catch (caught) {
        if (active) setComplaintError(caught instanceof Error ? caught.message : "Unable to load student complaints.");
      } finally {
        if (active) setComplaintsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [complaintFilter]);

  async function save(request: MaintenanceRequest) {
    const status = nextStatus[request.id];
    if (!status) return;
    setSavingId(request.id); setError(""); setNotice("");
    try {
      await updateLandlordMaintenanceRequest(request.id, {
        status,
        ...(status === "RESOLVED" ? { resolution_notes: notes[request.id] || "" } : {}),
      });
      setNotice(`${request.reference_number} updated. The student was notified.`);
      setRequests(await getLandlordMaintenanceRequests(filter));
      setNextStatus((all) => { const next = { ...all }; delete next[request.id]; return next; });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the maintenance request.");
    } finally {
      setSavingId(null);
    }
  }

  async function saveComplaint(complaint: StudentComplaint) {
    const status = complaintStatus[complaint.id];
    if (!status) return;
    setComplaintSavingId(complaint.id);
    setComplaintError("");
    setComplaintNotice("");
    try {
      const updated = await updateComplaint(complaint.id, {
        status,
        resolution: complaintResolution[complaint.id] ?? complaint.resolution,
      });
      setComplaints((items) => {
        const next = items.map((item) => item.id === updated.id ? updated : item);
        return complaintFilter && updated.status !== complaintFilter
          ? next.filter((item) => item.id !== updated.id)
          : next;
      });
      setComplaintStatus((items) => { const next = { ...items }; delete next[complaint.id]; return next; });
      setComplaintResolution((items) => ({ ...items, [complaint.id]: updated.resolution }));
      setComplaintNotice(`${complaint.reference_number} updated. The student was notified.`);
    } catch (caught) {
      setComplaintError(caught instanceof Error ? caught.message : "Unable to update the complaint.");
    } finally {
      setComplaintSavingId(null);
    }
  }

  const dateTime = (value: string) => new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="landlord-dashboard-page">
      <header className="landlord-header"><Link to="/landlord/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Landlord Portal</span></div></Link><Link to="/account/security" className="occupancy-security-link">Account Security</Link></header>
      <div className="occupancy-shell">
        <LandlordNavigation variant="occupancy" />
        <main className="occupancy-content">
          <div className="occupancy-heading"><div><span className="section-eyebrow">PROPERTY OPERATIONS</span><h1>Maintenance requests</h1><p>Track repair requests for your properties, update work status and tell students when work is complete.</p></div><label className="change-requests-filter">Filter status<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All statuses</option><option value="SUBMITTED">Submitted</option><option value="ASSIGNED">Assigned</option><option value="IN_PROGRESS">In progress</option><option value="WAITING_FOR_PARTS">Waiting for parts</option><option value="RESOLVED">Resolved</option><option value="STUDENT_CONFIRMED">Student confirmed</option><option value="ESCALATED">Escalated</option><option value="CANCELLED">Cancelled</option></select></label></div>
          {error && <div className="property-alert property-alert-error" role="alert">{error}</div>}
          {notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}
          {loading ? <div className="dashboard-loading">Loading maintenance requests…</div> : requests.length === 0 ? <div className="change-requests-empty"><strong>No maintenance requests in this view</strong><p>Requests from checked-in students will appear here.</p></div> : (
            <div className="occupancy-records">
              {requests.map((request) => {
                const choices = nextStatuses[request.status] || [];
                return <article className="occupancy-record landlord-maintenance-card" key={request.id}>
                  <div className="occupancy-record-title"><div><span className="section-eyebrow">{request.reference_number} · {request.priority_display}</span><h2>{request.title}</h2></div><span className={`change-request-status change-request-${request.status === "RESOLVED" || request.status === "STUDENT_CONFIRMED" ? "approved" : request.status === "CANCELLED" ? "declined" : "pending"}`}>{request.status_display}</span></div>
                  <div className="occupancy-record-grid"><span><small>Student</small><strong>{request.student_name}</strong></span><span><small>Property</small><strong>{request.property_name}</strong></span><span><small>Room / bed</small><strong>{request.room_number} / {request.bed_number}</strong></span><span><small>Category</small><strong>{request.category_display}</strong></span><span><small>Submitted</small><strong>{dateTime(request.submitted_at)}</strong></span><span><small>Assigned to</small><strong>{request.assigned_to_name || "Not assigned"}</strong></span></div>
                  <div className="change-review-reason"><strong>Issue reported</strong><p>{request.description}</p>{request.photo && <a href={request.photo} target="_blank" rel="noreferrer">View attached photo</a>}</div>
                  {request.resolution_notes && <div className="change-review-reason"><strong>Resolution notes</strong><p>{request.resolution_notes}</p></div>}
                  {choices.length > 0 && <div className="change-review-actions"><label>Update status<select value={nextStatus[request.id] || ""} onChange={(event) => setNextStatus((all) => ({ ...all, [request.id]: event.target.value as MaintenanceStatus }))}><option value="">Choose next step</option>{choices.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>{nextStatus[request.id] === "RESOLVED" && <label>Describe the repair<textarea rows={3} minLength={10} value={notes[request.id] || ""} onChange={(event) => setNotes((all) => ({ ...all, [request.id]: event.target.value }))} placeholder="Explain what was repaired or replaced." /></label>}<div><button type="button" className="primary-button" disabled={!nextStatus[request.id] || savingId === request.id || (nextStatus[request.id] === "RESOLVED" && (notes[request.id] || "").trim().length < 10)} onClick={() => void save(request)}>{savingId === request.id ? "Saving…" : "Save update"}</button></div></div>}
                </article>;
              })}
            </div>
          )}
          <section className="landlord-maintenance-complaints" aria-labelledby="landlord-complaints-title">
            <div className="change-requests-title-row">
              <div><span className="section-eyebrow">STUDENT REPORTS</span><h2 id="landlord-complaints-title">Student complaints</h2><p>Review concerns reported about your properties and update each case status.</p></div>
              <label className="change-requests-filter">Filter complaints<select value={complaintFilter} onChange={(event) => setComplaintFilter(event.target.value as ComplaintStatus | "")}><option value="">All statuses</option>{complaintStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
            </div>
            {complaintError && <div className="property-alert property-alert-error" role="alert">{complaintError}</div>}
            {complaintNotice && <div className="property-alert property-alert-success" role="status">{complaintNotice}</div>}
            {complaintsLoading ? <div className="dashboard-loading">Loading student complaints…</div> : complaints.length === 0 ? <div className="change-requests-empty"><strong>No student complaints in this view</strong><p>Complaints linked to your properties will appear here.</p></div> : (
              <div className="occupancy-records">
                {complaints.map((complaint) => <article className="occupancy-record landlord-maintenance-card" key={complaint.id}>
                  <div className="occupancy-record-title"><div><span className="section-eyebrow">{complaint.reference_number} · {complaint.category_display}</span><h2>{complaint.title}</h2></div><span className={`property-status-pill property-status-${complaint.status.toLowerCase()}`}>{complaint.status.replaceAll("_", " ")}</span></div>
                  <div className="occupancy-record-grid"><span><small>Student</small><strong>{complaint.student_name}</strong></span><span><small>Property</small><strong>{complaint.property_name}</strong></span>{complaint.application_number && <span><small>Application</small><strong>{complaint.application_number}</strong></span>}<span><small>Priority</small><strong>{complaint.priority}</strong></span><span><small>Submitted</small><strong>{dateTime(complaint.created_at)}</strong></span></div>
                  <div className="change-review-reason"><strong>Complaint details</strong><p>{complaint.description}</p></div>
                  {complaint.resolution && <div className="change-review-reason"><strong>Resolution summary</strong><p>{complaint.resolution}</p></div>}
                  <div className="change-review-actions landlord-complaint-actions">
                    <label>Update status<select value={complaintStatus[complaint.id] ?? ""} onChange={(event) => setComplaintStatus((items) => ({ ...items, [complaint.id]: event.target.value as ComplaintStatus }))}><option value="">Choose a status</option>{complaintStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
                    {(complaintStatus[complaint.id] === "RESOLVED" || complaintStatus[complaint.id] === "CLOSED") && <label>Resolution summary<textarea rows={3} value={complaintResolution[complaint.id] ?? complaint.resolution} onChange={(event) => setComplaintResolution((items) => ({ ...items, [complaint.id]: event.target.value }))} placeholder="Describe how the complaint was resolved." /></label>}
                    <div><button type="button" className="primary-button" disabled={!complaintStatus[complaint.id] || complaintSavingId === complaint.id} onClick={() => void saveComplaint(complaint)}>{complaintSavingId === complaint.id ? "Saving…" : "Save update"}</button></div>
                  </div>
                </article>)}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default LandlordMaintenance;
