import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import "../../App.css";
import LandlordNavigation from "../../components/LandlordNavigation";
import {
  decideLandlordDocument,
  getLandlordApplicationDocuments,
  getLandlordDocumentPreview,
} from "../../services/api";
import type {
  LandlordApplicationDocumentsResponse,
  LandlordDocumentDecision,
  StudentDocument,
} from "../../services/api";

function formatStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: StudentDocument["status"]) {
  if (status === "VERIFIED") return "document-status verified";
  if (status === "REJECTED") return "document-status rejected";
  return "document-status review";
}

export default function LandlordApplicationDocuments() {
  const { applicationId } = useParams();
  const { hash } = useLocation();
  const numericApplicationId = Number(applicationId);
  const [details, setDetails] = useState<LandlordApplicationDocumentsResponse | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Partial<Record<number, { kind: "success" | "error"; message: string }>>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ url: string; filename: string; isImage: boolean } | null>(null);
  const [error, setError] = useState("");
  const previewUrl = useRef<string | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!Number.isSafeInteger(numericApplicationId) || numericApplicationId < 1) {
      setError("Application was not found.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      setDetails(await getLandlordApplicationDocuments(numericApplicationId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load application documents.");
    } finally {
      setLoading(false);
    }
  }, [numericApplicationId]);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  useEffect(() => {
    if (loading || !hash) return;
    const targetId = decodeURIComponent(hash.slice(1));
    window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [details, hash, loading]);

  const latestDocumentIds = useMemo(() => {
    const latestByType = new Map<StudentDocument["document_type"], StudentDocument>();
    for (const document of [...(details?.documents ?? [])].sort((a, b) =>
      new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime() || b.id - a.id
    )) {
      if (!latestByType.has(document.document_type)) latestByType.set(document.document_type, document);
    }
    return new Set([...latestByType.values()].map((document) => document.id));
  }, [details?.documents]);

  async function makeDecision(document: StudentDocument, decision: LandlordDocumentDecision) {
    const note = (notes[document.id] || "").trim();
    if (decision === "REJECTED" && !note) {
      setFeedback((current) => ({ ...current, [document.id]: { kind: "error", message: "Add a reason before rejecting this document." } }));
      return;
    }

    try {
      setBusyId(document.id);
      setFeedback((current) => ({ ...current, [document.id]: undefined }));
      const updatedDocument = await decideLandlordDocument(document.id, decision, note);
      setDetails((current) => current
        ? { ...current, documents: current.documents.map((item) => item.id === document.id ? updatedDocument : item) }
        : current
      );
      setNotes((current) => ({ ...current, [document.id]: "" }));
      setFeedback((current) => ({
        ...current,
        [document.id]: {
          kind: "success",
          message: decision === "VERIFIED" ? "Document verified." : "Document rejected. The student has been notified.",
        },
      }));
    } catch (caught) {
      setFeedback((current) => ({
        ...current,
        [document.id]: { kind: "error", message: caught instanceof Error ? caught.message : "Unable to save this document decision." },
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function viewDocument(document: StudentDocument) {
    try {
      setPreviewingId(document.id);
      setFeedback((current) => ({ ...current, [document.id]: undefined }));
      const file = await getLandlordDocumentPreview(document.id);
      const url = URL.createObjectURL(file);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = url;
      setPreview({ url, filename: document.original_filename, isImage: file.type.startsWith("image/") });
    } catch (caught) {
      setFeedback((current) => ({
        ...current,
        [document.id]: { kind: "error", message: caught instanceof Error ? caught.message : "Unable to open this document preview." },
      }));
    } finally {
      setPreviewingId(null);
    }
  }

  function closePreview() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setPreview(null);
  }

  const documents = details?.documents ?? [];
  const latestDocuments = documents.filter((document) => latestDocumentIds.has(document.id));
  const verifiedRequired = ["PROOF_OF_REGISTRATION", "STUDENT_ID"].filter((type) =>
    latestDocuments.some((document) => document.document_type === type && document.status === "VERIFIED")
  ).length;

  return (
    <div className="landlord-dashboard-page">
      <header className="landlord-header">
        <Link to="/landlord/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Landlord Portal</span></div></Link>
        <Link to="/landlord/applications" className="occupancy-security-link">Back to applications</Link>
      </header>
      <div className="occupancy-shell">
        <LandlordNavigation variant="occupancy" />
        <main className="occupancy-content">
          <div className="occupancy-heading">
            <div>
              <span className="section-eyebrow">LANDLORD DOCUMENT REVIEW</span>
              <h1>Application documents</h1>
              {details && <p>{details.application.application_number} · {details.application.student_name} · {details.application.property_name}</p>}
            </div>
            <button type="button" className="secondary-button" onClick={() => void loadDocuments()} disabled={loading}>Refresh</button>
          </div>

          <section className="occupancy-summary" aria-label="Required document review status">
            <article><span>Required documents verified</span><strong>{verifiedRequired} / 2</strong></article>
            <article><span>Current documents</span><strong>{latestDocuments.length}</strong></article>
            <article><span>Needs landlord review</span><strong>{latestDocuments.filter((document) => document.status !== "VERIFIED" && document.status !== "REJECTED").length}</strong></article>
          </section>

          {error && <div className="property-alert property-alert-error" role="alert">{error}</div>}
          {loading ? <div className="dashboard-loading">Loading application documents…</div> : documents.length === 0 ? (
            <div className="change-requests-empty"><strong>No documents uploaded yet</strong><p>New student uploads for this application will appear here.</p></div>
          ) : (
            <div className="documents-list">
              {documents.map((document) => {
                const isCurrent = latestDocumentIds.has(document.id);
                const itemFeedback = feedback[document.id];
                return (
                  <article className="document-card" key={document.id} id={`document-${document.id}`}>
                    <div className="document-card-main">
                      <div className="document-icon">DOC</div>
                      <div className="document-card-info">
                        <div className="document-title-row">
                          <h3>{document.document_type_display}</h3>
                          {!isCurrent && <span className="document-required">Older upload</span>}
                        </div>
                        <p>{document.original_filename}</p>
                        <div className="document-meta">
                          <span>Uploaded {new Date(document.uploaded_at).toLocaleString("en-ZA")}</span>
                          {document.expiry_date && <span>Expires {new Date(`${document.expiry_date}T00:00:00`).toLocaleDateString("en-ZA")}</span>}
                        </div>
                        {document.verification_notes && <div className="document-review-note">{document.verification_notes}</div>}
                        {document.rejection_reason && <div className="document-rejection"><strong>Rejection reason</strong><p>{document.rejection_reason}</p></div>}
                        {itemFeedback && <div className={`documents-message ${itemFeedback.kind} document-feedback`} role={itemFeedback.kind === "error" ? "alert" : "status"}>{itemFeedback.message}</div>}
                      </div>
                    </div>
                    <div className="document-card-actions landlord-document-actions">
                      <span className={statusClass(document.status)}>{document.status_display || formatStatus(document.status)}</span>
                      {document.preview_url && <button type="button" className="document-action-link" disabled={previewingId === document.id} onClick={() => void viewDocument(document)}>{previewingId === document.id ? "Opening…" : "View document"}</button>}
                      {isCurrent && (
                        <div className="document-decision">
                          <label className="landlord-application-feedback">
                            Note for the student
                            <textarea rows={2} value={notes[document.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [document.id]: event.target.value }))} placeholder="Optional for verification; required for rejection." />
                          </label>
                          <div className="document-action-buttons">
                            <button type="button" className="document-verify-button" disabled={busyId === document.id} onClick={() => void makeDecision(document, "VERIFIED")}>{busyId === document.id ? "Saving…" : "Verify document"}</button>
                            <button type="button" className="document-reject-button" disabled={busyId === document.id} onClick={() => void makeDecision(document, "REJECTED")}>Reject document</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {preview && (
            <div className="document-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
              <section className="document-preview-dialog" role="dialog" aria-modal="true" aria-label={`Document preview: ${preview.filename}`}>
                <header className="document-preview-header"><h2>{preview.filename}</h2><button type="button" className="admin-directory-secondary-button" onClick={closePreview}>Close preview</button></header>
                <div className="document-preview-content">
                  {preview.isImage ? <img src={preview.url} alt={preview.filename} /> : <iframe src={preview.url} title={`Preview of ${preview.filename}`} />}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
