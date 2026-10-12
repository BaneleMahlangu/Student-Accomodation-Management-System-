import { lazy, Suspense, useEffect, useRef, useState } from "react";
import "./App.css";
import {
  Navigate,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";

const Welcome = lazy(() => import("./pages/Welcome"));
const CompanyInformation = lazy(() => import("./pages/CompanyInformation"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const RoleSelection = lazy(() => import("./pages/auth/RoleSelection"));
const LandlordRegister = lazy(() => import("./pages/auth/LandlordRegister"));
const VerifyEmail = lazy(() => import("./pages/auth/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const StudentDashboard = lazy(() => import("./pages/student/Dashboard"));
const StudentOnboarding = lazy(() => import("./pages/student/Onboarding"));
const LandlordDashboard = lazy(() => import("./pages/landlord/Dashboard"));
const LandlordProperties = lazy(() => import("./pages/landlord/Properties"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminSearch = lazy(() => import("./pages/admin/Search"));
const Discovery = lazy(() => import("./pages/accommodation/Discovery"));
const PropertyDetails = lazy(() => import("./pages/accommodation/PropertyDetails"));
const PropertyReviewsDirectory = lazy(() => import("./pages/accommodation/Reviews"));
const AccommodationReviews = lazy(() => import("./pages/accommodation/PropertyReviewsPage"));
const Rooms = lazy(() => import("./pages/accommodation/Rooms"));
const RoomDetails = lazy(() => import("./pages/accommodation/RoomDetails"));
const SavedProperties = lazy(() => import("./pages/accommodation/SavedProperties"));
const CompareProperties = lazy(() => import("./pages/accommodation/CompareProperties"));
const AccommodationMap = lazy(() => import("./pages/accommodation/Map"));
const NewApplication = lazy(() => import("./pages/applications/NewApplication"));
const ApplicationDetails = lazy(() => import("./pages/applications/ApplicationDetails"));
const AdminApplications = lazy(() => import("./pages/admin/Applications"));
const AdminAppeals = lazy(() => import("./pages/admin/Appeals"));
const AdminApplicationReview = lazy(() => import("./pages/admin/ApplicationReview"));
const Contract = lazy(() => import("./pages/student/Contract"));
const Funding = lazy(() => import("./pages/student/Funding"));
const MyRoom = lazy(() => import("./pages/student/MyRoom"));
const MyApplications = lazy(() => import("./pages/student/MyApplications"));
const Profile = lazy(() => import("./pages/student/Profile"));
const Documents = lazy(() => import("./pages/student/Documents"));
const Maintenance = lazy(() => import("./pages/student/Maintenance"));
const AdminProperties = lazy(() => import("./pages/admin/Properties"));
const AdminDirectory = lazy(() => import("./pages/admin/Directory"));
const Notifications = lazy(() => import("./pages/student/Notifications"));
const StudentWaitingList = lazy(() => import("./pages/student/WaitingList"));
const LandlordWaitingList = lazy(() => import("./pages/landlord/WaitingList"));
const Complaints = lazy(() => import("./pages/support/Complaints"));
const Messages = lazy(() => import("./pages/messaging/Messages"));
const Recommendations = lazy(() => import("./pages/student/Recommendations"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AuditLogs = lazy(() => import("./pages/admin/AuditLogs"));
const AdminRisk = lazy(() => import("./pages/admin/Risk"));
const AdminFunding = lazy(() => import("./pages/admin/Funding"));
const AdminRefunds = lazy(() => import("./pages/admin/Refunds"));
const AdminPropertyReviews = lazy(() => import("./pages/admin/PropertyReviews"));
const AdminSponsorships = lazy(() => import("./pages/admin/Sponsorships"));
const StudentSponsorships = lazy(() => import("./pages/student/Sponsorships"));
const StudentAssistant = lazy(() => import("./pages/student/Assistant"));
const AdminSystemSettings = lazy(() => import("./pages/admin/SystemSettings"));
const AdminDocumentsIndex = lazy(() => import("./pages/admin/DocumentsIndex"));
const AdminPermissions = lazy(() => import("./pages/admin/Permissions"));
const SecuritySettings = lazy(() => import("./pages/account/SecuritySettings"));
const NotificationSettings = lazy(() => import("./pages/account/NotificationSettings"));
const PrivacySettings = lazy(() => import("./pages/account/PrivacySettings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AccommodationChangeRequests = lazy(() => import("./pages/shared/AccommodationChangeRequests"));
const LandlordOccupancy = lazy(() => import("./pages/landlord/Occupancy"));
const LandlordApplications = lazy(() => import("./pages/landlord/Applications"));
const LandlordApplicationDocuments = lazy(() => import("./pages/landlord/ApplicationDocuments"));
const LandlordMaintenance = lazy(() => import("./pages/landlord/Maintenance"));
const LandlordFinance = lazy(() => import("./pages/landlord/Finance"));
const LandlordProfile = lazy(() => import("./pages/landlord/Profile"));
const LandlordReports = lazy(() => import("./pages/landlord/Reports"));
const LandlordAnalytics = lazy(() => import("./pages/landlord/Analytics"));
const LandlordReviews = lazy(() => import("./pages/landlord/Reviews"));
const LandlordCheckIn = lazy(() => import("./pages/landlord/CheckIn"));

import RoleProtectedRoute from "./components/RoleProtectedRoute";
import MobileNavigation from "./components/MobileNavigation";
import SiteFooter from "./components/SiteFooter";

function PageTransitionLoader() {
  const location = useLocation();
  const previousLocationKey = useRef(location.key);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (previousLocationKey.current === location.key) return;

    previousLocationKey.current = location.key;
    setIsLoading(true);
    const timeout = window.setTimeout(() => setIsLoading(false), 450);

    return () => window.clearTimeout(timeout);
  }, [location.key]);

  return isLoading
    ? <div className="page-transition-loader" role="status" aria-live="polite" aria-label="Loading page" />
    : null;
}

function App() {

  return (
    <>
      <PageTransitionLoader />
      <Suspense fallback={(
        <div className="dashboard-page">
          <div className="dashboard-loading" role="status" aria-live="polite">
            Loading StudentHaven…
          </div>
        </div>
      )}>
        <Routes>

      <Route
        path="/"
        element={<Welcome />}
      />

      <Route path="/about" element={<CompanyInformation page="about" />} />
      <Route path="/safety" element={<CompanyInformation page="safety" />} />
      <Route path="/legal" element={<CompanyInformation page="legal" />} />
      <Route path="/help/how-to-use" element={<CompanyInformation page="guide" />} />


      <Route
        path="/login"
        element={<Login />}
      />

      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/account/security" element={<RoleProtectedRoute allowedRoles={["STUDENT", "LANDLORD", "ADMINISTRATOR"]}><SecuritySettings /></RoleProtectedRoute>} />
      <Route path="/account/notifications" element={<RoleProtectedRoute allowedRoles={["STUDENT", "LANDLORD", "ADMINISTRATOR"]}><NotificationSettings /></RoleProtectedRoute>} />
      <Route path="/student/privacy" element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><PrivacySettings /></RoleProtectedRoute>} />


      {/* =====================================================
          REGISTRATION
         ===================================================== */}

      <Route
        path="/register"
        element={<RoleSelection />}
      />

      <Route
        path="/register/student"
        element={<Register />}
      />

      <Route
        path="/register/landlord"
        element={<LandlordRegister />}
      />


      {/* =====================================================
          STUDENT
         ===================================================== */}

      <Route
        path="/student/dashboard"
        element={
          <RoleProtectedRoute
            allowedRoles={["STUDENT"]}
          >
            <StudentDashboard />
          </RoleProtectedRoute>
        }
      />

      <Route path="/student/onboarding" element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><StudentOnboarding /></RoleProtectedRoute>} />

      <Route
        path="/student/applications"
        element={
          <RoleProtectedRoute
            allowedRoles={["STUDENT"]}
          >
            <MyApplications />
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/student/documents"
        element={
          <RoleProtectedRoute
            allowedRoles={["STUDENT"]}
          >
            <Documents />
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/student/notifications"
        element={
          <RoleProtectedRoute
            allowedRoles={["STUDENT"]}
          >
            <Notifications />
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/student/waiting-list"
        element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><StudentWaitingList /></RoleProtectedRoute>}
      />

      <Route path="/student/complaints" element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><Complaints audience="student" /></RoleProtectedRoute>} />
      <Route path="/student/messages" element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><Messages audience="student" /></RoleProtectedRoute>} />
      <Route path="/student/recommendations" element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><Recommendations /></RoleProtectedRoute>} />
      <Route path="/student/funding-programs" element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><StudentSponsorships /></RoleProtectedRoute>} />
      <Route path="/student/assistant" element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><StudentAssistant /></RoleProtectedRoute>} />

      <Route
        path="/student/maintenance"
        element={
          <RoleProtectedRoute
            allowedRoles={["STUDENT"]}
          >
            <Maintenance />
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/student/profile"
        element={
          <RoleProtectedRoute
            allowedRoles={["STUDENT"]}
          >
            <Profile />
          </RoleProtectedRoute>
        }
      />

      <Route path="/student/settings" element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><NotificationSettings /></RoleProtectedRoute>} />


      {/* =====================================================
          ADMIN
         ===================================================== */}

      <Route
        path="/admin/dashboard"
        element={
          <RoleProtectedRoute
            allowedRoles={["ADMINISTRATOR"]}
          >
            <AdminDashboard />
          </RoleProtectedRoute>
        }
      />

      <Route path="/admin/search" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AdminSearch /></RoleProtectedRoute>} />

      <Route
        path="/admin/students"
        element={
          <RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}>
            <AdminDirectory kind="students" />
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/admin/landlords"
        element={
          <RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}>
            <AdminDirectory kind="landlords" />
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/admin/applications"
        element={
          <RoleProtectedRoute
            allowedRoles={["ADMINISTRATOR"]}
          >
            <AdminApplications />
          </RoleProtectedRoute>
        }
      />
      <Route path="/admin/appeals" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AdminAppeals /></RoleProtectedRoute>} />

      <Route
        path="/admin/properties"
        element={
          <RoleProtectedRoute
            allowedRoles={["ADMINISTRATOR"]}
          >
            <AdminProperties />
          </RoleProtectedRoute>
        }
      />

      <Route path="/admin/messages" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><Messages audience="admin" /></RoleProtectedRoute>} />
      <Route path="/admin/analytics" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AdminAnalytics /></RoleProtectedRoute>} />
      <Route path="/admin/reports" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AdminReports /></RoleProtectedRoute>} />
      <Route path="/admin/audit-logs" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AuditLogs /></RoleProtectedRoute>} />
      <Route path="/admin/risk" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AdminRisk /></RoleProtectedRoute>} />
      <Route path="/admin/funding" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AdminFunding mode="funding" /></RoleProtectedRoute>} />
      <Route path="/admin/sponsorships" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AdminSponsorships /></RoleProtectedRoute>} />
      <Route path="/admin/settings" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AdminSystemSettings /></RoleProtectedRoute>} />
      <Route path="/admin/payments" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AdminFunding mode="payments" /></RoleProtectedRoute>} />
      <Route path="/admin/refunds" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AdminRefunds /></RoleProtectedRoute>} />
      <Route path="/admin/property-reviews" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AdminPropertyReviews /></RoleProtectedRoute>} />
      <Route path="/admin/accommodation-requests" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AccommodationChangeRequests audience="admin" /></RoleProtectedRoute>} />
      <Route path="/admin/rooms" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><Navigate to="/admin/properties" replace /></RoleProtectedRoute>} />
      <Route path="/admin/eligibility" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AdminDocumentsIndex /></RoleProtectedRoute>} />
      <Route path="/admin/contracts" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><LandlordFinance view="contracts" audience="admin" /></RoleProtectedRoute>} />
      <Route path="/admin/notifications" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><Notifications audience="admin" /></RoleProtectedRoute>} />
      <Route path="/admin/permissions" element={<RoleProtectedRoute allowedRoles={["ADMINISTRATOR"]}><AdminPermissions /></RoleProtectedRoute>} />

      <Route
        path="/admin/applications/:applicationId"
        element={
          <RoleProtectedRoute
            allowedRoles={["ADMINISTRATOR"]}
          >
            <AdminApplicationReview />
          </RoleProtectedRoute>
        }
      />


      {/* =====================================================
          LANDLORD
         ===================================================== */}

      <Route
        path="/landlord/dashboard"
        element={
          <RoleProtectedRoute
            allowedRoles={["LANDLORD"]}
          >
            <LandlordDashboard />
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/landlord/properties"
        element={
          <RoleProtectedRoute
            allowedRoles={["LANDLORD"]}
          >
            <LandlordProperties />
          </RoleProtectedRoute>
        }
      />

      <Route path="/landlord/accommodation-requests" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><AccommodationChangeRequests audience="landlord" /></RoleProtectedRoute>} />
      <Route path="/landlord/bookings" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><LandlordOccupancy mode="bookings" /></RoleProtectedRoute>} />
      <Route path="/landlord/tenants" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><LandlordOccupancy mode="tenants" /></RoleProtectedRoute>} />
      <Route path="/landlord/check-in" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><LandlordCheckIn /></RoleProtectedRoute>} />
      <Route path="/landlord/applications" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><LandlordApplications /></RoleProtectedRoute>} />
      <Route path="/landlord/applications/:applicationId/documents" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><LandlordApplicationDocuments /></RoleProtectedRoute>} />
      <Route path="/landlord/waiting-list" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><LandlordWaitingList /></RoleProtectedRoute>} />
      <Route path="/landlord/maintenance" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><LandlordMaintenance /></RoleProtectedRoute>} />
      <Route path="/landlord/contracts" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><LandlordFinance view="contracts" /></RoleProtectedRoute>} />
      <Route path="/landlord/payments" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><LandlordFinance view="payments" /></RoleProtectedRoute>} />
      <Route path="/landlord/notifications" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><Notifications audience="landlord" /></RoleProtectedRoute>} />
      <Route path="/landlord/profile" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><LandlordProfile /></RoleProtectedRoute>} />
      <Route path="/landlord/reports" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><LandlordReports /></RoleProtectedRoute>} />
      <Route path="/landlord/analytics" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><LandlordAnalytics /></RoleProtectedRoute>} />
      <Route path="/landlord/reviews" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><LandlordReviews /></RoleProtectedRoute>} />
      <Route path="/landlord/settings" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><Navigate to="/account/security" replace /></RoleProtectedRoute>} />
      <Route path="/landlord/notifications/settings" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><NotificationSettings /></RoleProtectedRoute>} />
      <Route path="/landlord/rooms" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><Navigate to="/landlord/properties" replace /></RoleProtectedRoute>} />

      <Route path="/landlord/complaints" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><Complaints audience="landlord" /></RoleProtectedRoute>} />
      <Route path="/landlord/messages" element={<RoleProtectedRoute allowedRoles={["LANDLORD"]}><Messages audience="landlord" /></RoleProtectedRoute>} />


      {/* =====================================================
          ACCOMMODATION
         ===================================================== */}

      <Route
        path="/accommodation"
        element={<Discovery />}
      />

      <Route path="/accommodation/favorites" element={<SavedProperties />} />
      <Route path="/accommodation/compare" element={<CompareProperties />} />
      <Route path="/accommodation/map" element={<AccommodationMap />} />
      <Route path="/reviews" element={<PropertyReviewsDirectory />} />
      <Route path="/accommodation/:id/reviews" element={<AccommodationReviews />} />

      <Route
        path="/accommodation/:id"
        element={<PropertyDetails />}
      />

      <Route
        path="/accommodation/:id/rooms"
        element={<Rooms />}
      />

      <Route
        path="/accommodation/:id/rooms/:roomId"
        element={<RoomDetails />}
      />


      {/* =====================================================
          APPLICATIONS
         ===================================================== */}

      <Route
        path="/applications/new"
        element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><NewApplication /></RoleProtectedRoute>}
      />

      <Route
        path="/applications/:applicationId"
        element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><ApplicationDetails /></RoleProtectedRoute>}
      />


      {/* =====================================================
          CONTRACTS / FUNDING / ROOM
         ===================================================== */}

      <Route
        path="/contracts/:applicationId"
        element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><Contract /></RoleProtectedRoute>}
      />

      <Route
        path="/funding/:applicationId"
        element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><Funding /></RoleProtectedRoute>}
      />

      <Route
        path="/student/my-room/:applicationId"
        element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><MyRoom /></RoleProtectedRoute>}
      />
      <Route path="/student/my-room" element={<RoleProtectedRoute allowedRoles={["STUDENT"]}><MyRoom /></RoleProtectedRoute>} />

      <Route path="*" element={<NotFound />} />

        </Routes>
        <MobileNavigation />
        <SiteFooter />
      </Suspense>
    </>
  );
}

export default App;
