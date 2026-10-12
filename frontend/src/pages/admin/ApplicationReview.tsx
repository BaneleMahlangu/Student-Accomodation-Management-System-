import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import "../../App.css";

import {
  getAdminApplication,
  getAdminApplicationEligibility,
} from "../../services/api";

import type {
  Application,
  AdminApplicationEligibility,
} from "../../services/api";



function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
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
    return "Not available";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusClass(status: string) {
  switch (status) {
    case "SUBMITTED":
      return "admin-review-status submitted";

    case "UNDER_REVIEW":
    case "ADDITIONAL_INFO":
      return "admin-review-status review";

    case "APPROVED":
      return "admin-review-status approved";

    case "DECLINED":
      return "admin-review-status declined";

    case "WAITLISTED":
    case "WAITING_LIST":
      return "admin-review-status waitlisted";

    default:
      return "admin-review-status";
  }
}

function ApplicationReview() {
  const { applicationId } = useParams();

  const [application, setApplication] =
    useState<Application | null>(null);

  const [eligibility, setEligibility] =
    useState<AdminApplicationEligibility | null>(null);

  const [loading, setLoading] = useState(true);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadApplication() {
      if (!applicationId) {
        setError("Application was not found.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const result =
          await getAdminApplication(
            Number(applicationId)
          );

        setApplication(result.application);

        setEligibility(await getAdminApplicationEligibility(Number(applicationId)));

      } catch (err) {
        console.error(
          "Admin application review error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load application."
        );
      } finally {
        setLoading(false);
      }
    }

    loadApplication();
  }, [applicationId, reviewRefreshKey]);

  if (loading) {
    return (
      <div className="admin-review-page">
        <div className="admin-review-loading">
          <div className="application-loading-spinner" />

          <h2>Loading application review</h2>

          <p>
            We're retrieving the application for review.
          </p>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="admin-review-page">
        <div className="admin-review-error">
          <h1>Unable to load application</h1>

          <p>
            {error ||
              "The application could not be found."}
          </p>

          <Link
            to="/admin/applications"
            className="admin-review-secondary"
          >
            Back to Applications
          </Link>
        </div>
      </div>
    );
  }

  const submitted = Boolean(application.submitted_at) || application.status !== "DRAFT";
  const roomSelected = Boolean(application.room && application.room_number);
  const decisionRecorded = ["APPROVED", "DECLINED", "WAITING_LIST", "WAITLISTED"].includes(application.status);
  const reviewInProgress = ["UNDER_REVIEW", "ADDITIONAL_INFO"].includes(application.status);
  const eligibilityReady = eligibility?.eligible === true;
  const reviewChecklist: Array<{
    title: string;
    state: "complete" | "current" | "pending";
    detail: string;
  }> = [
    {
      title: "Application submitted",
      state: submitted ? "complete" : "pending",
      detail: application.submitted_at
        ? `Submitted ${formatDateTime(application.submitted_at)}.`
        : submitted
          ? "The student has submitted the application."
          : "Waiting for the student to submit.",
    },
    {
      title: "Room selected",
      state: roomSelected ? "complete" : "pending",
      detail: roomSelected
        ? `${application.property_name} · Room ${application.room_number}.`
        : "A room has not been selected.",
    },
    {
      title: "Documents",
      state: eligibilityReady
        ? "complete"
        : (eligibility?.required_documents_verified ?? 0) > 0
          ? "current"
          : "pending",
      detail: `${eligibility?.required_documents_verified ?? 0} of ${eligibility?.required_documents_total ?? 2} required documents verified by the landlord.`,
    },
    {
      title: "Eligibility check",
      state: eligibilityReady ? "complete" : submitted ? "current" : "pending",
      detail: eligibilityReady
        ? "Eligible based on the application, room selection, and verified required documents."
        : eligibility?.reasons.join(" ") || "Eligibility could not be checked.",
    },
    ...(decisionRecorded || reviewInProgress ? [{
      title: "Landlord decision",
      state: decisionRecorded ? "complete" as const : "current" as const,
      detail: decisionRecorded ? `Decision recorded: ${formatStatus(application.status)}.` : "Awaiting the landlord's accommodation decision.",
    }] : []),
  ];
  const completedChecklistCount = reviewChecklist.filter((item) => item.state === "complete").length;


  return (
    <div className="admin-review-page">
      <div className="admin-review-container">
        <Link
          to="/admin/applications"
          className="admin-review-back"
        >
          ← Back to Applications
        </Link>

        <header className="admin-review-header">
          <div>
            <span className="admin-review-eyebrow">
              ADMIN APPLICATION REVIEW
            </span>

            <h1>
              {application.application_number}
            </h1>

            <p>
              Check the application's read-only eligibility result. Document and accommodation decisions are made by the property landlord.
            </p>
          </div>

          <div>
            <span
              className={getStatusClass(
                application.status
              )}
            >
              <span className="status-dot" />

              {formatStatus(
                application.status
              )}
            </span>
          </div>
        </header>

        <section className="admin-review-summary">
          <div>
            <span>STUDENT</span>

            <strong>
              {application.student_name}
            </strong>
          </div>

          <div>
            <span>PROPERTY</span>

            <strong>
              {application.property_name}
            </strong>
          </div>

          <div>
            <span>ROOM</span>

            <strong>
              {application.room_number}
            </strong>
          </div>

          <div>
            <span>SUBMITTED</span>

            <strong>
              {formatDateTime(
                application.submitted_at
              )}
            </strong>
          </div>
        </section>

        <section className="admin-review-grid">
          <div className="admin-review-main">
            <section className="admin-review-card">
              <div className="admin-review-card-header">
                <div>
                  <span className="admin-review-eyebrow">
                    STUDENT PROFILE
                  </span>

                  <h2>Applicant information</h2>
                </div>
              </div>

              <div className="admin-review-information-grid">
                <div>
                  <span>Full name</span>
                  <strong>
                    {application.student_name ||
                      "Not provided"}
                  </strong>
                </div>

                <div>
                  <span>University</span>
                  <strong>
                    {application.university ||
                      "Not provided"}
                  </strong>
                </div>

                <div>
                  <span>Campus</span>
                  <strong>
                    {application.campus ||
                      "Not provided"}
                  </strong>
                </div>

                <div>
                  <span>Course</span>
                  <strong>
                    {application.course ||
                      "Not provided"}
                  </strong>
                </div>

                <div>
                  <span>Academic year</span>
                  <strong>
                    {application.academic_year ||
                      "Not provided"}
                  </strong>
                </div>

                <div>
                  <span>Year of study</span>
                  <strong>
                    {application.year_of_study
                      ? `Year ${application.year_of_study}`
                      : "Not provided"}
                  </strong>
                </div>

                <div>
                  <span>Date of birth</span>
                  <strong>
                    {formatDate(
                      application.date_of_birth
                    )}
                  </strong>
                </div>

                <div>
                  <span>Emergency contact</span>
                  <strong>
                    {application.emergency_contact_name ||
                      "Not provided"}
                  </strong>
                </div>

                <div>
                  <span>Emergency phone</span>
                  <strong>
                    {application.emergency_contact_phone ||
                      "Not provided"}
                  </strong>
                </div>
              </div>
            </section>

            <section className="admin-review-card">
              <div className="admin-review-card-header">
                <div>
                  <span className="admin-review-eyebrow">ELIGIBILITY CHECK</span>
                  <h2>Application eligibility</h2>
                </div>
                <strong className={eligibilityReady ? "admin-document-status verified" : "admin-document-status review"}>
                  {eligibilityReady ? "Eligible" : "Not eligible"}
                </strong>
              </div>
              <p className="admin-review-long-note">
                Eligibility requires a submitted application, a selected room, and landlord verification of both required documents.
              </p>
              {eligibility?.reasons.length ? (
                <ul className="admin-eligibility-reasons">
                  {eligibility.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              ) : eligibilityReady ? (
                <p className="admin-document-summary">The submitted application meets the required eligibility checks.</p>
              ) : (
                <p className="admin-review-long-note">Eligibility could not be checked.</p>
              )}
            </section>

            <section className="admin-review-card">
              <div className="admin-review-card-header">
                <div>
                  <span className="admin-review-eyebrow">
                    ACCOMMODATION
                  </span>

                  <h2>Selected room</h2>
                </div>
              </div>

              <div className="admin-review-accommodation">
                <div>
                  <span>PROPERTY</span>

                  <strong>
                    {application.property_name}
                  </strong>
                </div>

                <div>
                  <span>ROOM</span>

                  <strong>
                    {application.room_number}
                  </strong>
                </div>

                <div>
                  <span>STUDENT SELECTION</span>

                  <strong>
                    Room selected by student
                  </strong>
                </div>
              </div>

              <div className="admin-review-notice">
                <strong>
                  Final approval is required
                </strong>

                <p>
                  The student selected this room, but
                  the room is not finally allocated until
                  the property landlord approves
                  the application.
                </p>
              </div>
            </section>

            <section className="admin-review-card">
              <div className="admin-review-card-header">
                <div>
                  <span className="admin-review-eyebrow">
                    STAY
                  </span>

                  <h2>Accommodation period</h2>
                </div>
              </div>

              <div className="admin-review-information-grid">
                <div>
                  <span>Expected sign-in</span>
                  <strong>
                    {formatDate(
                      application.expected_sign_in_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Expected sign-out</span>
                  <strong>
                    {formatDate(
                      application.expected_sign_out_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Meal preference</span>
                  <strong>
                    {application.meal_preference ||
                      "Not provided"}
                  </strong>
                </div>

                <div>
                  <span>Accessibility required</span>
                  <strong>
                    {application.accessibility_required
                      ? "Yes"
                      : "No"}
                  </strong>
                </div>
              </div>

              {application.accessibility_notes && (
                <div className="admin-review-note">
                  <span>ACCESSIBILITY NOTES</span>

                  <p>
                    {application.accessibility_notes}
                  </p>
                </div>
              )}
            </section>

            <section className="admin-review-card">
              <div className="admin-review-card-header">
                <div>
                  <span className="admin-review-eyebrow">
                    FUNDING
                  </span>

                  <h2>Funding information</h2>
                </div>
              </div>

              <div className="admin-review-information-grid">
                <div>
                  <span>Funding method</span>
                  <strong>
                    {formatStatus(
                      application.funding_method
                    )}
                  </strong>
                </div>

                <div>
                  <span>Funding notes</span>
                  <strong>
                    {application.funding_notes ||
                      "No notes provided"}
                  </strong>
                </div>

              </div>

            </section>


            <section className="admin-review-card">
              <div className="admin-review-card-header">
                <div>
                  <span className="admin-review-eyebrow">
                    APPLICATION HISTORY
                  </span>

                  <h2>Activity</h2>
                </div>
              </div>

              {application.status_history?.length ? (
                <div className="admin-review-history">
                  {application.status_history.map(
                    (history) => (
                      <div
                        className="admin-review-history-item"
                        key={history.id}
                      >
                        <div className="history-marker" />

                        <div>
                          <div className="admin-review-history-top">
                            <strong>
                              {formatStatus(
                                history.to_status
                              )}
                            </strong>

                            <span>
                              {formatDateTime(
                                history.created_at
                              )}
                            </span>
                          </div>

                          {history.note && (
                            <p>
                              {history.note}
                            </p>
                          )}

                          {history.changed_by_name && (
                            <small>
                              Updated by{" "}
                              {
                                history.changed_by_name
                              }
                            </small>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="admin-review-empty">
                  No application history recorded yet.
                </div>
              )}
            </section>

            {application.student_notes && (
              <section className="admin-review-card">
                <div className="admin-review-card-header">
                  <div>
                    <span className="admin-review-eyebrow">
                      STUDENT NOTES
                    </span>

                    <h2>Additional information</h2>
                  </div>
                </div>

                <p className="admin-review-long-note">
                  {application.student_notes}
                </p>
              </section>
            )}
          </div>

          <aside className="admin-review-sidebar">
            <section className="admin-review-action-card">
              <span className="admin-review-eyebrow">ADMINISTRATOR ACCESS</span>
              <h2>Eligibility status</h2>
              <p>Administrators can check eligibility only. The property landlord reviews documents and makes the accommodation decision.</p>
              <div className="admin-review-success-box">
                <strong>Review only</strong>
                <p>Application decisions are read-only in the administrator console.</p>
              </div>
              <button
                type="button"
                className="admin-review-secondary-button"
                onClick={() => setReviewRefreshKey((current) => current + 1)}
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? "Refreshing…" : "Refresh review"}
              </button>
            </section>

            <section className="admin-review-side-card">
              <span className="admin-review-eyebrow">
                VERIFICATION
              </span>

              <h2>Review checklist</h2>
              <p className="admin-review-checklist-summary">
                {completedChecklistCount} of {reviewChecklist.length} stages complete
              </p>
              {reviewChecklist.map((item) => (
                <div className={`admin-review-check ${item.state}`} key={item.title}>
                  <span aria-hidden="true">{item.state === "complete" ? "✓" : "•"}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {item.state === "complete" ? "Complete" : item.state === "current" ? "In progress" : "Pending"}
                      {` · ${item.detail}`}
                    </small>
                  </div>
                </div>
              ))}
            </section>

          </aside>
        </section>
      </div>
    </div>
  );
}

export default ApplicationReview;
