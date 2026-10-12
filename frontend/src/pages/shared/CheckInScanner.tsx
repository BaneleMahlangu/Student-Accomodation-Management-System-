import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { Html5Qrcode as Html5QrcodeInstance } from "html5-qrcode";

import { adminScanCheckIn, previewStudentCheckIn } from "../../services/api";
import type { Booking, CheckInConfirmation } from "../../services/api";

interface CheckInScannerProps {
  onCheckedIn?: (booking: Booking) => void;
}

const emptyChecklist = { identity_verified: false, room_inspected: false, keys_handed_over: false };

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function CheckInScanner({ onCheckedIn }: CheckInScannerProps) {
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const operationLock = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Booking | null>(null);
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);
  const [identityDocumentType, setIdentityDocumentType] = useState<CheckInConfirmation["identity_document_type"]>("NATIONAL_ID");
  const [checklist, setChecklist] = useState(emptyChecklist);
  const [arrivalNotes, setArrivalNotes] = useState("");

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (!scanner) {
      setScanning(false);
      return;
    }
    try {
      await scanner.stop();
    } catch {
      // The camera may already have stopped after a successful scan.
    }
    try {
      scanner.clear();
    } catch {
      // Clearing an already closed camera is safe to ignore.
    }
    scannerRef.current = null;
    setScanning(false);
  }

  async function processToken(token: string) {
    if (!token || operationLock.current) return;
    operationLock.current = true;
    setProcessing(true);
    setError("");
    setNotice("");
    setCompletedBooking(null);
    try {
      const result = await previewStudentCheckIn(token);
      setPreview(result);
      setChecklist(emptyChecklist);
      setArrivalNotes("");
      setIdentityDocumentType("NATIONAL_ID");
      setNotice(`Booking ${result.booking_number} is valid. Complete the arrival checks below to record check-in.`);
      await stopScanner();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify this QR code.");
      await stopScanner();
    } finally {
      operationLock.current = false;
      setProcessing(false);
    }
  }

  async function startScanner() {
    if (scanning || operationLock.current) return;
    setError("");
    setNotice("");
    setPreview(null);
    setCompletedBooking(null);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("studenthaven-checkin-reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 280, height: 280 }, aspectRatio: 1.2, disableFlip: false },
        processToken,
        () => {},
      );
      setScanning(true);
    } catch (caught) {
      setScanning(false);
      scannerRef.current = null;
      setError(caught instanceof Error ? caught.message : "Unable to start the camera scanner.");
    }
  }

  async function scanImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || operationLock.current) return;
    operationLock.current = true;
    setProcessing(true);
    setError("");
    setNotice("");
    setPreview(null);
    setCompletedBooking(null);
    try {
      await stopScanner();
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("studenthaven-checkin-reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;
      const token = await scanner.scanFile(file, true);
      await scanner.clear();
      scannerRef.current = null;
      operationLock.current = false;
      await processToken(token);
    } catch (caught) {
      const scanner = scannerRef.current;
      if (scanner) {
        try { await scanner.clear(); } catch { /* Ignore an unreadable image cleanup failure. */ }
        scannerRef.current = null;
      }
      setError(caught instanceof Error ? caught.message : "Unable to read a QR code from this image.");
    } finally {
      operationLock.current = false;
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function confirmCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || operationLock.current) return;
    operationLock.current = true;
    setProcessing(true);
    setError("");
    setNotice("");
    const confirmation: CheckInConfirmation = {
      identity_document_type: identityDocumentType,
      ...checklist,
      arrival_notes: arrivalNotes.trim(),
    };
    try {
      const result = await adminScanCheckIn(preview.check_in_token, confirmation);
      setCompletedBooking(result);
      setPreview(null);
      setNotice(`Arrival recorded for ${result.student_name}.`);
      onCheckedIn?.(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete the check-in record.");
    } finally {
      operationLock.current = false;
      setProcessing(false);
    }
  }

  useEffect(() => () => {
    const scanner = scannerRef.current;
    if (scanner) {
      scanner.stop().catch(() => {}).finally(() => {
        try { scanner.clear(); } catch { /* Ignore an already closed scanner. */ }
      });
    }
  }, []);

  const checklistComplete = Object.values(checklist).every(Boolean);

  return (
    <section className="admin-checkin-scanner-card checkin-workflow-card">
      <div className="checkin-workflow-heading">
        <div>
          <span className="admin-review-eyebrow">ARRIVAL DESK</span>
          <h2>Verify and record arrival</h2>
          <p>Scan the student’s QR, match their photo ID to the booking, inspect the allocated room and bed, and record the key handover. StudentHaven stores the staff member and the completed checks with the booking.</p>
        </div>
        <div className="checkin-workflow-seal" aria-hidden="true">✓</div>
      </div>

      <div id="studenthaven-checkin-reader" className="checkin-camera-frame" />

      <div className="my-room-actions checkin-scanner-controls">
        {!scanning ? (
          <button type="button" className="admin-review-primary-button" onClick={() => void startScanner()} disabled={processing}>
            {processing ? "Verifying QR…" : "Open camera scanner"}
          </button>
        ) : (
          <button type="button" className="admin-review-secondary-button" onClick={() => void stopScanner()} disabled={processing}>Close scanner</button>
        )}
        <button type="button" className="admin-review-secondary-button" onClick={() => fileInputRef.current?.click()} disabled={processing}>
          Upload QR image
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={(event) => void scanImage(event)} hidden />
      </div>

      {error && <div className="checkin-workflow-alert checkin-workflow-alert-error" role="alert">{error}</div>}
      {notice && <div className="checkin-workflow-alert checkin-workflow-alert-info" role="status" aria-live="polite">{notice}</div>}

      {preview && (
        <form className="checkin-arrival-form" onSubmit={confirmCheckIn}>
          <div className="checkin-booking-preview">
            <div><span>Student</span><strong>{preview.student_name}</strong></div>
            <div><span>Booking reference</span><strong>{preview.booking_number}</strong></div>
            <div><span>Residence</span><strong>{preview.property_name}</strong></div>
            <div><span>Room and bed</span><strong>Room {preview.room_number} · Bed {preview.bed_number}</strong></div>
            <div><span>Accommodation dates</span><strong>{formatDate(preview.start_date)} – {formatDate(preview.end_date)}</strong></div>
            <div><span>Rent status</span><strong>First month's rent confirmed</strong></div>
          </div>

          <div className="checkin-arrival-verification">
            <div className="checkin-arrival-section-title"><span>IN PERSON</span><h3>Complete the arrival checks</h3><p>Do not record check-in until you have completed each step with the student present.</p></div>
            <label className="checkin-id-type">Photo ID checked<select value={identityDocumentType} onChange={(event) => setIdentityDocumentType(event.target.value as CheckInConfirmation["identity_document_type"])}>
              <option value="NATIONAL_ID">South African ID</option>
              <option value="PASSPORT">Passport</option>
              <option value="OTHER_OFFICIAL_ID">Other official photo ID</option>
            </select></label>
            <label className="checkin-check-row"><input type="checkbox" checked={checklist.identity_verified} onChange={(event) => setChecklist((current) => ({ ...current, identity_verified: event.target.checked }))} /><span><strong>Identity matches the account</strong><small>Compare the student’s name and photo with their account. The ID number is not stored.</small></span></label>
            <label className="checkin-check-row"><input type="checkbox" checked={checklist.room_inspected} onChange={(event) => setChecklist((current) => ({ ...current, room_inspected: event.target.checked }))} /><span><strong>Assigned room and bed are ready</strong><small>Confirm this is the allocated room and inspect its arrival condition with the student.</small></span></label>
            <label className="checkin-check-row"><input type="checkbox" checked={checklist.keys_handed_over} onChange={(event) => setChecklist((current) => ({ ...current, keys_handed_over: event.target.checked }))} /><span><strong>Keys or access have been handed over</strong><small>Confirm the student can enter the property and their room.</small></span></label>
            <label className="checkin-arrival-notes">Arrival notes <textarea maxLength={2000} rows={3} value={arrivalNotes} onChange={(event) => setArrivalNotes(event.target.value)} placeholder="Record room condition, access issues or items agreed at handover." /></label>
            <button className="admin-review-primary-button checkin-confirm-button" type="submit" disabled={!checklistComplete || processing}>
              {processing ? "Recording arrival…" : "Confirm and record check-in"}
            </button>
            {!checklistComplete && <small className="checkin-required-hint">Complete all three checks to enable check-in.</small>}
          </div>
        </form>
      )}

      {completedBooking && (
        <div className="admin-checkin-result checkin-completed-result" role="status">
          <div className="checkin-result-check" aria-hidden="true">✓</div>
          <div className="admin-checkin-result-header"><span className="admin-review-eyebrow">ARRIVAL RECORDED</span><h3>{completedBooking.student_name} is checked in</h3><p>{completedBooking.property_name} · Room {completedBooking.room_number} · Bed {completedBooking.bed_number}</p></div>
          <p className="checkin-recorded-by">Recorded by {completedBooking.check_in_record?.staff_name} at {completedBooking.check_in_record ? new Date(completedBooking.check_in_record.checked_in_at).toLocaleString("en-ZA") : "now"}.</p>
          <button type="button" className="admin-review-secondary-button" onClick={() => { setCompletedBooking(null); setNotice(""); }}>Scan next arrival</button>
        </div>
      )}
    </section>
  );
}

export default CheckInScanner;
