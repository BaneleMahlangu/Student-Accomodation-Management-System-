import { NavLink, useLocation } from "react-router-dom";
import { Bell, Building2, ClipboardList, Home, Search, Users, Wrench, ShieldAlert, QrCode } from "lucide-react";

const studentItems = [
  { to: "/student/dashboard", label: "Home", Icon: Home },
  { to: "/accommodation", label: "Find", Icon: Search },
  { to: "/student/applications", label: "Applications", Icon: ClipboardList },
  { to: "/student/my-room", label: "My stay", Icon: Building2 },
  { to: "/student/notifications", label: "Alerts", Icon: Bell },
];

const landlordItems = [
  { to: "/landlord/dashboard", label: "Home", Icon: Home },
  { to: "/landlord/properties", label: "Properties", Icon: Building2 },
  { to: "/landlord/applications", label: "Applications", Icon: ClipboardList },
  { to: "/landlord/bookings", label: "Bookings", Icon: Users },
  { to: "/landlord/check-in", label: "Check-in", Icon: QrCode },
  { to: "/landlord/maintenance", label: "Repairs", Icon: Wrench },
];

const adminItems = [
  { to: "/admin/dashboard", label: "Command", Icon: Home },
  { to: "/admin/applications", label: "Applications", Icon: ClipboardList },
  { to: "/admin/appeals", label: "Appeals", Icon: Users },
  { to: "/admin/risk", label: "Risk", Icon: ShieldAlert },
  { to: "/admin/search", label: "Search", Icon: Search },
];

export default function MobileNavigation() {
  const { pathname } = useLocation();
  const items = pathname.startsWith("/landlord/")
    ? landlordItems
    : pathname.startsWith("/admin/")
      ? adminItems
      : pathname.startsWith("/student/") || pathname.startsWith("/accommodation") || pathname.startsWith("/applications/") || pathname.startsWith("/funding/") || pathname.startsWith("/contracts/")
        ? studentItems
        : null;

  if (!items) return null;

  const navigationLabel = pathname.startsWith("/landlord/")
    ? "Landlord navigation"
    : pathname.startsWith("/admin/")
      ? "Administrator navigation"
      : "Student navigation";

  return (
    <nav className="mobile-bottom-navigation" aria-label={navigationLabel}>
      {items.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} end={to === "/student/dashboard" || to === "/landlord/dashboard" || to === "/admin/dashboard"}>
          <Icon size={19} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
