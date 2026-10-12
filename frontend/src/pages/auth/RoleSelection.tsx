import { Link } from "react-router-dom";

import "../../App.css";
import AuthPageShell from "../../components/AuthPageShell";




function StudentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 9.5 12 5l9 4.5L12 14 3 9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      <path
        d="M6 11.5V16c0 1.65 2.69 3 6 3s6-1.35 6-3v-4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}


function LandlordIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 20V9l8-5 8 5v11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      <path
        d="M8 20v-5h3v5M14 20v-5h3v5M3 20h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}


function RoleSelection() {

  return (
    <AuthPageShell
      wide
      panelTitle="Find your place in the StudentHaven community."
      panelDescription="Choose how you want to take part in South Africa’s student accommodation journey."
    >
        <div className="role-selection-card">


          <div className="auth-header">

            <span className="eyebrow">
              GET STARTED
            </span>

            <h1>
              Choose your StudentHaven experience
            </h1>

            <p>
              Select the role that matches how you
              will use the platform.
            </p>

          </div>


          <div className="role-selection-grid">

            <Link
              to="/register/student"
              className="role-selection-card-option"
            >

              <div className="role-option-icon">
                <StudentIcon />
              </div>

              <span className="role-option-label">
                STUDENT
              </span>

              <h2>
                Find your perfect accommodation
              </h2>

              <p>
                Discover properties, select rooms,
                apply, manage documents and funding,
                and follow your complete accommodation
                journey.
              </p>

              <span className="role-option-action">
                Create student account
              </span>

            </Link>


            <Link
              to="/register/landlord"
              className="role-selection-card-option"
            >

              <div className="role-option-icon landlord">
                <LandlordIcon />
              </div>

              <span className="role-option-label">
                LANDLORD
              </span>

              <h2>
                Manage properties and tenants
              </h2>

              <p>
                Manage properties, rooms, applications,
                tenants, bookings, maintenance and
                accommodation operations.
              </p>

              <span className="role-option-action">
                Register as landlord
              </span>

            </Link>

          </div>


          <div className="administrator-access-card">

            <strong>
              Administrator access
            </strong>

            <p>
              Administrator accounts are provisioned
              through StudentHaven administration.
              Public administrator registration is
              not available.
            </p>

            <Link to="/login">
              Administrator sign in
            </Link>

          </div>


          <p className="auth-footer">

            Already have an account?{" "}

            <Link to="/login">
              Sign in
            </Link>

          </p>

        </div>
    </AuthPageShell>
  );
}

export default RoleSelection;
