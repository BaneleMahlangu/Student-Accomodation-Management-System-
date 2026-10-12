import { NavLink } from "react-router-dom";

const links = [
  ["/admin/dashboard", "Command Centre"],
  ["/admin/search", "Global Search"],
  ["/admin/students", "Students"],
  ["/admin/landlords", "Landlords"],
  ["/admin/applications", "Applications"],
  ["/admin/appeals", "Appeals"],
  ["/admin/properties", "Properties"],
  ["/admin/eligibility", "Eligibility checks"],
  ["/admin/funding", "Funding"],
  ["/admin/sponsorships", "Bursaries and sponsorships"],
  ["/admin/payments", "Payments"],
  ["/admin/refunds", "Refund requests"],
  ["/admin/property-reviews", "Resident reviews"],
  ["/admin/contracts", "Contracts"],
  ["/admin/accommodation-requests", "Renewals and transfers"],
  ["/admin/messages", "Messages"],
  ["/admin/notifications", "Notifications"],
  ["/admin/risk", "Risk review"],
  ["/admin/analytics", "Analytics"],
  ["/admin/reports", "Reports"],
  ["/admin/audit-logs", "Audit logs"],
  ["/admin/permissions", "Permissions"],
  ["/admin/settings", "System settings"],
  ["/account/security", "Account security"],
] as const;

export default function AdminNavigation({ variant = "sidebar" }: { variant?: "sidebar" | "occupancy" }) {
  const nav = (
    <nav className={variant === "occupancy" ? "occupancy-nav" : undefined} aria-label="Administrator navigation">
      {links.map(([to, label]) => (
        <NavLink key={to} to={to} end={to === "/admin/dashboard"}>
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return variant === "occupancy"
    ? nav
    : <aside className="admin-sidebar">{nav}</aside>;
}
