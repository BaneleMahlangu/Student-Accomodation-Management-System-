import LandlordNavigation from "../../components/LandlordNavigation";
import {
  useEffect,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";

import "../../App.css";
import { PlatformAnnouncements } from "../../components/PlatformAnnouncements";
import PortalToolbar from "../../components/PortalToolbar";
import useUnreadNotifications from "../../hooks/useUnreadNotifications";

import {
  getLandlordApplications,
  getLandlordMaintenanceRequests,
  getManagedBookings,
  getCurrentUser,
  getLandlordProperties,
} from "../../services/api";

import type {
  CurrentUser,
} from "../../services/api";

import type { ManagedProperty } from "../../services/api";


function Dashboard() {

  const [user, setUser] =
    useState<CurrentUser | null>(null);

  const [properties, setProperties] =
    useState<ManagedProperty[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [warning, setWarning] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [operationalCounts, setOperationalCounts] = useState({ applications: 0, activeTenants: 0, upcomingCheckIns: 0, openMaintenance: 0 });
  const unreadNotifications = useUnreadNotifications();


  useEffect(() => {

    async function loadUser() {

      try {

        setLoading(true);
        setError("");
        setWarning("");
        const [userResult, propertiesResult, applicationsResult, bookingsResult, maintenanceResult] = await Promise.allSettled([
          getCurrentUser(),
          getLandlordProperties(),
          getLandlordApplications(),
          getManagedBookings(),
          getLandlordMaintenanceRequests(),
        ]);

        if (userResult.status === "rejected") throw userResult.reason;
        if (propertiesResult.status === "rejected") throw propertiesResult.reason;

        const currentUser = userResult.value;
        const landlordProperties = propertiesResult.value;
        const applications = applicationsResult.status === "fulfilled" ? applicationsResult.value : [];
        const bookings = bookingsResult.status === "fulfilled" ? bookingsResult.value : [];
        const maintenanceRequests = maintenanceResult.status === "fulfilled" ? maintenanceResult.value : [];

        setUser(currentUser);
        setProperties(landlordProperties);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setOperationalCounts({
          applications: applications.length,
          activeTenants: bookings.filter((booking) => booking.status === "ACTIVE").length,
          upcomingCheckIns: bookings.filter((booking) => booking.status === "CONFIRMED" && new Date(`${booking.start_date}T00:00:00`).getTime() >= today.getTime()).length,
          openMaintenance: maintenanceRequests.filter((item) => !["RESOLVED", "STUDENT_CONFIRMED", "CANCELLED"].includes(item.status)).length,
        });

        const unavailable = [
          applicationsResult.status === "rejected" ? "applications" : "",
          bookingsResult.status === "rejected" ? "bookings" : "",
          maintenanceResult.status === "rejected" ? "maintenance requests" : "",
        ].filter(Boolean);
        if (unavailable.length) setWarning(`Some dashboard data could not be loaded: ${unavailable.join(", ")}. Try refreshing before making decisions.`);

      } catch (err) {

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load landlord dashboard."
        );

      } finally {

        setLoading(false);

      }
    }

    loadUser();

  }, [refreshKey]);


  if (loading) {

    return (
      <div className="landlord-dashboard-page">

        <div className="dashboard-loading">
          Loading your landlord dashboard...
        </div>

      </div>
    );

  }


  if (error) {

    return (
      <div className="landlord-dashboard-page">

        <div className="dashboard-error">

          <h2>
            Unable to load dashboard
          </h2>

          <p>
            {error}
          </p>

          <button type="button" className="dashboard-primary-action" onClick={() => setRefreshKey((current) => current + 1)}>Try again</button>
          <Link to="/account/security">Account security</Link>

        </div>

      </div>
    );

  }


  const verificationStatus =
    user?.landlord_profile
      ?.verification_status ||
    "PENDING";

  const totalRooms = properties.reduce(
    (total, property) => total + property.total_rooms,
    0
  );
  const totalBeds = properties.reduce(
    (total, property) => total + property.total_beds,
    0
  );
  const occupiedBeds = properties.reduce(
    (total, property) => total + property.occupied_beds,
    0
  );
  const occupancy = totalBeds
    ? `${Math.round((occupiedBeds / totalBeds) * 100)}%`
    : "—";
  const pendingListings = properties.filter((property) => property.status === "PENDING").length;


  return (
    <div className="landlord-dashboard-page">
      <PortalToolbar role="landlord" user={user} unreadNotifications={unreadNotifications} pageTitle="Landlord dashboard" />

      <div className="landlord-layout">

        <LandlordNavigation />


        <main className="landlord-content">

          <PlatformAnnouncements />

          <section className="landlord-welcome">

            <span className="eyebrow">
              LANDLORD DASHBOARD
            </span>

            <h1>
              Welcome, {user?.first_name}
            </h1>

            <p>
              Manage your properties, rooms and tenants
              from one place.
            </p>
            <button type="button" className="dashboard-secondary-action" onClick={() => setRefreshKey((current) => current + 1)} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh dashboard"}
            </button>

          </section>

          {warning && <div className="property-alert property-alert-error" role="status">{warning}</div>}

          {verificationStatus !== "VERIFIED" && (

            <section className="landlord-verification-banner">

              <div>

                <strong>
                  Landlord verification {verificationStatus.toLowerCase().replaceAll("_", " ")}
                </strong>

                <p>
                  {verificationStatus === "PENDING"
                    ? "You can prepare property details and save drafts while StudentHaven reviews your identity. You must be verified before submitting a listing for approval."
                    : verificationStatus === "REJECTED"
                      ? "Your landlord verification needs attention before you can submit property listings. Open your profile to review the account status and update your details."
                      : "Property submission is paused for this account. Contact StudentHaven support or review your account profile for the next step."}
                </p>

              </div>

              <Link to="/landlord/profile">
                View profile
              </Link>

            </section>

          )}


          <section className="landlord-metrics">

            <div className="landlord-metric-card">
              <span>
                Properties
              </span>

              <strong>
                {properties.length}
              </strong>

              <small>
                Properties managed
              </small>
            </div>


            <div className="landlord-metric-card">
              <span>
                Rooms
              </span>

              <strong>
                {totalRooms}
              </strong>

              <small>
                Rooms in your properties
              </small>
            </div>


            <div className="landlord-metric-card">
              <span>
                Occupancy
              </span>

              <strong>
                {occupancy}
              </strong>

              <small>
                Current occupancy
              </small>
            </div>


            <div className="landlord-metric-card">
              <span>
                Applications
              </span>

              <strong>
                {operationalCounts.applications}
              </strong>

              <small>
                Property applications
              </small>
            </div>

            <div className="landlord-metric-card">
              <span>Checked-in tenants</span>
              <strong>{operationalCounts.activeTenants}</strong>
              <small>Current occupied bookings</small>
            </div>

            <div className="landlord-metric-card">
              <span>Upcoming arrivals</span>
              <strong>{operationalCounts.upcomingCheckIns}</strong>
              <small>Confirmed stays starting today or later</small>
            </div>

            <div className="landlord-metric-card">
              <span>Listings in review</span>
              <strong>{pendingListings}</strong>
              <small>Waiting for StudentHaven approval</small>
            </div>

            <div className="landlord-metric-card">
              <span>Open maintenance</span>
              <strong>{operationalCounts.openMaintenance}</strong>
              <small>Requests needing follow-up</small>
            </div>

          </section>


          <section className="landlord-dashboard-panels">

            <div className="landlord-panel">

              <span className="eyebrow">
                PROPERTY MANAGEMENT
              </span>

              <h2>
                Build your accommodation portfolio
              </h2>

              <p>
              Add your first property, buildings,
              floors, rooms and beds, then send
              your completed listing for review.
              </p>

              <Link
                to="/landlord/properties"
                className="dashboard-primary-action"
              >
                {properties.length ? "Open property portfolio" : "Add your first property"}
              </Link>

            </div>


            <div className="landlord-panel">

              <span className="eyebrow">
                APPLICATIONS
              </span>

              <h2>
                Student applications
              </h2>

              <p>
                Review applications connected to
                accommodation properties you manage.
              </p>

              <Link
                to="/landlord/applications"
                className="dashboard-secondary-action"
              >
                Review {operationalCounts.applications} application{operationalCounts.applications === 1 ? "" : "s"}
              </Link>

            </div>

            <div className="landlord-panel">
              <span className="eyebrow">ARRIVAL DESK</span>
              <h2>Prepare for student arrivals</h2>
              <p>{operationalCounts.upcomingCheckIns ? `${operationalCounts.upcomingCheckIns} confirmed student arrival${operationalCounts.upcomingCheckIns === 1 ? "" : "s"} need a handover check.` : "Confirmed bookings will appear here when their arrival date is approaching."}</p>
              <Link to="/landlord/check-in" className="dashboard-secondary-action">Open check-in desk</Link>
            </div>

            <div className="landlord-panel">
              <span className="eyebrow">PROPERTY CARE</span>
              <h2>Maintenance follow-up</h2>
              <p>{operationalCounts.openMaintenance ? `${operationalCounts.openMaintenance} request${operationalCounts.openMaintenance === 1 ? "" : "s"} need an update or repair note.` : "There are no open maintenance requests for your properties."}</p>
              <Link to="/landlord/maintenance" className="dashboard-secondary-action">Manage maintenance</Link>
            </div>

          </section>

        </main>

      </div>

    </div>
  );
}

export default Dashboard;
