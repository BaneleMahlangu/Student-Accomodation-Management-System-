import AdminNavigation from "../../components/AdminNavigation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminRefundRequests, updateAdminRefundRequest } from "../../services/api";
import type { RefundRequest } from "../../services/api";
import "../../App.css";

function Refunds() {
  const [rows, setRows] = useState<RefundRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [references, setReferences] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load(filter = statusFilter) {
    setLoading(true);
    setError("");
    try {
      setRows(await getAdminRefundRequests(filter));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load refund requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(""); }, []);

  async function decide(row: RefundRequest, next: RefundRequest["status"]) {
    const reviewNote = (notes[row.id] || "").trim();
    if (!reviewNote) { setError("Add a staff note explaining this action."); return; }
    const providerReference = (references[row.id] || "").trim();
    if (next === "REFUNDED" && !providerReference) { setError("Enter the PayFast refund reference after verifying the refund with the provider."); return; }
    setBusy(row.id); setError(""); setNotice("");
    try {
      await updateAdminRefundRequest(row.id, next, reviewNote, providerReference);
      setNotice(`Refund request ${row.id} updated.`);
      setNotes((current) => ({ ...current, [row.id]: "" }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update refund request.");
    } finally { setBusy(null); }
  }

  return <div className="admin-dashboard-page admin-operations-page">
    <header className="admin-header"><Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link><div className="admin-header-title">Refund review</div></header>
    <div className="admin-layout">
      <AdminNavigation />
      <main className="admin-content">
        <section className="admin-welcome"><div><span className="eyebrow">PAYMENT SUPPORT</span><h1>Refund requests</h1><p>Review student requests and keep provider processing evidence with the financial record.</p></div></section>
        <div className="risk-review-notice" role="note"><strong>Provider processing is manual.</strong><span>Approve a valid request, process it through the PayFast merchant account, then record the PayFast refund reference here. StudentHaven does not issue PayFast refunds automatically.</span></div>
        <label className="refund-filter">Filter requests<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); void load(event.target.value); }}><option value="">All statuses</option>{["PENDING", "APPROVED", "PROCESSING", "REJECTED", "REFUNDED", "FAILED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
        {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}{notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}
        {loading ? <div className="property-empty-state">Loading refund requests…</div> : rows.length === 0 ? <div className="property-empty-state"><h2>No refund requests</h2><p>Student requests will appear here after successful PayFast payments.</p></div> : <div className="refund-request-list">{rows.map((row) => {
          const actions: RefundRequest["status"][] = row.status === "PENDING" ? ["APPROVED", "REJECTED"] : row.status === "APPROVED" ? ["PROCESSING", "REFUNDED", "FAILED", "REJECTED"] : row.status === "PROCESSING" ? ["REFUNDED", "FAILED"] : [];
          return <article className="refund-request-card" key={row.id}>
            <div className="refund-card-heading"><div><span className="eyebrow">REQUEST {row.id} · {new Date(row.requested_at).toLocaleString("en-ZA")}</span><h2>{row.student_name} <small>({row.student_email})</small></h2></div><span className="funding-status-badge">{row.status.replaceAll("_", " ")}</span></div>
            <p><strong>{new Intl.NumberFormat("en-ZA", { style: "currency", currency: row.currency }).format(Number(row.amount))}</strong> requested from {row.provider} payment {row.transaction_reference} ({new Intl.NumberFormat("en-ZA", { style: "currency", currency: row.currency }).format(Number(row.transaction_amount))}).</p>
            <p><strong>Application:</strong> <Link to={`/admin/applications/${row.application}`}>{row.application_number}</Link> · {row.property_name}</p><p><strong>Student reason:</strong> {row.reason}</p>
            {row.provider_reference && <p><strong>Provider reference:</strong> {row.provider_reference}</p>}{row.review_note && <p><strong>Last staff note:</strong> {row.review_note}</p>}
            {actions.length > 0 && <div className="refund-review-controls"><label>Staff note<textarea rows={2} value={notes[row.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Explain the review decision or provider action" /></label>{actions.includes("REFUNDED") && <label>PayFast refund reference<input value={references[row.id] || ""} onChange={(event) => setReferences((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Provider confirmation reference" /></label>}<div>{actions.map((next) => <button key={next} className={next === "REJECTED" || next === "FAILED" ? "secondary-button" : "primary-button"} disabled={busy === row.id} onClick={() => void decide(row, next)}>{busy === row.id ? "Saving…" : next.replaceAll("_", " ")}</button>)}</div></div>}
          </article>;
        })}</div>}
      </main>
    </div>
  </div>;
}

export default Refunds;
