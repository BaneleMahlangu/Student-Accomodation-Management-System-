import AdminNavigation from "../../components/AdminNavigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getAdminFundingRecords, updateAdminFundingRecord } from "../../services/api";
import type { AdminFundingRecord, FundingPayment } from "../../services/api";
import { formatRentCalculation } from "../../utils/rentCalculation";
import "../../App.css";

type AdminFundingProps = { mode: "funding" | "payments" };

function formatMoney(amount: string, currency: string) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(Number(amount));
}

function formatDate(value: string | null) {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function AdminFunding({ mode }: AdminFundingProps) {
  const [searchParams] = useSearchParams();
  const routeSearch = searchParams.get("search") ?? "";
  const [records, setRecords] = useState<AdminFundingRecord[]>([]);
  const [search, setSearch] = useState(routeSearch);
  const [statusFilter, setStatusFilter] = useState("");
  const [draftStatuses, setDraftStatuses] = useState<Record<number, FundingPayment["funding_status"]>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isPayments = mode === "payments";

  async function load(filters = { search, status: statusFilter }) {
    setLoading(true);
    setError("");
    try {
      const loaded = await getAdminFundingRecords({
        search: filters.search,
        ...(isPayments ? { payment_status: filters.status } : { funding_status: filters.status }),
      });
      setRecords(loaded);
      setDraftStatuses(Object.fromEntries(loaded.map((record) => [record.id, record.funding_status])));
      setNotes((current) => Object.fromEntries(loaded.map((record) => [record.id, current[record.id] || ""])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load funding records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSearch(routeSearch);
    setStatusFilter("");
    void load({ search: routeSearch, status: "" });
  }, [mode, routeSearch]);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load();
  }

  async function saveReview(record: AdminFundingRecord) {
    const note = (notes[record.id] || "").trim();
    if (!note) {
      setError("Add a review note to explain the funding decision.");
      return;
    }
    setSavingId(record.id);
    setError("");
    setNotice("");
    try {
      await updateAdminFundingRecord(record.id, draftStatuses[record.id] || record.funding_status, note);
      setNotice(`Funding review saved for ${record.application_number}.`);
      setNotes((current) => ({ ...current, [record.id]: "" }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the funding review.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="admin-dashboard-page admin-operations-page">
      <header className="admin-header"><Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link><div className="admin-header-title">{isPayments ? "Payment records" : "Funding review"}</div></header>
      <div className="admin-layout">
        <AdminNavigation />
        <main className="admin-content">
          <section className="admin-welcome"><div><span className="eyebrow">{isPayments ? "TRANSACTION HISTORY" : "STUDENT FUNDING"}</span><h1>{isPayments ? "Payment records" : "Funding review"}</h1><p>{isPayments ? "Review recorded transactions and their references. Payment statuses are provider-controlled." : "Review bursary, sponsorship and other funding records. Each decision is recorded and sent to the student."}</p></div></section>
          {isPayments && <div className="risk-review-notice" role="note"><strong>Payment confirmation</strong><span>Balances update only after a confirmed provider notification. Sandbox transactions are test records and do not transfer real funds.</span></div>}
          <form className="audit-filter-bar funding-filter-bar" onSubmit={submitFilters}>
            <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student, application, property or contract" /></label>
            <label>{isPayments ? "Payment status" : "Funding status"}<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{isPayments ? <><option value="PENDING">Pending</option><option value="PROCESSING">Processing</option><option value="SUCCESSFUL">Successful</option><option value="FAILED">Failed</option><option value="REVERSED">Reversed</option><option value="REFUNDED">Refunded</option></> : <><option value="PENDING">Pending</option><option value="VERIFIED">Verified</option><option value="PARTIALLY_FUNDED">Partially funded</option><option value="REJECTED">Rejected</option></>}</select></label>
            <button className="dashboard-primary-action">Apply filters</button>
          </form>
          {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}
          {notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}
          {loading ? <div className="property-empty-state">Loading records…</div> : records.length === 0 ? <div className="property-empty-state"><h2>No records found</h2><p>Funding records are created after a student signs an accommodation contract.</p></div> : <div className="audit-table-wrap"><table className="audit-table funding-record-table"><thead><tr><th>Student / application</th><th>Funding method</th><th>Funding status</th><th>Contract rent total</th><th>Paid / balance</th>{isPayments && <th>Transactions</th>}{!isPayments && <th>Review action</th>}</tr></thead><tbody>{records.map((record) => <tr key={record.id}><td><strong>{record.student_name}</strong><small>{record.student_email}</small><Link to={`/admin/applications/${record.application}`}>{record.application_number}</Link><small>{record.property_name} · {record.contract_number}</small><small>{formatDate(record.stay_start_date)} – {formatDate(record.stay_end_date)} · {formatMoney(record.monthly_rent, record.currency)}/month</small></td><td>{record.funding_method.replaceAll("_", " ")}</td><td><strong>{isPayments ? record.payment_status.replaceAll("_", " ") : record.funding_status.replaceAll("_", " ")}</strong>{record.funding_notes && <small>{record.funding_notes}</small>}</td><td>{formatMoney(record.amount_due, record.currency)}<small>{formatRentCalculation(record)}</small></td><td>{formatMoney(record.amount_paid, record.currency)}<small>Balance {formatMoney(record.balance, record.currency)} · {record.remaining_months} rent {record.remaining_months === 1 ? "month" : "months"} remaining</small></td>{isPayments && <td>{record.transactions.length === 0 ? "No transaction" : record.transactions.map((transaction) => <div className="funding-transaction-item" key={transaction.id}><strong>{transaction.provider} · {transaction.status}</strong><small>{transaction.transaction_reference}</small><small>{formatMoney(transaction.amount, transaction.currency)} · {transaction.processed_at ? new Date(transaction.processed_at).toLocaleString("en-ZA") : "Not processed"}</small></div>)}</td>}{!isPayments && <td><div className="funding-review-controls"><select aria-label={`Funding status for ${record.application_number}`} value={draftStatuses[record.id] || record.funding_status} onChange={(event) => setDraftStatuses((current) => ({ ...current, [record.id]: event.target.value as FundingPayment["funding_status"] }))}><option value="PENDING">Pending</option><option value="VERIFIED">Verified</option><option value="PARTIALLY_FUNDED">Partially funded</option><option value="REJECTED">Rejected</option></select><textarea aria-label={`Review note for ${record.application_number}`} rows={2} value={notes[record.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [record.id]: event.target.value }))} placeholder="Decision reason…" /><button disabled={savingId === record.id} onClick={() => void saveReview(record)}>{savingId === record.id ? "Saving…" : "Save review"}</button></div></td>}</tr>)}</tbody></table></div>}
          <p className="analytics-generated">Showing up to 500 matching records. Funding decisions are included in the audit log.</p>
        </main>
      </div>
    </div>
  );
}

export default AdminFunding;
