import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getCurrentUser } from "../services/api";
import { getDashboardPath } from "../utils/navigation";

interface DashboardLinkProps {
  className?: string;
}

export default function DashboardLink({ className }: DashboardLinkProps) {
  const location = useLocation();
  const [dashboardPath, setDashboardPath] = useState("/login");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (!active) return;
        setDashboardPath(getDashboardPath(user.role));
        setSignedIn(true);
      })
      .catch(() => {
        if (!active) return;
        setDashboardPath("/login");
        setSignedIn(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <Link to={dashboardPath} state={{ from: location }} className={className}>
      {signedIn ? "Dashboard" : "Sign in"}
    </Link>
  );
}
