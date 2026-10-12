import {
  useEffect,
  useState,
} from "react";

import type {
  ChangeEvent,
  FormEvent,
} from "react";
import { Link } from "react-router-dom";

import "../../App.css";

import {
  confirmStudentMaintenanceRequest,
  createStudentMaintenanceRequest,
  getMyApplications,
  getStudentMaintenanceRequests,
} from "../../services/api";

import type {
  Application,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceRequest,
} from "../../services/api";


function formatDateTime(
  dateValue: string | null
) {
  if (!dateValue) {
    return "Not recorded";
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return dateValue;
  }

  return date.toLocaleString(
    "en-ZA",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


function getStatusClass(
  status: string
) {

  switch (status) {

    case "SUBMITTED":
      return "maintenance-status submitted";

    case "ASSIGNED":
      return "maintenance-status assigned";

    case "IN_PROGRESS":
      return "maintenance-status progress";

    case "WAITING_FOR_PARTS":
      return "maintenance-status waiting";

    case "RESOLVED":
      return "maintenance-status resolved";

    case "STUDENT_CONFIRMED":
      return "maintenance-status confirmed";

    case "ESCALATED":
      return "maintenance-status escalated";

    case "CANCELLED":
      return "maintenance-status cancelled";

    default:
      return "maintenance-status";
  }
}


function Maintenance() {

  const [
    applications,
    setApplications,
  ] = useState<Application[]>([]);


  const [
    requests,
    setRequests,
  ] = useState<MaintenanceRequest[]>([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState("");


  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);


  const [
    confirmingRequestId,
    setConfirmingRequestId,
  ] = useState<number | null>(null);


  const [
    actionMessage,
    setActionMessage,
  ] = useState("");


  const [
    actionError,
    setActionError,
  ] = useState("");


  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState<MaintenanceCategory>(
    "OTHER"
  );


  const [
    selectedPriority,
    setSelectedPriority,
  ] = useState<MaintenancePriority>(
    "MEDIUM"
  );


  const [
    title,
    setTitle,
  ] = useState("");


  const [
    description,
    setDescription,
  ] = useState("");


  const [
    photo,
    setPhoto,
  ] = useState<File | null>(null);


  const activeApplication =
    applications.find(
      (application) =>
        application.status === "APPROVED"
    ) ||
    applications
      .slice()
      .sort(
        (a, b) =>
          new Date(
            b.updated_at
          ).getTime() -
          new Date(
            a.updated_at
          ).getTime()
      )[0] ||
    null;


  async function loadMaintenance() {

    try {

      setLoading(true);
      setError("");

      const studentApplications =
        await getMyApplications();

      setApplications(
        studentApplications
      );


      const currentApplication =
        studentApplications.find(
          (application) =>
            application.status ===
            "APPROVED"
        ) ||
        studentApplications
          .slice()
          .sort(
            (a, b) =>
              new Date(
                b.updated_at
              ).getTime() -
              new Date(
                a.updated_at
              ).getTime()
          )[0] ||
        null;


      if (!currentApplication) {

        setRequests([]);

        return;
      }


      try {

        const studentRequests =
          await getStudentMaintenanceRequests(
            currentApplication.id
          );

        setRequests(
          studentRequests
        );

      } catch (maintenanceError) {

        setRequests([]);

        throw maintenanceError;
      }

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load maintenance information."
      );

    } finally {

      setLoading(false);
    }
  }


  useEffect(() => {

    loadMaintenance();

  }, []);


  function handlePhotoChange(
    event: ChangeEvent<HTMLInputElement>
  ) {

    const file =
      event.target.files?.[0];

    if (!file) {
      setPhoto(null);
      return;
    }

    setPhoto(file);
  }


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    setActionMessage("");
    setActionError("");


    if (!activeApplication) {

      setActionError(
        "You do not have an active accommodation application."
      );

      return;
    }


    if (!title.trim()) {

      setActionError(
        "Maintenance title is required."
      );

      return;
    }


    if (!description.trim()) {

      setActionError(
        "Please describe the maintenance problem."
      );

      return;
    }


    try {

      setActionLoading(true);


      const createdRequest =
        await createStudentMaintenanceRequest(
          activeApplication.id,
          {
            category:
              selectedCategory,

            title:
              title.trim(),

            description:
              description.trim(),

            priority:
              selectedPriority,

            photo,
          }
        );


      setRequests(
        (currentRequests) => [
          createdRequest,
          ...currentRequests,
        ]
      );


      setTitle("");
      setDescription("");
      setPhoto(null);

      setSelectedCategory(
        "OTHER"
      );

      setSelectedPriority(
        "MEDIUM"
      );


      setActionMessage(
        `Maintenance request ${createdRequest.reference_number} submitted successfully.`
      );

    } catch (err) {

      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to submit maintenance request."
      );

    } finally {

      setActionLoading(false);
    }
  }


  async function handleConfirmResolution(
    requestId: number
  ) {

    try {

      setActionMessage("");
      setActionError("");

      setConfirmingRequestId(
        requestId
      );


      const updatedRequest =
        await confirmStudentMaintenanceRequest(
          requestId
        );


      setRequests(
        (currentRequests) =>
          currentRequests.map(
            (request) =>
              request.id ===
              updatedRequest.id
                ? updatedRequest
                : request
          )
      );


      setActionMessage(
        "Maintenance resolution confirmed successfully."
      );

    } catch (err) {

      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to confirm the maintenance resolution."
      );

    } finally {

      setConfirmingRequestId(
        null
      );
    }
  }


  if (loading) {

    return (

      <div className="page-shell">

        <div className="loading-state">

          Loading your maintenance
          information...

        </div>

      </div>
    );
  }


  if (error) {

    return (

      <div className="page-shell">

        <div className="error-state">

          <h1>
            Maintenance
          </h1>

          <p>
            {error}
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={loadMaintenance}
          >
            Try Again
          </button>

        </div>

      </div>
    );
  }


  return (

    <div className="page-shell">

      <div className="maintenance-page">


        {/* PAGE HEADER */}

        <header className="maintenance-header">

          <div>

            <Link className="page-return-link" to="/student/dashboard">← Back to dashboard</Link>

            <span className="section-eyebrow">
              STUDENTHAVEN
            </span>

            <h1>
              Maintenance
            </h1>

            <p>
              Report accommodation problems
              and track every step until
              resolution.
            </p>

          </div>


          {activeApplication && (

            <div className="maintenance-property-summary">

              <span>
                CURRENT ACCOMMODATION
              </span>

              <strong>
                {activeApplication.property_name ||
                  "Your accommodation"}
              </strong>

              <small>
                Room{" "}
                {activeApplication.room_number ||
                  "Not assigned"}
              </small>

            </div>

          )}

        </header>


        {/* ACTION FEEDBACK */}

        {actionMessage && (

          <div className="maintenance-success">

            <strong>
              Success
            </strong>

            <p>
              {actionMessage}
            </p>

          </div>

        )}


        {actionError && (

          <div className="maintenance-error">

            <strong>
              Action failed
            </strong>

            <p>
              {actionError}
            </p>

          </div>

        )}


        {/* CREATE REQUEST */}

        <section className="maintenance-card">

          <div className="maintenance-card-header">

            <div>

              <span className="section-eyebrow">
                REPORT A PROBLEM
              </span>

              <h2>
                Create maintenance request
              </h2>

              <p>
                Tell us what is wrong so the
                residence team can assist you.
              </p>

            </div>

          </div>


          {activeApplication ? (

            <form
              className="maintenance-form"
              onSubmit={handleSubmit}
            >

              <div className="maintenance-form-grid">


                <div className="maintenance-field">

                  <label htmlFor="maintenance-category">
                    Category
                  </label>

                  <select
                    id="maintenance-category"
                    value={selectedCategory}
                    onChange={(event) =>
                      setSelectedCategory(
                        event.target
                          .value as MaintenanceCategory
                      )
                    }
                  >

                    <option value="ELECTRICAL">
                      Electrical
                    </option>

                    <option value="PLUMBING">
                      Plumbing
                    </option>

                    <option value="WIFI">
                      Wi-Fi
                    </option>

                    <option value="FURNITURE">
                      Furniture
                    </option>

                    <option value="CLEANING">
                      Cleaning
                    </option>

                    <option value="SECURITY">
                      Security
                    </option>

                    <option value="ROOM_DAMAGE">
                      Room Damage
                    </option>

                    <option value="OTHER">
                      Other
                    </option>

                  </select>

                </div>


                <div className="maintenance-field">

                  <label htmlFor="maintenance-priority">
                    Priority
                  </label>

                  <select
                    id="maintenance-priority"
                    value={selectedPriority}
                    onChange={(event) =>
                      setSelectedPriority(
                        event.target
                          .value as MaintenancePriority
                      )
                    }
                  >

                    <option value="LOW">
                      Low
                    </option>

                    <option value="MEDIUM">
                      Medium
                    </option>

                    <option value="HIGH">
                      High
                    </option>

                    <option value="URGENT">
                      Urgent
                    </option>

                  </select>

                </div>


              </div>


              <div className="maintenance-field">

                <label htmlFor="maintenance-title">
                  Problem title
                </label>

                <input
                  id="maintenance-title"
                  type="text"
                  value={title}
                  onChange={(event) =>
                    setTitle(
                      event.target.value
                    )
                  }
                  placeholder="e.g. Wi-Fi not working in room"
                  maxLength={150}
                />

              </div>


              <div className="maintenance-field">

                <label htmlFor="maintenance-description">
                  Describe the problem
                </label>

                <textarea
                  id="maintenance-description"
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value
                    )
                  }
                  placeholder="Describe what happened, where it happened and when you noticed it."
                  rows={6}
                />

              </div>


              <div className="maintenance-field">

                <label htmlFor="maintenance-photo">
                  Photo evidence
                </label>

                <input
                  id="maintenance-photo"
                  type="file"
                  accept="image/*"
                  onChange={
                    handlePhotoChange
                  }
                />

                {photo && (

                  <small>
                    Selected:{" "}
                    {photo.name}
                  </small>

                )}

              </div>


              <div className="maintenance-form-actions">

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    actionLoading ||
                    confirmingRequestId !== null
                  }
                >

                  {actionLoading
                    ? "Submitting..."
                    : "Submit Maintenance Request"}

                </button>

              </div>

            </form>

          ) : (

            <div className="maintenance-empty">

              <strong>
                No accommodation booking found
              </strong>

              <p>
                Maintenance requests become
                available after you have a
                confirmed accommodation booking.
              </p>

            </div>

          )}

        </section>


        {/* REQUEST HISTORY */}

        <section className="maintenance-card">

          <div className="maintenance-card-header">

            <div>

              <span className="section-eyebrow">
                REQUEST HISTORY
              </span>

              <h2>
                Your maintenance requests
              </h2>

              <p>
                Track submitted, active and
                resolved maintenance issues.
              </p>

            </div>

          </div>


          {requests.length === 0 ? (

            <div className="maintenance-empty">

              <strong>
                No maintenance requests
              </strong>

              <p>
                You haven't submitted any
                maintenance requests yet.
              </p>

            </div>

          ) : (

            <div className="maintenance-request-list">

              {requests.map(
                (maintenanceRequest) => (

                  <article
                    key={
                      maintenanceRequest.id
                    }
                    className="maintenance-request"
                  >

                    <div className="maintenance-request-header">

                      <div>

                        <span>
                          {
                            maintenanceRequest
                              .reference_number
                          }
                        </span>

                        <h3>
                          {
                            maintenanceRequest
                              .title
                          }
                        </h3>

                      </div>


                      <span
                        className={
                          getStatusClass(
                            maintenanceRequest
                              .status
                          )
                        }
                      >
                        {
                          maintenanceRequest
                            .status_display
                        }
                      </span>

                    </div>


                    <div className="maintenance-request-meta">

                      <span>
                        Category:{" "}
                        {
                          maintenanceRequest
                            .category_display
                        }
                      </span>

                      <span>
                        Priority:{" "}
                        {
                          maintenanceRequest
                            .priority_display
                        }
                      </span>

                      <span>
                        Submitted:{" "}
                        {formatDateTime(
                          maintenanceRequest
                            .submitted_at
                        )}
                      </span>

                    </div>


                    <p>
                      {
                        maintenanceRequest
                          .description
                      }
                    </p>


                    {maintenanceRequest
                      .resolution_notes && (

                      <div className="maintenance-resolution">

                        <strong>
                          Resolution
                        </strong>

                        <p>
                          {
                            maintenanceRequest
                              .resolution_notes
                          }
                        </p>

                      </div>

                    )}


                    {/* CONFIRM RESOLUTION */}

                    {maintenanceRequest.status ===
                      "RESOLVED" && (

                      <div className="maintenance-confirm-resolution">

                        <div>

                          <strong>
                            Maintenance marked as resolved
                          </strong>

                          <p>
                            Please confirm that the
                            issue has been resolved to
                            your satisfaction.
                          </p>

                        </div>


                        <button
                          type="button"
                          className="maintenance-confirm-button"
                          disabled={
                            confirmingRequestId ===
                            maintenanceRequest.id
                          }
                          onClick={() =>
                            handleConfirmResolution(
                              maintenanceRequest.id
                            )
                          }
                        >

                          {confirmingRequestId ===
                            maintenanceRequest.id
                            ? "Confirming..."
                            : "Confirm Resolution"}

                        </button>

                      </div>

                    )}


                    {maintenanceRequest.status ===
                      "STUDENT_CONFIRMED" && (

                      <div className="maintenance-confirmed-message">

                        <strong>
                          Resolution confirmed
                        </strong>

                        <p>
                          You confirmed that this
                          maintenance issue has been
                          resolved.
                        </p>

                      </div>

                    )}

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


export default Maintenance;
