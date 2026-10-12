import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

import "../../App.css";

import {
  getStudentBooking,
  checkOutStudentBooking,
  createAccommodationChangeRequest,
  getAccommodationChangeRequests,
  getTransferPropertyOptions,
  withdrawAccommodationChangeRequest,
  getMyApplications,
} from "../../services/api";

import type {
  Booking,
  AccommodationChangeRequest,
  TransferPropertyOption,
} from "../../services/api";


function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}


function formatBookingStatus(status: string) {
  if (status === "ACTIVE") {
    return "Checked In";
  }

  if (status === "COMPLETED") {
    return "Checked Out";
  }

  return formatStatus(status);
}


function formatDate(dateValue: string | null) {
  if (!dateValue) {
    return "Not provided";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}


function formatDateTime(dateValue: string | null) {
  if (!dateValue) {
    return "Not recorded";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function formatMoney(amount: string) {
  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) {
    return `R ${amount}`;
  }

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(numericAmount);
}


function MyRoom() {
  const { applicationId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] =
    useState<Booking | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [actionLoading, setActionLoading] =
    useState(false);

  const [actionError, setActionError] =
    useState("");

  const [showCheckInQR, setShowCheckInQR] =
    useState(false);

  const [changeRequests, setChangeRequests] = useState<AccommodationChangeRequest[]>([]);
  const [transferOptions, setTransferOptions] = useState<TransferPropertyOption[]>([]);
  const [changeType, setChangeType] = useState<"RENEWAL" | "TRANSFER">("RENEWAL");
  const [requestedEndDate, setRequestedEndDate] = useState("");
  const [targetProperty, setTargetProperty] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState("");
  const [changeSuccess, setChangeSuccess] = useState("");


  useEffect(() => {
    async function loadBooking() {
      if (!applicationId) {
        try {
          const applications = await getMyApplications();
          const approved = applications.filter((application) => application.status === "APPROVED");
          for (const application of approved) {
            try {
              const confirmedBooking = await getStudentBooking(application.id);
              if (confirmedBooking) {
                navigate(`/student/my-room/${application.id}`, { replace: true });
                return;
              }
            } catch {
              // Continue to the next approved application that has a confirmed booking.
            }
          }
          setError("No confirmed accommodation booking is available yet. Approved applications will appear here after your booking is confirmed.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to find your accommodation booking.");
        }
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const result =
          await getStudentBooking(
            Number(applicationId)
          );

        setBooking(result);
        setShowCheckInQR(Boolean(result?.check_in_eligible));

      } catch (err) {

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your room information."
        );

      } finally {

        setLoading(false);
      }
    }

    loadBooking();

  }, [applicationId, navigate]);

  useEffect(() => {
    if (!applicationId) return;
    let cancelled = false;
    async function loadLifecycleRequests() {
      try {
        const [requests, properties] = await Promise.all([
          getAccommodationChangeRequests(Number(applicationId)),
          getTransferPropertyOptions(),
        ]);
        if (!cancelled) {
          setChangeRequests(requests);
          setTransferOptions(properties);
        }
      } catch (err) {
        if (!cancelled) setChangeError(err instanceof Error ? err.message : "Unable to load accommodation requests.");
      }
    }
    void loadLifecycleRequests();
    return () => { cancelled = true; };
  }, [applicationId]);

  async function refreshChangeRequests() {
    if (!applicationId) return;
    setChangeRequests(await getAccommodationChangeRequests(Number(applicationId)));
  }

  async function submitChangeRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!applicationId) return;
    setChangeLoading(true);
    setChangeError("");
    setChangeSuccess("");
    try {
      const created = await createAccommodationChangeRequest(Number(applicationId), {
        request_type: changeType,
        reason: changeReason.trim(),
        ...(changeType === "RENEWAL" ? { requested_end_date: requestedEndDate } : {}),
        ...(changeType === "TRANSFER" ? { target_property: targetProperty ? Number(targetProperty) : null } : {}),
      });
      setChangeRequests((current) => [created, ...current]);
      setChangeReason("");
      setRequestedEndDate("");
      setTargetProperty("");
      setChangeSuccess("Your request has been sent for review. We’ll notify you when there is an update.");
    } catch (err) {
      setChangeError(err instanceof Error ? err.message : "Unable to submit your request.");
    } finally {
      setChangeLoading(false);
    }
  }

  async function withdrawChangeRequest(requestId: number) {
    setChangeLoading(true);
    setChangeError("");
    try {
      await withdrawAccommodationChangeRequest(requestId);
      await refreshChangeRequests();
    } catch (err) {
      setChangeError(err instanceof Error ? err.message : "Unable to withdraw the request.");
    } finally {
      setChangeLoading(false);
    }
  }


  if (loading) {
    return (
      <div className="page-shell">

        <div className="loading-state">

          Loading your room information...

        </div>

      </div>
    );
  }


  if (error || !booking) {
    return (
      <div className="page-shell">

        <div className="error-state">

          <h1>
            My Room
          </h1>

          <p>
            {error ||
              "Check-in opens after your first rent installment is recorded and your room and bed are confirmed. Check your application for the next step."}
          </p>

          <Link
            to={
              applicationId
                ? `/applications/${applicationId}`
                : "/student/dashboard"
            }
            className="secondary-button"
          >
            Back to Application
          </Link>

          {applicationId && !error && (
            <Link
              to={`/funding/${applicationId}`}
              className="primary-button"
            >
              Review payment and room assignment
            </Link>
          )}

        </div>

      </div>
    );
  }


  return (
    <div className="page-shell">

      <div className="my-room-page">

        <Link className="page-return-link" to="/student/dashboard">
          ← Back to dashboard
        </Link>

        {/* ============================== */}
        {/* PAGE HEADER */}
        {/* ============================== */}

        <header className="my-room-header">

          <div>

            <span className="section-eyebrow">
              STUDENTHAVEN
            </span>

            <h1>
              My Room
            </h1>

            <p>
              View your confirmed accommodation,
              room and booking information.
            </p>

          </div>


          <div className="room-status-badge">

            <span>
              BOOKING STATUS
            </span>

            <strong>
              {formatBookingStatus(
                booking.status
              )}
            </strong>

          </div>

        </header>


        {/* ============================== */}
        {/* ACCOMMODATION */}
        {/* ============================== */}

        <section className="my-room-card">

          <div className="my-room-card-header">

            <div>

              <span className="section-eyebrow">
                ACCOMMODATION
              </span>

              <h2>
                {booking.property_name}
              </h2>

              <p>
                Your confirmed student accommodation
              </p>

            </div>

          </div>


          <div className="my-room-info-grid">

            <div>

              <span>
                Room
              </span>

              <strong>
                {booking.room_number}
              </strong>

            </div>


            <div>

              <span>
                Bed
              </span>

              <strong>
                {booking.bed_number}
              </strong>

            </div>


            <div>

              <span>
                Monthly fee
              </span>

              <strong>
                {formatMoney(
                  booking.monthly_fee
                )}
              </strong>

            </div>


            <div>

              <span>
                Booking number
              </span>

              <strong>
                {booking.booking_number}
              </strong>

            </div>

          </div>

        </section>


        {(booking.status === "CONFIRMED" || booking.status === "ACTIVE") && (
          <section className="accommodation-change-section">
            <div className="accommodation-change-heading">
              <span className="section-eyebrow">STAY CHANGES</span>
              <h2>Renew or request a transfer</h2>
              <p>Send a request to the residence team. An approval starts the coordination process; it does not change your current room, booking dates or contract by itself.</p>
            </div>

            {changeError && <div className="property-alert property-alert-error" role="alert">{changeError}</div>}
            {changeSuccess && <div className="property-alert property-alert-success" role="status">{changeSuccess}</div>}

            <form className="accommodation-change-form" onSubmit={submitChangeRequest}>
              <label>
                Request type
                <select value={changeType} onChange={(event) => setChangeType(event.target.value as "RENEWAL" | "TRANSFER")}>
                  <option value="RENEWAL">Renew my stay</option>
                  <option value="TRANSFER" disabled={booking.status !== "ACTIVE"}>Request a transfer{booking.status !== "ACTIVE" ? " (available after check-in)" : ""}</option>
                </select>
              </label>

              {changeType === "RENEWAL" ? (
                <label>
                  Requested new end date
                  <input
                    required
                    type="date"
                    min={(() => { const date = new Date(`${booking.end_date}T00:00:00`); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10); })()}
                    value={requestedEndDate}
                    onChange={(event) => setRequestedEndDate(event.target.value)}
                  />
                </label>
              ) : (
                <label>
                  Preferred destination
                  <select value={targetProperty} onChange={(event) => setTargetProperty(event.target.value)}>
                    <option value="">No specific property</option>
                    {transferOptions.filter((property) => property.id !== booking.property).map((property) => (
                      <option key={property.id} value={property.id}>{property.name} · {property.campus_name}</option>
                    ))}
                  </select>
                  <small>Destinations shown have an approved listing and an available bed today. Availability will be checked again during review.</small>
                </label>
              )}

              <label className="accommodation-change-reason">
                Tell us why
                <textarea required minLength={10} maxLength={2000} rows={4} value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Share the reason for your request and any timing or accessibility needs." />
              </label>
              <button className="primary-button" type="submit" disabled={changeLoading || changeReason.trim().length < 10 || (changeType === "RENEWAL" && !requestedEndDate)}>
                {changeLoading ? "Sending…" : "Submit request"}
              </button>
            </form>

            <div className="accommodation-change-history">
              <h3>Your requests</h3>
              {changeRequests.length === 0 ? <p>You haven’t submitted any renewal or transfer requests for this booking.</p> : changeRequests.map((item) => (
                <article className="accommodation-change-card" key={item.id}>
                  <div className="accommodation-change-card-title">
                    <strong>{item.request_type === "RENEWAL" ? "Renewal request" : "Transfer request"}</strong>
                    <span className={`change-request-status change-request-${item.status.toLowerCase()}`}>{formatStatus(item.status)}</span>
                  </div>
                  <p>{item.reason}</p>
                  {item.requested_end_date && <p><strong>Requested end date:</strong> {formatDate(item.requested_end_date)}</p>}
                  {item.target_property_name && <p><strong>Preferred property:</strong> {item.target_property_name}</p>}
                  {item.decision_note && <p><strong>Review note:</strong> {item.decision_note}</p>}
                  {item.status === "APPROVED" && <small>Staff approval is recorded. The updated stay or transfer is not complete until the new booking and contract are confirmed.</small>}
                  {item.status === "PENDING" && <button type="button" className="text-button" disabled={changeLoading} onClick={() => void withdrawChangeRequest(item.id)}>Withdraw request</button>}
                </article>
              ))}
            </div>
          </section>
        )}


        {/* ============================== */}
        {/* BOOKING PERIOD */}
        {/* ============================== */}

        <section className="my-room-card">

          <div className="my-room-card-header">

            <div>

              <span className="section-eyebrow">
                BOOKING PERIOD
              </span>

              <h2>
                Your accommodation dates
              </h2>

            </div>

          </div>


          <div className="my-room-date-grid">

            <div>

              <span>
                Check-in date
              </span>

              <strong>
                {formatDate(
                  booking.start_date
                )}
              </strong>

            </div>


            <div>

              <span>
                Check-out date
              </span>

              <strong>
                {formatDate(
                  booking.end_date
                )}
              </strong>

            </div>


            <div>

              <span>
                Booking confirmed
              </span>

              <strong>
                {formatDate(
                  booking.confirmed_at
                )}
              </strong>

            </div>

          </div>

        </section>


        {/* ============================== */}
        {/* ROOM DETAILS */}
        {/* ============================== */}

        <section className="my-room-card">

          <div className="my-room-card-header">

            <div>

              <span className="section-eyebrow">
                ROOM DETAILS
              </span>

              <h2>
                Your allocated room
              </h2>

            </div>

          </div>


          <div className="room-detail-highlight">

            <div>

              <span>
                Residence
              </span>

              <strong>
                {booking.property_name}
              </strong>

            </div>


            <div>

              <span>
                Room number
              </span>

              <strong>
                {booking.room_number}
              </strong>

            </div>


            <div>

              <span>
                Bed number
              </span>

              <strong>
                {booking.bed_number}
              </strong>

            </div>


            <div>

              <span>
                Current status
              </span>

              <strong>
                {formatBookingStatus(
                  booking.status
                )}
              </strong>

            </div>

          </div>

        </section>


        {/* ============================== */}
        {/* CHECK-IN & CHECK-OUT */}
        {/* ============================== */}

        <section className="my-room-card">

          <div className="my-room-card-header">

            <div>

              <span className="section-eyebrow">
                CHECK-IN & CHECK-OUT
              </span>

              <h2>
                Accommodation access
              </h2>

              <p>
                Manage your actual arrival and departure
                from StudentHaven.
              </p>

            </div>

          </div>


          {/* ============================== */}
          {/* STATUS INFORMATION */}
          {/* ============================== */}

          <div className="my-room-info-grid">

            <div>

              <span>
                Check-in status
              </span>

              <strong>

                {booking.status === "CONFIRMED"

                  ? booking.check_in_eligible
                    ? "Ready for check-in"
                    : `Opens ${formatDate(
                      booking.start_date
                    )}`

                  : booking.status === "ACTIVE"

                    ? "Checked In"

                    : booking.status === "COMPLETED"

                      ? "Checked Out"

                      : formatBookingStatus(
                        booking.status
                      )}

              </strong>

            </div>


            <div>

              <span>
                Checked in
              </span>

              <strong>

                {booking.checked_in_at

                  ? formatDateTime(
                    booking.checked_in_at
                  )

                  : "Not yet"}

              </strong>

            </div>


            <div>

              <span>
                Checked out
              </span>

              <strong>

                {booking.checked_out_at

                  ? formatDateTime(
                    booking.checked_out_at
                  )

                  : "Not yet"}

              </strong>

            </div>

          </div>


          {/* ============================== */}
          {/* ACTION ERROR */}
          {/* ============================== */}

          {actionError && (

            <div className="error-state">

              <p>
                {actionError}
              </p>

            </div>

          )}


          {/* ============================== */}
          {/* CHECK-IN / CHECK-OUT BUTTONS */}
          {/* ============================== */}

          <div className="my-room-actions">


            {booking.status === "CONFIRMED" && (
              <div className="my-room-check-in-note">
                <strong>Residence staff complete check-in</strong>
                <span>Show your check-in QR and photo ID at the property. Staff will verify your assigned room and bed, check the room, and hand over access before recording your arrival.</span>
              </div>
            )}


            {/* CHECK OUT */}

            {booking.status === "ACTIVE" && (

              <button
                type="button"
                className="primary-button"
                disabled={actionLoading}
                onClick={async () => {

                  if (!applicationId) {
                    return;
                  }


                  const confirmed =
                    window.confirm(
                      "Are you sure you want to check out of your accommodation?"
                    );


                  if (!confirmed) {
                    return;
                  }


                  try {

                    setActionLoading(true);

                    setActionError("");

                    const updatedBooking =
                      await checkOutStudentBooking(
                        Number(applicationId)
                      );

                    setBooking(updatedBooking);

                  } catch (err) {

                    setActionError(
                      err instanceof Error
                        ? err.message
                        : "Unable to check you out."
                    );

                  } finally {

                    setActionLoading(false);

                  }

                }}
              >

                {actionLoading
                  ? "Checking out..."
                  : "Check Out"}

              </button>

            )}


            {/* CHECK-IN DATE MESSAGE */}

            {booking.status === "CONFIRMED" &&
              !booking.check_in_eligible && (

                <p>

                  Check-in becomes available on{" "}

                  <strong>
                    {formatDate(
                      booking.start_date
                    )}
                  </strong>

                </p>

              )}


            {/* ACTIVE MESSAGE */}

            {booking.status === "ACTIVE" && (

              <p>
                You are currently checked in to this
                accommodation.
                {booking.check_in_record && (
                  <small className="my-room-check-in-record">
                    <br />Arrival recorded by {booking.check_in_record.staff_name} on {formatDate(booking.check_in_record.checked_in_at)}. Photo ID, room condition and access handover were confirmed.
                  </small>
                )}
              </p>

            )}


            {/* COMPLETED MESSAGE */}

            {booking.status === "COMPLETED" && (

              <p>
                This accommodation booking has been
                completed.
              </p>

            )}

          </div>


          {/* ============================== */}
          {/* DIGITAL CHECK-IN QR */}
          {/* ============================== */}

          {booking.status === "CONFIRMED" && (

            <div className="my-room-qr-area">

              <div className="my-room-qr-header">

                <span className="section-eyebrow">
                  MOBILE CHECK-IN
                </span>

                <h3>
                  Check-in QR
                </h3>

                <p>
                  Present your StudentHaven QR code
                  to authorised residence staff when
                  you arrive.
                </p>

              </div>


              {/* QR AVAILABLE */}

              {booking.check_in_eligible ? (

                <div className="my-room-qr-content">

                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      setShowCheckInQR(
                        !showCheckInQR
                      )
                    }
                  >

                    {showCheckInQR
                      ? "Hide Check-in QR"
                      : "Show Check-in QR"}

                  </button>


                  {showCheckInQR && (

                    <div className="my-room-qr">

                      <QRCodeSVG
                        value={
                          booking.check_in_token
                        }
                        size={360}
                        level="H"
                        includeMargin
                      />

                      <strong>
                        Show this QR code to
                        residence staff
                      </strong>

                      <p>
                        Booking{" "}
                        {booking.booking_number}
                      </p>

                    </div>

                  )}

                </div>

              ) : (

                /* QR NOT AVAILABLE YET */

                <div className="my-room-qr-unavailable">

                  <strong>
                    Check-in QR unavailable
                  </strong>

                  <p>
                    Your QR code will become available
                    on{" "}

                    <strong>
                      {formatDate(
                        booking.start_date
                      )}
                    </strong>

                    .
                  </p>

                </div>

              )}

            </div>

          )}


          {/* ============================== */}
          {/* CHECK-IN COMPLETED */}
          {/* ============================== */}

          {booking.status === "ACTIVE" && (

            <div className="my-room-qr-success">

              <strong>
                Check-in completed
              </strong>

              <p>
                Your accommodation access is active.
              </p>

            </div>

          )}


          {/* ============================== */}
          {/* CHECK-OUT COMPLETED */}
          {/* ============================== */}

          {booking.status === "COMPLETED" && (

            <div className="my-room-qr-success">

              <strong>
                Accommodation stay completed
              </strong>

              <p>
                Your check-out has been recorded.
              </p>

            </div>

          )}

        </section>


        {/* ============================== */}
        {/* NEXT STEPS */}
        {/* ============================== */}

        <section className="my-room-next-section">

          <div>

            <span className="section-eyebrow">
              NEXT STEPS
            </span>

            <h2>
              Manage your accommodation
            </h2>

            <p>
              View your contract and manage your
              accommodation payments.
            </p>

          </div>


          <div className="my-room-actions">

            <Link
              to={`/contracts/${booking.application}`}
              className="primary-button"
            >
              View Contract
            </Link>


            <Link
              to={`/funding/${booking.application}`}
              className="secondary-button"
            >
              Funding & Payments
            </Link>


            <Link
              to={`/applications/${booking.application}`}
              className="secondary-button"
            >
              View Application
            </Link>

          </div>

        </section>


      </div>

    </div>
  );
}


export default MyRoom;
