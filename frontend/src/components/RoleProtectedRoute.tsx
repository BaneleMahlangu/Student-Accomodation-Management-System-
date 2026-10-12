import {
  useEffect,
  useState,
} from "react";

import {
  Navigate,
  useLocation,
} from "react-router-dom";

import {
  getCurrentUser,
} from "../services/api";


interface RoleProtectedRouteProps {
  allowedRoles: string[];
  children: React.ReactNode;
}


function RoleProtectedRoute({
  allowedRoles,
  children,
}: RoleProtectedRouteProps) {

  const location = useLocation();

  const [loading, setLoading] =
    useState(true);

  const [allowed, setAllowed] =
    useState(false);


  useEffect(() => {

    async function checkAccess() {

      try {

        const user =
          await getCurrentUser();

        setAllowed(
          allowedRoles.includes(
            user.role
          )
        );

      } catch {

        setAllowed(false);

      } finally {

        setLoading(false);

      }
    }

    checkAccess();

  }, [allowedRoles]);


  if (loading) {

    return (
      <div className="dashboard-page">

        <div className="dashboard-loading">
          Checking your StudentHaven access...
        </div>

      </div>
    );

  }


  if (!allowed) {

    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );

  }


  return children;
}


export default RoleProtectedRoute;
