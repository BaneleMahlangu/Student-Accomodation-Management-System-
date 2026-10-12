import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import "../../App.css";

import {
  deleteStudentDocument,
  getMediaUrl,
  getMyApplications,
  getStudentDocuments,
  submitStudentApplication,
  uploadStudentDocument,
} from "../../services/api";

import type {
  Application,
  DocumentType,
  StudentDocument,
} from "../../services/api";


interface RequiredDocument {
  type: DocumentType;
  title: string;
  description: string;
  required: boolean;
}


const REQUIRED_DOCUMENTS: RequiredDocument[] = [
  {
    type: "PROOF_OF_REGISTRATION",
    title: "Proof of Registration",
    description:
      "Upload your current university proof of registration.",
    required: true,
  },
  {
    type: "STUDENT_ID",
    title: "Student ID",
    description:
      "Upload a clear copy of your student identification.",
    required: true,
  },
  {
    type: "FUNDING_CONFIRMATION",
    title: "Funding Confirmation",
    description:
      "Upload funding confirmation where applicable.",
    required: false,
  },
  {
    type: "BURSARY_SPONSORSHIP",
    title: "Bursary / Sponsorship",
    description:
      "Upload your bursary or sponsorship confirmation where applicable.",
    required: false,
  },
];


function Documents() {
  const navigate = useNavigate();

  const [application, setApplication] =
    useState<Application | null>(null);

  const [documents, setDocuments] =
    useState<StudentDocument[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingDocuments, setLoadingDocuments] =
    useState(false);

  const [uploadingType, setUploadingType] =
    useState<DocumentType | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [documentFeedback, setDocumentFeedback] = useState<
    Partial<Record<DocumentType, { kind: "success" | "error"; message: string }>>
  >({});

  const [submissionError, setSubmissionError] = useState("");

  const [submittingApplication, setSubmittingApplication] = useState(false);




  // ---------------------------------------------------------
  // FIND THE STUDENT'S CURRENT APPLICATION
  // ---------------------------------------------------------

  useEffect(() => {

    async function loadApplication() {

      try {

        setLoading(true);
        setErrorMessage("");

        const applications =
          await getMyApplications();

        if (applications.length === 0) {

          setErrorMessage(
            "You don't have an accommodation application yet."
          );

          return;
        }

        const active =
          applications.find(
            (item) =>
              ![
                "DECLINED",
              ].includes(item.status)
          ) ||
          applications[0];

        setApplication(active);

      } catch (error) {

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load your application."
        );

      } finally {

        setLoading(false);

      }
    }

    loadApplication();

  }, []);


  // ---------------------------------------------------------
  // LOAD DOCUMENTS
  // ---------------------------------------------------------

  useEffect(() => {

    async function loadDocuments() {

      if (!application) {
        return;
      }

      try {

        setLoadingDocuments(true);
        setErrorMessage("");

        const result =
          await getStudentDocuments(
            application.id
          );

        setDocuments(result);

      } catch (error) {

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load your documents."
        );

      } finally {

        setLoadingDocuments(false);

      }
    }

    loadDocuments();

  }, [application]);


  // ---------------------------------------------------------
  // LATEST DOCUMENT BY TYPE
  // ---------------------------------------------------------

  const latestDocuments =
    useMemo(() => {

      const map =
        new Map<
          DocumentType,
          StudentDocument
        >();

      const sorted =
        [...documents].sort(
          (a, b) =>
            new Date(
              b.uploaded_at
            ).getTime() -
            new Date(
              a.uploaded_at
            ).getTime()
            || b.id - a.id
        );

      sorted.forEach(
        (document) => {

          if (
            !map.has(
              document.document_type
            )
          ) {
            map.set(
              document.document_type,
              document
            );
          }

        }
      );

      return map;

    }, [documents]);


  // ---------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------

  const verifiedCount =
    REQUIRED_DOCUMENTS.filter(
      (item) =>
        latestDocuments.get(
          item.type
        )?.status === "VERIFIED"
    ).length;

  const requiredCount =
    REQUIRED_DOCUMENTS.filter(
      (item) => item.required
    ).length;

  const requiredUploadedCount = REQUIRED_DOCUMENTS.filter((item) => item.required)
    .filter((item) => {
      const document = latestDocuments.get(item.type);
      return Boolean(document && document.status !== "REJECTED");
    }).length;

  const requiredDocumentsUploaded = requiredUploadedCount === requiredCount;

  async function handleSubmitApplication() {
    if (!application || !requiredDocumentsUploaded) return;
    try {
      setSubmittingApplication(true);
      setSubmissionError("");
      await submitStudentApplication(application.id);
      navigate(`/applications/${application.id}`, { replace: true });
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "Unable to submit your application.");
    } finally {
      setSubmittingApplication(false);
    }
  }

  // ---------------------------------------------------------
  // UPLOAD
  // ---------------------------------------------------------

  function handleFileSelected(
    event: ChangeEvent<HTMLInputElement>,
    documentType: DocumentType
  ) {

    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    handleUpload(
      documentType,
      file
    );

  }


  async function handleUpload(
    documentType: DocumentType,
    file: File
  ) {

    if (!application) {
      setErrorMessage(
        "No accommodation application is available."
      );

      return;
    }

    try {

      setUploadingType(
        documentType
      );

      setDocumentFeedback((current) => ({ ...current, [documentType]: undefined }));

      const uploaded =
        await uploadStudentDocument(
          application.id,
          documentType,
          file
        );

      setDocuments(
        (current) => [
          uploaded,
          ...current,
        ]
      );

      setDocumentFeedback((current) => ({
        ...current,
        [documentType]: {
          kind: "success",
          message: `${uploaded.document_type_display} uploaded successfully. It is now awaiting landlord review.`,
        },
      }));

    } catch (error) {

      setDocumentFeedback((current) => ({
        ...current,
        [documentType]: {
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to upload your document.",
        },
      }));

    } finally {

      setUploadingType(null);
    

    }
  }


  // ---------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------

  async function handleDelete(
    document: StudentDocument
  ) {

    const confirmed =
      window.confirm(
        "Are you sure you want to delete this document?"
      );

    if (!confirmed) {
      return;
    }

    setDocumentFeedback((current) => ({
      ...current,
      [document.document_type]: undefined,
    }));

    try {
      await deleteStudentDocument(
        document.id
      );

      setDocuments(
        (current) =>
          current.filter(
            (item) =>
              item.id !== document.id
          )
      );

      setDocumentFeedback((current) => ({
        ...current,
        [document.document_type]: {
          kind: "success",
          message: "Document deleted successfully.",
        },
      }));

    } catch (error) {

      setDocumentFeedback((current) => ({
        ...current,
        [document.document_type]: {
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to delete the document.",
        },
      }));

    }
  }


  // ---------------------------------------------------------
  // STATUS CLASS
  // ---------------------------------------------------------

  function getStatusClass(
    status?: string
  ) {

    switch (status) {

      case "VERIFIED":
        return "document-status verified";

      case "REJECTED":
        return "document-status rejected";

      case "NEEDS_REVIEW":
        return "document-status review";

      case "PROCESSING":
        return "document-status processing";

      default:
        return "document-status missing";
    }
  }


  // ---------------------------------------------------------
  // LOADING STATE
  // ---------------------------------------------------------

  if (loading) {

    return (
      <main className="documents-page">

        <div className="documents-loading-card">

          <p>
            Loading your documents...
          </p>

        </div>

      </main>
    );
  }


  // ---------------------------------------------------------
  // NO APPLICATION
  // ---------------------------------------------------------

  if (!application) {

    return (
      <main className="documents-page">

        <section className="documents-empty-state">

          <span className="documents-eyebrow">
            DOCUMENT CENTRE
          </span>

          <h1>
            Your documents
          </h1>

          <p>
            You need an accommodation application
            before documents can be submitted.
          </p>

          <Link
            to="/accommodation"
            className="primary-button"
          >
            Find accommodation
          </Link>

        </section>

      </main>
    );
  }


  return (
    <main className="documents-page">

      {/* ---------------------------------------------------
          HEADER
      --------------------------------------------------- */}

      <section className="documents-header">

        <div>

          <Link className="page-return-link" to="/student/dashboard">← Back to dashboard</Link>

          <span className="documents-eyebrow">
            STUDENTHAVEN
          </span>

          <h1>
            Documents
          </h1>

          <p>
            Upload and track the documents required
            for your accommodation application.
          </p>

        </div>

        <div className="documents-application-reference">

          <span>
            Application
          </span>

          <strong>
            {application.application_number}
          </strong>

        </div>

      </section>

      {application.status === "DRAFT" && (
        <section className="documents-submit-panel">
          <div>
            <span className="documents-eyebrow">APPLICATION SUBMISSION</span>
            <h2>Required documents: {requiredUploadedCount} / {requiredCount} uploaded</h2>
            <p>
              Upload proof of registration and a student ID before submitting your application.
              Uploaded documents can still be awaiting landlord review.
            </p>
          </div>
          <div className="documents-submit-actions">
            <Link to={`/applications/new?property=${application.property}&room=${application.room}`} className="document-action-link">
              Return to application
            </Link>
            <button
              type="button"
              className="primary-button"
              disabled={!requiredDocumentsUploaded || submittingApplication || loadingDocuments}
              onClick={() => void handleSubmitApplication()}
            >
              {submittingApplication ? "Submitting…" : "Submit application"}
            </button>
          </div>
          {submissionError && (
            <div className="documents-message error documents-submit-error" role="alert">
              {submissionError}
            </div>
          )}
        </section>
      )}


      {/* ---------------------------------------------------
          MESSAGES
      --------------------------------------------------- */}

      {errorMessage && (

        <div className="documents-message error" role="alert">
          {errorMessage}
        </div>

      )}


      {/* ---------------------------------------------------
          SUMMARY
      --------------------------------------------------- */}

      <section className="documents-summary">

        <div className="documents-summary-card">

          <span>
            Required documents
          </span>

          <strong>
            {requiredUploadedCount} / {requiredCount}
          </strong>

        </div>

        <div className="documents-summary-card">

          <span>
            Verified documents
          </span>

          <strong>
            {verifiedCount}
          </strong>

        </div>

        <div className="documents-summary-card">

          <span>
            Uploaded documents
          </span>

          <strong>
            {documents.length}
          </strong>

        </div>

      </section>


      {/* ---------------------------------------------------
          DOCUMENT LIST
      --------------------------------------------------- */}

      <section className="documents-section">

        <div className="documents-section-heading">

          <div>

            <span className="documents-eyebrow">
              REQUIRED & SUPPORTING DOCUMENTS
            </span>

            <h2>
              Your documents
            </h2>

          </div>

          {loadingDocuments && (
            <span>
              Refreshing...
            </span>
          )}

        </div>


        <div className="documents-list">

          {REQUIRED_DOCUMENTS.map(
            (item) => {

              const document =
                latestDocuments.get(
                  item.type
                );

              const isUploading =
                uploadingType ===
                item.type;

              const feedback = documentFeedback[item.type];

              return (
                <article
                  className="document-card"
                  key={item.type}
                >

                  <div className="document-card-main">

                    <div className="document-icon">
                      DOC
                    </div>

                    <div className="document-card-info">

                      <div className="document-title-row">

                        <h3>
                          {item.title}
                        </h3>

                        {item.required && (
                          <span className="document-required">
                            Required
                          </span>
                        )}

                      </div>

                      <p>
                        {item.description}
                      </p>


                      {document && (

                        <div className="document-meta">

                          <span>
                            {document.original_filename}
                          </span>

                          <span>
                            Uploaded{" "}
                            {new Date(
                              document.uploaded_at
                            ).toLocaleDateString()}
                          </span>

                        </div>

                      )}


                      {document?.status ===
                        "REJECTED" && (

                        <div className="document-rejection">

                          <strong>
                            Document rejected
                          </strong>

                          <p>
                            {document.rejection_reason ||
                              "Please upload a new document."}
                          </p>

                        </div>

                      )}

                      {document?.status ===
                        "NEEDS_REVIEW" && (

                        <div className="document-review-note">

                          {document.verification_notes ||
                            "The property landlord is reviewing this document."}

                        </div>

                      )}

                      {feedback && (
                        <div
                          className={`documents-message ${feedback.kind} document-feedback`}
                          role={feedback.kind === "error" ? "alert" : "status"}
                        >
                          {feedback.message}
                        </div>
                      )}

                    </div>

                  </div>


                  <div className="document-card-actions">

                    <span
                      className={
                        getStatusClass(
                          document?.status
                        )
                      }
                    >
                      {document?.status_display ||
                        "Not Uploaded"}
                    </span>


                    {document?.file_url && (

                      <a
                        href={getMediaUrl(
                          document.file_url
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="document-action-link"
                      >
                        Download
                      </a>

                    )}


                    {document &&
                      document.status !==
                        "VERIFIED" && (

                        <button
                          type="button"
                          className="document-delete-button"
                          onClick={() =>
                            handleDelete(
                              document
                            )
                          }
                        >
                          Delete
                        </button>

                      )}


                    <label
                      className="document-upload-button"
                    >

                      {isUploading
                        ? "Uploading..."
                        : document
                          ? "Replace"
                          : "Upload"}

                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        hidden
                        disabled={isUploading}
                        onChange={(event) =>
                          handleFileSelected(
                            event,
                            item.type
                          )
                        }
                      />

                    </label>

                  </div>

                </article>
              );
            }
          )}

        </div>

      </section>


      {/* ---------------------------------------------------
          ALL UPLOADS
      --------------------------------------------------- */}

      <section className="documents-section">

        <div className="documents-section-heading">

          <div>

            <span className="documents-eyebrow">
              DOCUMENT HISTORY
            </span>

            <h2>
              Uploaded documents
            </h2>

          </div>

        </div>


        {documents.length === 0 ? (

          <div className="documents-history-empty">

            <h3>
              No documents uploaded yet
            </h3>

            <p>
              Upload your required documents above
              before the property landlord can review them.
            </p>

          </div>

        ) : (

          <div className="documents-history">

            {documents.map(
              (document) => (

                <div
                  className="document-history-row"
                  key={document.id}
                >

                  <div>

                    <strong>
                      {document.document_type_display}
                    </strong>

                    <span>
                      {document.original_filename}
                    </span>

                  </div>

                  <span
                    className={
                      getStatusClass(
                        document.status
                      )
                    }
                  >
                    {document.status_display}
                  </span>

                </div>

              )
            )}

          </div>

        )}

      </section>

    </main>
  );
}

export default Documents;
