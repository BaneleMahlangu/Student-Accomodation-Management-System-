import LandlordNavigation from "../../components/LandlordNavigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "../../App.css";
import { getManagedBookingTransferOptions, getManagedBookings, terminateManagedBooking, transferManagedBooking } from "../../services/api";
import type { ManagedBooking, ManagedBookingTransferRoom } from "../../services/api";

type ViewMode = "bookings" | "tenants";

function Occupancy({ mode }: { mode: ViewMode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState<ManagedBooking[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBooking, setActionBooking] = useState<ManagedBooking | null>(null);
  const [actionType, setActionType] = useState<"terminate" | "transfer" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [transferRooms, setTransferRooms] = useState<ManagedBookingTransferRoom[]>([]);
  const [targetBedId, setTargetBedId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [terminationConfirmed, setTerminationConfirmed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const rows = await getManagedBookings({ q: searchParams.get("q") || "", status: searchParams.get("status") || "" });
        if (!cancelled) setBookings(rows);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load your booking records.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [searchParams]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (query.trim()) next.set("q", query.trim());
    if (statusFilter) next.set("status", statusFilter);
    setSearchParams(next);
  }

  function closeAction() {
    if (actionLoading) return;
    setActionBooking(null);
    setActionType(null);
    setActionReason("");
    setTransferRooms([]);
    setTargetBedId("");
    setActionError("");
    setTerminationConfirmed(false);
  }

  function startTermination(booking: ManagedBooking) {
    setActionBooking(booking);
    setActionType("terminate");
    setActionReason("");
    setActionError("");
    setActionSuccess("");
    setTerminationConfirmed(false);
  }

  async function startTransfer(booking: ManagedBooking) {
    setActionBooking(booking);
    setActionType("transfer");
    setActionReason("");
    setActionError("");
    setActionSuccess("");
    setTransferRooms([]);
    setTargetBedId("");
    setActionLoading(true);
    try {
      setTransferRooms(await getManagedBookingTransferOptions(booking.id));
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Unable to load available rooms.");
    } finally {
      setActionLoading(false);
    }
  }

  async function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!actionBooking || !actionType) return;
    setActionLoading(true);
    setActionError("");
    try {
      const updated = actionType === "terminate"
        ? await terminateManagedBooking(actionBooking.id, actionReason.trim())
        : await transferManagedBooking(actionBooking.id, Number(targetBedId), actionReason.trim());
      setBookings((current) => current.map((item) => item.id === updated.id ? updated : item));
      setActionSuccess(actionType === "terminate"
        ? `Contract for ${updated.student_name} ended and the room allocation was released.`
        : `${updated.student_name} was moved to room ${updated.room_number}, bed ${updated.bed_number}.`);
      setActionBooking(null);
      setActionType(null);
      setActionReason("");
      setTransferRooms([]);
      setTargetBedId("");
      setTerminationConfirmed(false);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Unable to update this accommodation booking.");
    } finally {
      setActionLoading(false);
    }
  }

  const scopedRows = mode === "tenants"
    ? bookings.filter((item) => ["ACTIVE", "CONFIRMED"].includes(item.status))
    : bookings;
  const activeCount = bookings.filter((item) => item.status === "ACTIVE").length;
  const upcomingCount = bookings.filter((item) => item.status === "CONFIRMED").length;
  const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
  const currency = (value: string) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(Number(value));

  return (
    <div className="landlord-dashboard-page">
      <header className="landlord-header">
        <Link to="/landlord/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Landlord Portal</span></div></Link>
        <Link to="/account/security" className="occupancy-security-link">Account Security</Link>
      </header>
      <div className="occupancy-shell">
        <LandlordNavigation variant="occupancy" />
        <main className="occupancy-content">
          <div className="occupancy-heading">
            <div><span className="section-eyebrow">LANDLORD OPERATIONS</span><h1>{mode === "tenants" ? "Tenant directory" : "Booking register"}</h1><p>{mode === "tenants" ? "See incoming and checked-in students for properties you manage." : "Search bookings, room allocations and accommodation periods across your properties."}</p></div>
            <div className="occupancy-heading-links"><Link to="/landlord/tenants">Tenants</Link><Link to="/landlord/bookings">Bookings</Link></div>
          </div>

          <section className="occupancy-summary" aria-label="Occupancy summary">
            <article><span>Checked in</span><strong>{activeCount}</strong></article>
            <article><span>Upcoming check-ins</span><strong>{upcomingCount}</strong></article>
            <article><span>{mode === "tenants" ? "Listed tenants" : "All booking records"}</span><strong>{mode === "tenants" ? scopedRows.length : bookings.length}</strong></article>
          </section>

          <form className="occupancy-filter" onSubmit={applyFilters}>
            <label>Search bookings, students or properties<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, booking number, property" /></label>
            <label>Booking status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="CONFIRMED">Confirmed</option><option value="ACTIVE">Checked in</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option><option value="TRANSFERRED">Transferred</option></select></label>
            <button className="primary-button" type="submit">Apply filters</button>
          </form>

          {error && <div className="property-alert property-alert-error" role="alert">{error}</div>}
          {actionSuccess && <div className="property-alert property-alert-success" role="status">{actionSuccess}</div>}
          {loading ? <div className="dashboard-loading">Loading accommodation records…</div> : scopedRows.length === 0 ? (
            <div className="change-requests-empty"><strong>{mode === "tenants" ? "No current or upcoming tenants found" : "No bookings found"}</strong><p>Try another search or status filter. New confirmed bookings will appear here.</p></div>
          ) : (
            <div className="occupancy-records">
              {scopedRows.map((booking) => (
                <article className="occupancy-record" key={booking.id}>
                  <div className="occupancy-record-title"><div><span className="section-eyebrow">{booking.booking_number}</span><h2>{booking.student_name}</h2></div><span className={`change-request-status change-request-${booking.status === "ACTIVE" ? "approved" : booking.status === "COMPLETED" || booking.status === "CANCELLED" ? "declined" : "pending"}`}>{booking.status.replaceAll("_", " ")}</span></div>
                  <div className="occupancy-record-grid">
                    <span><small>Property</small><strong>{booking.property_name}</strong></span>
                    <span><small>Allocation</small><strong>Room {booking.room_number} · Bed {booking.bed_number}</strong></span>
                    <span><small>Accommodation period</small><strong>{formatDate(booking.start_date)} – {formatDate(booking.end_date)}</strong></span>
                    <span><small>Monthly fee</small><strong>{currency(booking.monthly_fee)}</strong></span>
                    <span><small>Email</small>{booking.student_email ? <a href={`mailto:${booking.student_email}`}>{booking.student_email}</a> : <strong>Not shared</strong>}</span>
                    <span><small>Phone</small><strong>{booking.student_mobile || "Not shared"}</strong></span>
                  </div>
                  <div className="occupancy-record-footer">
                    <span>{booking.checked_in_at ? `Checked in ${new Date(booking.checked_in_at).toLocaleDateString("en-ZA")}` : booking.checked_out_at ? `Checked out ${new Date(booking.checked_out_at).toLocaleDateString("en-ZA")}` : "Check-in not recorded"}</span>
                    <Link to={`/landlord/accommodation-requests`}>Review stay requests</Link>
                  </div>
                  {["ACTIVE", "CONFIRMED"].includes(booking.status) && <div className="occupancy-actions">
                    <button type="button" className="secondary-button" onClick={() => void startTransfer(booking)}>Move to another room</button>
                    <button type="button" className="occupancy-terminate-button" onClick={() => startTermination(booking)}>End contract</button>
                  </div>}
                  {booking.check_in_record && <div className="occupancy-check-in-audit"><strong>Arrival verified by {booking.check_in_record.staff_name}</strong><span>Photo ID checked · room inspected · keys handed over · {new Date(booking.check_in_record.checked_in_at).toLocaleString("en-ZA")}</span>{booking.check_in_record.arrival_notes && <p>{booking.check_in_record.arrival_notes}</p>}</div>}
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
      {actionBooking && actionType && <div className="occupancy-action-backdrop">
        <section className="occupancy-action-dialog" role="dialog" aria-modal="true" aria-labelledby="occupancy-action-title">
          <button type="button" className="occupancy-dialog-close" aria-label="Close" onClick={closeAction} disabled={actionLoading}>×</button>
          <span className="section-eyebrow">{actionBooking.booking_number}</span>
          <h2 id="occupancy-action-title">{actionType === "terminate" ? "End accommodation contract" : "Move student to another room"}</h2>
          <p className="occupancy-dialog-summary">{actionBooking.student_name} · {actionBooking.property_name} · Room {actionBooking.room_number}, bed {actionBooking.bed_number}</p>
          <form onSubmit={(event) => void submitAction(event)}>
            {actionType === "terminate" ? <>
              <div className="occupancy-termination-notice">This ends the signed contract and releases the allocated bed. Payment balances and refunds are not changed by this action.</div>
              <label className="occupancy-action-field">Reason for ending the contract<textarea required minLength={10} maxLength={2000} value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder="Record the reason for the student and the accommodation history." /></label>
              <label className="occupancy-confirm-action"><input type="checkbox" checked={terminationConfirmed} onChange={(event) => setTerminationConfirmed(event.target.checked)} />I understand this ends the contract and removes the student from this room.</label>
            </> : <>
              <p className="occupancy-transfer-note">Only available beds in this property with the same monthly rent are listed, so the signed contract amount stays accurate.</p>
              <label className="occupancy-action-field">Destination bed<select required value={targetBedId} onChange={(event) => setTargetBedId(event.target.value)} disabled={actionLoading || transferRooms.length === 0}><option value="">{actionLoading ? "Loading available beds…" : transferRooms.length ? "Choose a room and bed" : "No matching beds available"}</option>{transferRooms.flatMap((room) => room.beds.map((bed) => <option key={bed.id} value={bed.id}>Room {room.room_number} · Bed {bed.bed_number}</option>))}</select></label>
              <label className="occupancy-action-field">Reason for transfer<textarea required minLength={10} maxLength={2000} value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder="For example, room maintenance or an accessibility requirement." /></label>
            </>}
            {actionError && <div className="property-alert property-alert-error" role="alert">{actionError}</div>}
            <div className="occupancy-dialog-actions">
              <button type="button" className="secondary-button" onClick={closeAction} disabled={actionLoading}>Cancel</button>
              <button type="submit" className={actionType === "terminate" ? "occupancy-terminate-button" : "primary-button"} disabled={actionLoading || (actionType === "terminate" && !terminationConfirmed) || (actionType === "transfer" && (!targetBedId || transferRooms.length === 0))}>{actionLoading ? "Saving…" : actionType === "terminate" ? "End contract and release bed" : "Confirm room move"}</button>
            </div>
          </form>
        </section>
      </div>}
    </div>
  );
}

export default Occupancy;
