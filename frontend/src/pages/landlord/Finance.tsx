import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminNavigation from "../../components/AdminNavigation";
import LandlordNavigation from "../../components/LandlordNavigation";
import "../../App.css";
import { getLandlordContracts, getLandlordFundingPayments } from "../../services/api";
import type { FundingPayment, StudentContract } from "../../services/api";
import { formatRentCalculation } from "../../utils/rentCalculation";

type FinanceView = "contracts" | "payments";
type FinanceAudience = "landlord" | "admin";

function Finance({ view, audience = "landlord" }: { view: FinanceView; audience?: FinanceAudience }) {
  const [searchParams] = useSearchParams();
  const routeSearch = searchParams.get("search") ?? "";
  const [contracts, setContracts] = useState<StudentContract[]>([]);
  const [payments, setPayments] = useState<FundingPayment[]>([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState(routeSearch);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { setSearch(routeSearch); }, [view, routeSearch]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        if (view === "contracts") {
          const rows = await getLandlordContracts(filter, search);
          if (active) setContracts(rows);
        } else {
          const rows = await getLandlordFundingPayments(filter);
          if (active) setPayments(rows);
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load financial records.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [view, filter, search]);

  const title = view === "contracts" ? "Accommodation contracts" : "Funding & payment records";
  const dashboardPath = audience === "admin" ? "/admin/dashboard" : "/landlord/dashboard";
  const contractsPath = audience === "admin" ? "/admin/contracts" : "/landlord/contracts";
  const paymentsPath = audience === "admin" ? "/admin/payments" : "/landlord/payments";
  const formatDate = (value: string | null) => value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    : "—";
  const currency = (amount: string, code = "ZAR") => new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(Number(amount));
  const count = view === "contracts" ? contracts.length : payments.length;

  const contractRecords = contracts.length === 0 ? (
    <div className="change-requests-empty">
      <strong>No contracts found</strong>
      <p>Contracts created for students in your properties will appear here.</p>
    </div>
  ) : (
    <div className="occupancy-records">
      {contracts.map((contract) => {
        const statusClass = contract.status === "SIGNED"
          ? "approved"
          : contract.status === "CANCELLED" || contract.status === "EXPIRED"
            ? "declined"
            : "pending";

        return (
          <article className="occupancy-record" key={contract.id}>
            <div className="occupancy-record-title">
              <div>
                <span className="section-eyebrow">{contract.contract_number}</span>
                <h2>{contract.student_name}</h2>
              </div>
              <span className={`change-request-status change-request-${statusClass}`}>
                {contract.status.replaceAll("_", " ")}
              </span>
            </div>
            <div className="occupancy-record-grid">
              <span><small>Property</small><strong>{contract.property_name}</strong></span>
              <span><small>Room</small><strong>{contract.room_number}</strong></span>
              <span><small>Accommodation period</small><strong>{formatDate(contract.start_date)} – {formatDate(contract.end_date)}</strong></span>
              <span><small>Monthly fee</small><strong>{currency(contract.monthly_fee)}</strong></span>
              <span><small>Signed</small><strong>{contract.signed_at ? new Date(contract.signed_at).toLocaleDateString("en-ZA") : "Not signed"}</strong></span>
              <span><small>Created</small><strong>{formatDate(contract.created_at)}</strong></span>
            </div>
            <details className="landlord-contract-terms">
              <summary>View contract terms</summary>
              <p>{contract.terms || "No terms recorded."}</p>
              {contract.rules && (
                <>
                  <strong>Residence rules</strong>
                  <p>{contract.rules}</p>
                </>
              )}
              {contract.cancellation_policy && (
                <>
                  <strong>Cancellation policy</strong>
                  <p>{contract.cancellation_policy}</p>
                </>
              )}
            </details>
          </article>
        );
      })}
    </div>
  );

  const paymentRecords = payments.length === 0 ? (
    <div className="change-requests-empty">
      <strong>No payment records found</strong>
      <p>Payment records linked to your accommodation bookings will appear here.</p>
    </div>
  ) : (
    <div className="occupancy-records">
      {payments.map((payment) => {
        const statusClass = payment.payment_status === "SUCCESSFUL"
          ? "approved"
          : payment.payment_status === "FAILED" || payment.payment_status === "REVERSED"
            ? "declined"
            : "pending";

        return (
          <article className="occupancy-record" key={payment.id}>
            <div className="occupancy-record-title">
              <div>
                <span className="section-eyebrow">{payment.payment_reference || `Funding record ${payment.id}`}</span>
                <h2>{payment.student_name}</h2>
              </div>
              <span className={`change-request-status change-request-${statusClass}`}>
                {payment.payment_status.replaceAll("_", " ")}
              </span>
            </div>
            <div className="occupancy-record-grid">
              <span><small>Property</small><strong>{payment.property_name}</strong></span>
              <span><small>Funding method</small><strong>{payment.funding_method.replaceAll("_", " ")}</strong></span>
              <span><small>Funding status</small><strong>{payment.funding_status.replaceAll("_", " ")}</strong></span>
              <span><small>Monthly rent</small><strong>{currency(payment.monthly_rent, payment.currency)}</strong></span>
              <span><small>Accommodation period</small><strong>{formatDate(payment.stay_start_date)} – {formatDate(payment.stay_end_date)}</strong></span>
              <span><small>Contract rent total</small><strong>{currency(payment.amount_due, payment.currency)}</strong><small>{formatRentCalculation(payment)}</small></span>
              <span><small>Amount paid</small><strong>{currency(payment.amount_paid, payment.currency)}</strong></span>
              <span><small>Outstanding balance</small><strong>{currency(payment.balance, payment.currency)}</strong><small>{payment.remaining_months} rent {payment.remaining_months === 1 ? "month" : "months"} remaining</small></span>
              <span><small>First rent due</small><strong>{formatDate(payment.due_date)}</strong></span>
            </div>
            {payment.transactions.length > 0 && (
              <details className="landlord-contract-terms">
                <summary>Payment activity ({payment.transactions.length})</summary>
                {payment.transactions.map((transaction) => (
                  <p key={transaction.id}>
                    {transaction.transaction_reference} · {currency(transaction.amount, transaction.currency)} · {transaction.status.replaceAll("_", " ")} · {formatDate(transaction.processed_at)}
                  </p>
                ))}
              </details>
            )}
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="landlord-dashboard-page">
      <header className="landlord-header">
        <Link to={dashboardPath} className="dashboard-brand">
          <img src="/SH-logo.jpg" alt="StudentHaven" />
          <div><strong>StudentHaven</strong><span>{audience === "admin" ? "Administrator Console" : "Landlord Portal"}</span></div>
        </Link>
        <Link to="/account/security" className="occupancy-security-link">Account Security</Link>
      </header>
      <div className="occupancy-shell">
        {audience === "admin" ? <AdminNavigation variant="occupancy" /> : <LandlordNavigation variant="occupancy" />}
        <main className="occupancy-content">
          <div className="occupancy-heading">
            <div>
              <span className="section-eyebrow">LANDLORD OPERATIONS</span>
              <h1>{title}</h1>
              <p>{view === "contracts"
                ? "View the status and agreed terms of contracts for your managed properties."
                : "Track recorded funding, payments and outstanding balances linked to accommodation in your properties."}
              </p>
            </div>
            <div className="occupancy-heading-links">
              <Link to={contractsPath}>Contracts</Link>
              <Link to={paymentsPath}>Payments</Link>
            </div>
          </div>
          <div className="occupancy-summary">
            <article><span>Records in view</span><strong>{count}</strong></article>
            <article><span>{audience === "admin" ? "Platform scope" : "Property scope"}</span><strong>{audience === "admin" ? "All platform records" : "Your properties"}</strong></article>
            <article><span>Access</span><strong>Read only</strong></article>
          </div>
          {view === "contracts" && <label className="finance-filter">Search contracts<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Contract, student or property" /></label>}
          <label className="finance-filter">
            {view === "contracts" ? "Contract status" : "Payment status"}
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="">All statuses</option>
              {view === "contracts" ? (
                <>
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING_SIGNATURE">Pending signature</option>
                  <option value="SIGNED">Signed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="EXPIRED">Expired</option>
                </>
              ) : (
                <>
                  <option value="PENDING">Pending</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="SUCCESSFUL">Successful</option>
                  <option value="FAILED">Failed</option>
                  <option value="REVERSED">Reversed</option>
                  <option value="REFUNDED">Refunded</option>
                </>
              )}
            </select>
          </label>
          {error && <div className="property-alert property-alert-error" role="alert">{error}</div>}
          {loading
            ? <div className="dashboard-loading">Loading {view}…</div>
            : view === "contracts" ? contractRecords : paymentRecords}
        </main>
      </div>
    </div>
  );
}

export default Finance;
