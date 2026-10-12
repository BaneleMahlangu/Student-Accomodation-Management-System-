import { NavLink } from "react-router-dom";

const links = [
  ["/landlord/dashboard", "Dashboard"],
  ["/landlord/properties", "Properties and rooms"],
  ["/landlord/applications", "Applications"],
  ["/landlord/waiting-list", "Waiting lists"],
  ["/landlord/tenants", "Tenants"],
  ["/landlord/bookings", "Bookings"],
  ["/landlord/check-in", "Check-in desk"],
  ["/landlord/contracts", "Contracts"],
  ["/landlord/payments", "Payments"],
  ["/landlord/accommodation-requests", "Renewals and transfers"],
  ["/landlord/maintenance", "Maintenance"],
  ["/landlord/complaints", "Complaints"],
  ["/landlord/reviews", "Reviews and ratings"],
  ["/landlord/messages", "Messages"],
  ["/landlord/analytics", "Analytics"],
  ["/landlord/reports", "Reports"],
  ["/landlord/notifications", "Notifications"],
  ["/landlord/profile", "Profile"],
] as const;

function NavigationLinks() {
  return <>
    {links.map(([to, label]) => (
      <NavLink key={to} to={to} end={to === "/landlord/dashboard"}>
        {label}
      </NavLink>
    ))}
    <NavLink to="/account/security">Account security</NavLink>
  </>;
}

export default function LandlordNavigation({ variant = "sidebar" }: { variant?: "sidebar" | "occupancy" }) {
  return variant === "occupancy"
    ? <nav className="occupancy-nav" aria-label="Landlord operations"><NavigationLinks /></nav>
    : <aside className="landlord-sidebar"><nav aria-label="Landlord operations"><NavigationLinks /></nav></aside>;
}
