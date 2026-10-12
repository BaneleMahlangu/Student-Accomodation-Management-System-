import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";

import "../../App.css";

import {
  getAdminMaintenanceRequests,
  updateAdminMaintenanceRequest,
} from "../../services/api";

import type {
  MaintenanceRequest,
  MaintenanceStatus,
} from "../../services/api";


function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}


function formatDateTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function AdminMaintenance() {
  const [searchParams] = useSearchParams();
  const routeSearch = searchParams.get("search") ?? "";
  const [requests, setRequests] =
    useState<MaintenanceRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [filterStatus, setFilterStatus] =
    useState("ALL");

  const [search, setSearch] = useState(routeSearch);

  const [updatingId, setUpdatingId] =
    useState<number | null>(null);

  const [notes, setNotes] =
    useState<Record<number, string>>({});

  const [messages, setMessages] =
    useState<Record<number, string>>({});

  const [updateErrors, setUpdateErrors] =
    useState<Record<number, string>>({});


  async function loadRequests() {
    try {
      setLoading(true);
      setError("");

      const result =
        await getAdminMaintenanceRequests();

      setRequests(
        result.maintenance_requests
      );

      const initialNotes: Record<
        number,
        string
      > = {};

      result.maintenance_requests.forEach(
        (request) => {
          initialNotes[request.id] =
            request.resolution_notes || "";
        }
      );

      setNotes(initialNotes);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load maintenance requests."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => { setSearch(routeSearch); }, [routeSearch]);


  const filteredRequests =
    useMemo(() => {
      const term = search.trim().toLowerCase();
      return requests.filter((request) => {
        const matchesStatus = filterStatus === "ALL" || request.status === filterStatus;
        const matchesSearch = !term || [request.reference_number, request.title, request.student_name, request.student_email, request.property_name, request.room_number, request.category_display].some((value) => value.toLowerCase().includes(term));
        return matchesStatus && matchesSearch;
      });
    }, [
      requests,
      filterStatus,
      search,
    ]);


  async function handleUpdate(
    request: MaintenanceRequest,
    nextStatus: MaintenanceStatus
  ) {
    try {
      setUpdatingId(request.id);

      setMessages((current) => ({
        ...current,
        [request.id]: "",
      }));

      setUpdateErrors((current) => ({
        ...current,
        [request.id]: "",
      }));

      const updated =
        await updateAdminMaintenanceRequest(
          request.id,
          {
            status: nextStatus,
            resolution_notes:
              notes[request.id] || "",
          }
        );

      setRequests((current) =>
        current.map((item) =>
          item.id === updated.id
            ? updated
            : item
        )
      );

      setNotes((current) => ({
        ...current,
        [request.id]:
          updated.resolution_notes || "",
      }));

      setMessages((current) => ({
        ...current,
        [request.id]:
          "Maintenance request updated successfully.",
      }));

    } catch (err) {
      setUpdateErrors((current) => ({
        ...current,
        [request.id]:
          err instanceof Error
            ? err.message
            : "Unable to update maintenance request.",
      }));
    } finally {
      setUpdatingId(null);
    }
  }


  async function handleSaveNotes(
    request: MaintenanceRequest
  ) {
    try {
      setUpdatingId(request.id);

      setMessages((current) => ({
        ...current,
        [request.id]: "",
      }));

      setUpdateErrors((current) => ({
        ...current,
        [request.id]: "",
      }));

      const updated =
        await updateAdminMaintenanceRequest(
          request.id,
          {
            resolution_notes:
              notes[request.id] || "",
          }
        );

      setRequests((current) =>
        current.map((item) =>
          item.id === updated.id
            ? updated
            : item
        )
      );

      setMessages((current) => ({
        ...current,
        [request.id]:
          "Resolution notes saved successfully.",
      }));

    } catch (err) {
      setUpdateErrors((current) => ({
        ...current,
        [request.id]:
          err instanceof Error
            ? err.message
            : "Unable to save resolution notes.",
      }));
    } finally {
      setUpdatingId(null);
    }
  }


  if (loading) {
    return (
      <div className="admin-maintenance-page">
        <div className="admin-maintenance-loading">
          Loading maintenance requests...
        </div>
      </div>
    );
  }


  if (error) {
    return (
      <div className="admin-maintenance-page">
        <section className="admin-maintenance-card">
          <span className="admin-maintenance-eyebrow">
            MAINTENANCE MANAGEMENT
          </span>

          <h1>
            Unable to load requests
          </h1>

          <p className="admin-maintenance-error">
            {error}
          </p>

          <button
            type="button"
            className="admin-maintenance-primary-button"
            onClick={loadRequests}
          >
            Try again
          </button>
        </section>
      </div>
    );
  }


  return (
    <div className="admin-maintenance-page">

      <header className="admin-maintenance-header">

        <div>
          <span className="admin-maintenance-eyebrow">
            ADMINISTRATION
          </span>

          <h1>
            Maintenance Management
          </h1>

          <p>
            Review student maintenance requests,
            update their progress and record
            resolution notes.
          </p>
        </div>

        <div className="admin-maintenance-summary">

          <div>
            <span>
              TOTAL
            </span>

            <strong>
              {requests.length}
            </strong>
          </div>

          <div>
            <span>
              OPEN
            </span>

            <strong>
              {
                requests.filter(
                  (request) =>
                    ![
                      "RESOLVED",
                      "STUDENT_CONFIRMED",
                      "CANCELLED",
                    ].includes(request.status)
                ).length
              }
            </strong>
          </div>

          <div>
            <span>
              RESOLVED
            </span>

            <strong>
              {
                requests.filter(
                  (request) =>
                    [
                      "RESOLVED",
                      "STUDENT_CONFIRMED",
                    ].includes(request.status)
                ).length
              }
            </strong>
          </div>

        </div>

      </header>


      <section className="admin-maintenance-toolbar">

        <div>
          <label htmlFor="maintenance-record-search">Search requests</label>
          <input id="maintenance-record-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference, student, property or room" />
        </div>

        <div>
          <label htmlFor="maintenance-status-filter">
            Filter by status
          </label>

          <select
            id="maintenance-status-filter"
            value={filterStatus}
            onChange={(event) =>
              setFilterStatus(
                event.target.value
              )
            }
          >
            <option value="ALL">
              All requests
            </option>

            <option value="SUBMITTED">
              Submitted
            </option>

            <option value="ASSIGNED">
              Assigned
            </option>

            <option value="IN_PROGRESS">
              In Progress
            </option>

            <option value="WAITING_FOR_PARTS">
              Waiting for Parts
            </option>

            <option value="RESOLVED">
              Resolved
            </option>

            <option value="STUDENT_CONFIRMED">
              Student Confirmed
            </option>

            <option value="ESCALATED">
              Escalated
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>
          </select>
        </div>

        <button
          type="button"
          className="admin-maintenance-secondary-button"
          onClick={loadRequests}
        >
          Refresh
        </button>

      </section>


      {filteredRequests.length === 0 ? (
        <section className="admin-maintenance-empty">

          <h2>
            No maintenance requests found
          </h2>

          <p>
            There are currently no maintenance
            requests matching this filter.
          </p>

        </section>
      ) : (

        <section className="admin-maintenance-list">

          {filteredRequests.map(
            (request) => (

              <article
                key={request.id}
                className="admin-maintenance-request"
              >

                <div className="admin-maintenance-request-header">

                  <div>
                    <span className="admin-maintenance-reference">
                      {request.reference_number}
                    </span>

                    <h2>
                      {request.title}
                    </h2>

                    <p>
                      {request.description}
                    </p>
                  </div>

                  <span
                    className={`admin-maintenance-status admin-maintenance-status-${request.status.toLowerCase()}`}
                  >
                    {formatStatus(
                      request.status
                    )}
                  </span>

                </div>


                <div className="admin-maintenance-information-grid">

                  <div>
                    <span>
                      STUDENT
                    </span>

                    <strong>
                      {request.student_name ||
                        "Not provided"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      PROPERTY
                    </span>

                    <strong>
                      {request.property_name ||
                        "Not provided"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      ROOM
                    </span>

                    <strong>
                      {request.room_number ||
                        "Not provided"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      BED
                    </span>

                    <strong>
                      {request.bed_number ||
                        "Not provided"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      CATEGORY
                    </span>

                    <strong>
                      {formatStatus(
                        request.category
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      PRIORITY
                    </span>

                    <strong>
                      {formatStatus(
                        request.priority
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      SUBMITTED
                    </span>

                    <strong>
                      {formatDateTime(
                        request.submitted_at ||
                          request.created_at
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      ASSIGNED TO
                    </span>

                    <strong>
                      {request.assigned_to_name ||
                        "Not assigned"}
                    </strong>
                  </div>

                </div>


                {request.photo && (
                  <div className="admin-maintenance-photo">

                    <a
                      href={request.photo}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View uploaded photo
                    </a>

                  </div>
                )}


                <div className="admin-maintenance-controls">

                  <div className="admin-maintenance-control-group">

                    <label
                      htmlFor={`status-${request.id}`}
                    >
                      Update status
                    </label>

                    <select
                      id={`status-${request.id}`}
                      value={request.status}
                      disabled={
                        updatingId === request.id
                      }
                      onChange={(event) =>
                        handleUpdate(
                          request,
                          event.target.value as MaintenanceStatus
                        )
                      }
                    >

                      <option value="SUBMITTED">
                        Submitted
                      </option>

                      <option value="ASSIGNED">
                        Assigned
                      </option>

                      <option value="IN_PROGRESS">
                        In Progress
                      </option>

                      <option value="WAITING_FOR_PARTS">
                        Waiting for Parts
                      </option>

                      <option value="RESOLVED">
                        Resolved
                      </option>

                      <option value="STUDENT_CONFIRMED">
                        Student Confirmed
                      </option>

                      <option value="ESCALATED">
                        Escalated
                      </option>

                      <option value="CANCELLED">
                        Cancelled
                      </option>

                    </select>

                  </div>


                  <div className="admin-maintenance-control-group">

                    <label
                      htmlFor={`notes-${request.id}`}
                    >
                      Resolution notes
                    </label>

                    <textarea
                      id={`notes-${request.id}`}
                      value={
                        notes[request.id] || ""
                      }
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [request.id]:
                            event.target.value,
                        }))
                      }
                      placeholder="Add work completed, outcome or notes..."
                      rows={4}
                      disabled={
                        updatingId === request.id
                      }
                    />

                    <button
                      type="button"
                      className="admin-maintenance-primary-button"
                      onClick={() =>
                        handleSaveNotes(
                          request
                        )
                      }
                      disabled={
                        updatingId === request.id
                      }
                    >
                      {updatingId === request.id
                        ? "Saving..."
                        : "Save notes"}
                    </button>

                  </div>

                </div>


                {messages[request.id] && (
                  <div className="admin-maintenance-success">
                    {messages[request.id]}
                  </div>
                )}


                {updateErrors[request.id] && (
                  <div className="admin-maintenance-error">
                    {updateErrors[request.id]}
                  </div>
                )}


                <div className="admin-maintenance-timeline">

                  <div>
                    <span>
                      Submitted
                    </span>

                    <strong>
                      {formatDateTime(
                        request.submitted_at
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Assigned
                    </span>

                    <strong>
                      {formatDateTime(
                        request.assigned_at
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Started
                    </span>

                    <strong>
                      {formatDateTime(
                        request.started_at
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Resolved
                    </span>

                    <strong>
                      {formatDateTime(
                        request.resolved_at
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Student Confirmed
                    </span>

                    <strong>
                      {formatDateTime(
                        request.student_confirmed_at
                      )}
                    </strong>
                  </div>

                </div>

              </article>

            )
          )}

        </section>
      )}

    </div>
  );
}


export default AdminMaintenance;
