import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import "../../App.css";

import { getAdminApplications } from "../../services/api";
import type { Application } from "../../services/api";

type StatusFilter =
  | "ALL"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "DECLINED"
  | "WAITLISTED";

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClass(status: string) {
  switch (status) {
    case "SUBMITTED":
      return "admin-application-status submitted";

    case "UNDER_REVIEW":
      return "admin-application-status review";

    case "APPROVED":
      return "admin-application-status approved";

    case "DECLINED":
      return "admin-application-status declined";

    case "WAITLISTED":
      return "admin-application-status waitlisted";

    default:
      return "admin-application-status";
  }
}

function formatDate(dateValue: string | null) {
  if (!dateValue) {
    return "Not submitted";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Applications() {
  const [applications, setApplications] = useState<Application[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");

  async function loadApplications() {
    try {
      setLoading(true);
      setError("");

      const result = await getAdminApplications();

      setApplications(result.applications);
    } catch (err) {
      console.error("Admin applications error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load applications."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplications();
  }, []);

  const filteredApplications = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return applications.filter((application) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        application.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      return (
        application.application_number
          .toLowerCase()
          .includes(searchValue) ||
        application.student_name
          .toLowerCase()
          .includes(searchValue) ||
        application.property_name
          .toLowerCase()
          .includes(searchValue) ||
        application.room_number
          .toLowerCase()
          .includes(searchValue)
      );
    });
  }, [applications, search, statusFilter]);

  const counts = useMemo(() => {
    return {
      all: applications.length,

      submitted: applications.filter(
        (application) =>
          application.status === "SUBMITTED"
      ).length,

      review: applications.filter(
        (application) =>
          application.status === "UNDER_REVIEW"
      ).length,

      approved: applications.filter(
        (application) =>
          application.status === "APPROVED"
      ).length,

      declined: applications.filter(
        (application) =>
          application.status === "DECLINED"
      ).length,

      waitlisted: applications.filter(
        (application) =>
          application.status === "WAITLISTED"
      ).length,
    };
  }, [applications]);

  if (loading) {
    return (
      <div className="admin-applications-page">
        <div className="admin-applications-container">
          <div className="admin-applications-loading">
            <div className="application-loading-spinner" />

            <h2>Loading applications</h2>

            <p>
              We're retrieving the latest StudentHaven
              applications.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-applications-page">
      <div className="admin-applications-container">
        <header className="admin-applications-header">
          <div>
            <span className="admin-eyebrow">
              STUDENTHAVEN ADMIN
            </span>

            <h1>Applications</h1>

            <p>
              View student applications and check whether they meet the eligibility requirements.
            </p>
          </div>

          <Link
            to="/admin/dashboard"
            className="admin-secondary-button"
          >
            Dashboard
          </Link>
        </header>

        {error && (
          <div className="admin-applications-alert">
            <strong>
              Unable to load applications
            </strong>

            <span>{error}</span>

            <button
              type="button"
              onClick={loadApplications}
            >
              Try again
            </button>
          </div>
        )}

        <section className="admin-application-summary">
          <button
            type="button"
            className={
              statusFilter === "ALL"
                ? "admin-summary-card active"
                : "admin-summary-card"
            }
            onClick={() => setStatusFilter("ALL")}
          >
            <span>All applications</span>
            <strong>{counts.all}</strong>
          </button>

          <button
            type="button"
            className={
              statusFilter === "SUBMITTED"
                ? "admin-summary-card active"
                : "admin-summary-card"
            }
            onClick={() =>
              setStatusFilter("SUBMITTED")
            }
          >
            <span>Submitted</span>
            <strong>{counts.submitted}</strong>
          </button>

          <button
            type="button"
            className={
              statusFilter === "UNDER_REVIEW"
                ? "admin-summary-card active"
                : "admin-summary-card"
            }
            onClick={() =>
              setStatusFilter("UNDER_REVIEW")
            }
          >
            <span>Under review</span>
            <strong>{counts.review}</strong>
          </button>

          <button
            type="button"
            className={
              statusFilter === "APPROVED"
                ? "admin-summary-card active"
                : "admin-summary-card"
            }
            onClick={() =>
              setStatusFilter("APPROVED")
            }
          >
            <span>Approved</span>
            <strong>{counts.approved}</strong>
          </button>

          <button
            type="button"
            className={
              statusFilter === "DECLINED"
                ? "admin-summary-card active"
                : "admin-summary-card"
            }
            onClick={() =>
              setStatusFilter("DECLINED")
            }
          >
            <span>Declined</span>
            <strong>{counts.declined}</strong>
          </button>
        </section>

        <section className="admin-applications-card">
          <div className="admin-applications-toolbar">
            <div>
              <span className="admin-eyebrow">
                APPLICATION MANAGEMENT
              </span>

              <h2>
                {filteredApplications.length} application
                {filteredApplications.length !== 1
                  ? "s"
                  : ""}
              </h2>
            </div>

            <div className="admin-applications-controls">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search student, application, property..."
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as StatusFilter
                  )
                }
              >
                <option value="ALL">
                  All statuses
                </option>

                <option value="SUBMITTED">
                  Submitted
                </option>

                <option value="UNDER_REVIEW">
                  Under review
                </option>

                <option value="APPROVED">
                  Approved
                </option>

                <option value="DECLINED">
                  Declined
                </option>

                <option value="WAITLISTED">
                  Waitlisted
                </option>
              </select>
            </div>
          </div>

          {filteredApplications.length === 0 ? (
            <div className="admin-applications-empty">
              <div className="admin-empty-icon">
                —
              </div>

              <h3>No applications found</h3>

              <p>
                No applications match the current
                search or status filter.
              </p>

              {(search || statusFilter !== "ALL") && (
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="admin-applications-list">
              {filteredApplications.map(
                (application) => (
                  <article
                    className="admin-application-row"
                    key={application.id}
                  >
                    <div className="admin-application-main">
                      <div className="admin-application-avatar">
                        {application.student_name
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="admin-application-student">
                        <strong>
                          {application.student_name}
                        </strong>

                        <span>
                          {application.application_number}
                        </span>
                      </div>
                    </div>

                    <div className="admin-application-property">
                      <span>ACCOMMODATION</span>

                      <strong>
                        {application.property_name}
                      </strong>

                      <small>
                        Room {application.room_number}
                      </small>
                    </div>

                    <div className="admin-application-status-column">
                      <span>STATUS</span>

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

                    <div className="admin-application-date">
                      <span>SUBMITTED</span>

                      <strong>
                        {formatDate(
                          application.submitted_at
                        )}
                      </strong>
                    </div>

                    <div className="admin-application-action">
                      <Link
                        to={`/admin/applications/${application.id}`}
                        className="admin-review-button"
                      >
                        Open Review
                      </Link>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Applications;
