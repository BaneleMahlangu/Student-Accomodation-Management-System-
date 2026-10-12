import AdminNavigation from "../../components/AdminNavigation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminAnalytics, getAdminLandlordRiskSignals, getAdminRiskSignals } from "../../services/api";
import type { AdminAnalyticsOverview } from "../../services/api";
import { PlatformAnnouncements } from "../../components/PlatformAnnouncements";
import PortalToolbar from "../../components/PortalToolbar";
import useUnreadNotifications from "../../hooks/useUnreadNotifications";

import "../../App.css";


function Dashboard() {
  const [overview, setOverview] = useState<AdminAnalyticsOverview | null>(null);
  const [openRiskCount, setOpenRiskCount] = useState<number | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [metricsError, setMetricsError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const unreadNotifications = useUnreadNotifications();

  useEffect(() => {
    async function loadOverview() {
      setLoadingMetrics(true);
      setMetricsError("");
      try {
        const [analytics, riskSignals, landlordRiskSignals] = await Promise.allSettled([
          getAdminAnalytics(),
          getAdminRiskSignals({ status: "OPEN" }),
          getAdminLandlordRiskSignals({ status: "OPEN" }),
        ]);
        const issues: string[] = [];
        if (analytics.status === "fulfilled") setOverview(analytics.value);
        else issues.push("Platform metrics could not be refreshed.");

        if (riskSignals.status === "fulfilled" && landlordRiskSignals.status === "fulfilled") {
          setOpenRiskCount(riskSignals.value.length + landlordRiskSignals.value.length);
        } else {
          setOpenRiskCount(null);
          issues.push("Risk alert totals are temporarily unavailable.");
        }
        setMetricsError(issues.join(" "));
      } catch (caught) {
        setMetricsError(caught instanceof Error ? caught.message : "Unable to load platform metrics.");
      } finally {
        setLoadingMetrics(false);
      }
    }
    void loadOverview();
  }, [refreshKey]);

  const formatCurrency = (amount: string | number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(Number(amount));
  const statusCounts = overview?.applications.by_status ?? {};
  const applicationsToReview = (statusCounts.SUBMITTED || 0) + (statusCounts.UNDER_REVIEW || 0);
  const outstandingStudentReplies = statusCounts.ADDITIONAL_INFO || 0;

  return (
    <div className="admin-dashboard-page">
      <PortalToolbar role="administrator" unreadNotifications={unreadNotifications} pageTitle="Platform Command Centre" />

      <div className="admin-layout">

        <AdminNavigation />


        <main className="admin-content">

          <PlatformAnnouncements />

          <section className="admin-welcome">

            <span className="eyebrow">
              ADMINISTRATOR COMMAND CENTRE
            </span>

            <h1>
              Platform overview
            </h1>

            <p>
              Monitor StudentHaven across students,
              landlords, accommodation, funding,
              bookings and support operations.
            </p>

          </section>

          {metricsError && <div className="property-alert property-alert-error" role="alert">{metricsError}<button type="button" onClick={() => setRefreshKey((current) => current + 1)}>Retry</button></div>}
          {loadingMetrics && <p className="analytics-generated" role="status">Updating platform metrics…</p>}


          <section className="admin-metrics">

            <div>
              <span>
                Students
              </span>

              <strong>
                {overview?.users.students.toLocaleString("en-ZA") ?? "—"}
              </strong>

              <small>
                Platform users
              </small>
            </div>


            <div>
              <span>
                Landlords
              </span>

              <strong>
                {overview?.users.landlords.toLocaleString("en-ZA") ?? "—"}
              </strong>

              <small>
                Registered providers
              </small>
            </div>


            <div>
              <span>
                Applications
              </span>

              <strong>
                {overview?.applications.total.toLocaleString("en-ZA") ?? "—"}
              </strong>

              <small>
                Accommodation applications
              </small>
            </div>


            <div>
              <span>
                Occupancy
              </span>

              <strong>
                {overview ? `${overview.beds.occupancy_percent}%` : "—"}
              </strong>

              <small>
                Platform occupancy
              </small>
            </div>


            <div>
              <span>Payments processed</span>

              <strong>
                {overview ? formatCurrency(overview.finance.successful_transaction_total) : "—"}
              </strong>

              <small>
                {overview?.finance.successful_transaction_count ?? 0} successful gateway transaction{overview?.finance.successful_transaction_count === 1 ? "" : "s"}
              </small>
            </div>


            <div>
              <span>
                Risk Alerts
              </span>

              <strong>
                {openRiskCount?.toLocaleString("en-ZA") ?? "—"}
              </strong>

              <small>
                Requiring review
              </small>
            </div>

          </section>


          <section className="admin-command-panels">

            <div>

              <span className="eyebrow">
                OPERATIONAL CONTROL
              </span>

              <h2>Application review</h2>

              <strong className="admin-queue-count">{loadingMetrics ? "—" : applicationsToReview}</strong>

              <p>
                Submitted and in-review student applications across the platform.
              </p>

              <Link
                to="/admin/applications"
                className="dashboard-primary-action"
              >
                {applicationsToReview ? "Open application queue" : "View applications"}
              </Link>

            </div>


            <div>

              <span className="eyebrow">
                PLATFORM OVERSIGHT
              </span>

              <h2>Property approvals</h2>

              <strong className="admin-queue-count">{loadingMetrics ? "—" : overview?.properties.pending ?? 0}</strong>

              <p>
                Listings submitted by landlords and waiting for a compliance review.
              </p>

              <Link
                to="/admin/properties"
                className="dashboard-secondary-action"
              >
                Review property listings
              </Link>

            </div>

            <div>
              <span className="eyebrow">ACCOUNT VERIFICATION</span>
              <h2>Landlord checks</h2>
              <strong className="admin-queue-count">{loadingMetrics ? "—" : overview?.users.pending_landlord_verification ?? 0}</strong>
              <p>Provider accounts waiting for identity and business verification.</p>
              <Link to="/admin/landlords" className="dashboard-secondary-action">Review landlord accounts</Link>
            </div>

          </section>

          {outstandingStudentReplies > 0 && <p className="admin-follow-up-note"><Link to="/admin/applications">{outstandingStudentReplies} application{outstandingStudentReplies === 1 ? "" : "s"} waiting for additional information from students</Link></p>}

        </main>

      </div>

    </div>
  );
}

export default Dashboard;
