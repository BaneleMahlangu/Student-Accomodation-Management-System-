import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BedDouble,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  ClipboardList,
  ChevronDown,
  CreditCard,
  FileText,
  HandCoins,
  House,
  LogOut,
  Mail,
  MessageCircle,
  Menu,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Star,
  UserRound,
  Users,
  X,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { CurrentUser } from "../services/api";
import { getCurrentUser, logoutUser } from "../services/api";
import "./PortalToolbar.css";

type PortalRole = "administrator" | "landlord" | "student";

interface PortalLink {
  to: string;
  label: string;
}

interface PortalSection {
  title: string;
  links: PortalLink[];
}

interface PortalToolbarProps {
  role?: PortalRole;
  user?: CurrentUser | null;
  unreadNotifications: number;
  pageTitle?: string;
}

const portalConfig: Record<PortalRole, {
  home: string;
  roleLabel: string;
  notificationPath: string;
  sections: PortalSection[];
  accountLinks: PortalLink[];
}> = {
  administrator: {
    home: "/admin/dashboard",
    roleLabel: "Administrator console",
    notificationPath: "/admin/notifications",
    sections: [
      { title: "Overview", links: [{ to: "/admin/dashboard", label: "Command centre" }, { to: "/admin/search", label: "Global search" }, { to: "/admin/analytics", label: "Analytics" }] },
      { title: "People and applications", links: [{ to: "/admin/students", label: "Students" }, { to: "/admin/landlords", label: "Landlords" }, { to: "/admin/applications", label: "Applications" }, { to: "/admin/appeals", label: "Appeals" }] },
      { title: "Accommodation", links: [{ to: "/admin/properties", label: "Properties" }, { to: "/admin/accommodation-requests", label: "Renewals and transfers" }] },
      { title: "Operations", links: [{ to: "/admin/eligibility", label: "Eligibility checks" }, { to: "/admin/funding", label: "Funding" }, { to: "/admin/sponsorships", label: "Bursaries and sponsorships" }, { to: "/admin/payments", label: "Payments" }, { to: "/admin/refunds", label: "Refund requests" }, { to: "/admin/property-reviews", label: "Resident reviews" }, { to: "/admin/contracts", label: "Contracts" }, { to: "/admin/messages", label: "Messages" }, { to: "/admin/notifications", label: "Notifications" }, { to: "/admin/risk", label: "Risk and fraud" }, { to: "/admin/reports", label: "Reports" }] },
      { title: "Platform", links: [{ to: "/admin/settings", label: "System settings" }, { to: "/admin/audit-logs", label: "Audit logs" }, { to: "/admin/permissions", label: "Permissions" }] },
    ],
    accountLinks: [
      { to: "/account/notifications", label: "Notification preferences" },
      { to: "/account/security", label: "Account security" },
    ],
  },
  landlord: {
    home: "/landlord/dashboard",
    roleLabel: "Landlord portal",
    notificationPath: "/landlord/notifications",
    sections: [
      { title: "Portfolio", links: [{ to: "/landlord/dashboard", label: "Dashboard" }, { to: "/landlord/properties", label: "Properties and rooms" }, { to: "/landlord/bookings", label: "Bookings" }, { to: "/landlord/check-in", label: "Check-in desk" }] },
      { title: "Residents", links: [{ to: "/landlord/applications", label: "Applications" }, { to: "/landlord/waiting-list", label: "Waiting lists" }, { to: "/landlord/tenants", label: "Tenants" }, { to: "/landlord/contracts", label: "Contracts" }, { to: "/landlord/accommodation-requests", label: "Renewals and transfers" }] },
      { title: "Operations", links: [{ to: "/landlord/payments", label: "Payments" }, { to: "/landlord/maintenance", label: "Maintenance" }, { to: "/landlord/complaints", label: "Complaints" }, { to: "/landlord/messages", label: "Messages" }, { to: "/landlord/notifications", label: "Notifications" }, { to: "/landlord/analytics", label: "Analytics" }, { to: "/landlord/reports", label: "Reports" }] },
    ],
    accountLinks: [
      { to: "/landlord/profile", label: "My profile" },
      { to: "/account/notifications", label: "Notification preferences" },
      { to: "/account/security", label: "Account security" },
    ],
  },
  student: {
    home: "/student/dashboard",
    roleLabel: "Student portal",
    notificationPath: "/student/notifications",
    sections: [
      { title: "Overview", links: [{ to: "/student/dashboard", label: "Dashboard" }] },
      { title: "Find a place", links: [{ to: "/accommodation", label: "Browse properties" }, { to: "/accommodation/favorites", label: "Saved properties" }, { to: "/accommodation/compare", label: "Compare properties" }, { to: "/student/recommendations", label: "Recommendations" }] },
      { title: "Applications and funding", links: [{ to: "/student/applications", label: "My applications" }, { to: "/student/waiting-list", label: "Waiting list" }, { to: "/student/funding-programs", label: "Bursaries and funding" }] },
      { title: "Your stay", links: [{ to: "/student/my-room", label: "My room and payments" }, { to: "/student/maintenance", label: "Maintenance requests" }, { to: "/student/complaints", label: "Complaints and support" }, { to: "/student/messages", label: "Messages" }] },
      { title: "Account", links: [{ to: "/student/profile", label: "My profile" }, { to: "/student/documents", label: "My documents" }, { to: "/student/notifications", label: "Notifications" }, { to: "/student/assistant", label: "StudentHaven guide" }, { to: "/student/settings", label: "Settings" }] },
    ],
    accountLinks: [
      { to: "/student/profile", label: "My profile" },
      { to: "/account/notifications", label: "Notification preferences" },
      { to: "/account/security", label: "Account security" },
    ],
  },
};

function initials(user: CurrentUser | null) {
  const letters = `${user?.first_name?.trim().slice(0, 1) || ""}${user?.last_name?.trim().slice(0, 1) || ""}`;
  return (letters || user?.email?.slice(0, 2) || "SH").toUpperCase();
}

const portalIcons: Record<string, LucideIcon> = {
  "/admin/dashboard": House,
  "/admin/search": Search,
  "/admin/analytics": Activity,
  "/admin/students": Users,
  "/admin/landlords": Building2,
  "/admin/applications": ClipboardList,
  "/admin/appeals": MessageCircle,
  "/admin/properties": Building2,
  "/admin/accommodation-requests": RefreshCw,
  "/admin/eligibility": FileText,
  "/admin/funding": HandCoins,
  "/admin/sponsorships": Star,
  "/admin/payments": CreditCard,
  "/admin/refunds": RotateCcw,
  "/admin/property-reviews": Star,
  "/admin/contracts": FileText,
  "/admin/messages": Mail,
  "/admin/notifications": Bell,
  "/admin/risk": ShieldAlert,
  "/admin/reports": FileText,
  "/admin/settings": Settings,
  "/admin/audit-logs": ScrollText,
  "/admin/permissions": Shield,
  "/landlord/dashboard": House,
  "/landlord/properties": Building2,
  "/landlord/check-in": CalendarDays,
  "/landlord/notifications": Bell,
  "/landlord/applications": ClipboardList,
  "/landlord/waiting-list": ClipboardList,
  "/landlord/tenants": Users,
  "/landlord/bookings": CalendarDays,
  "/landlord/contracts": FileText,
  "/landlord/accommodation-requests": RefreshCw,
  "/landlord/payments": CreditCard,
  "/landlord/maintenance": Wrench,
  "/landlord/complaints": MessageCircle,
  "/landlord/messages": Mail,
  "/landlord/analytics": Activity,
  "/landlord/reports": FileText,
  "/accommodation": Search,
  "/accommodation/favorites": Star,
  "/accommodation/compare": Activity,
  "/student/applications": ClipboardList,
  "/student/waiting-list": CalendarDays,
  "/student/funding-programs": HandCoins,
  "/student/recommendations": Activity,
  "/student/my-room": BedDouble,
  "/student/maintenance": Wrench,
  "/student/complaints": MessageCircle,
  "/student/messages": Mail,
  "/student/notifications": Bell,
  "/student/assistant": Bot,
  "/student/profile": UserRound,
  "/student/documents": FileText,
  "/student/settings": Settings,
};

function accountIcon(label: string): LucideIcon {
  const value = label.toLowerCase();
  if (value.includes("profile")) return UserRound;
  if (value.includes("security")) return Shield;
  if (value.includes("notification")) return Bell;
  return Settings;
}

export default function PortalToolbar({ role = "student", user = null, unreadNotifications, pageTitle = "My Portal" }: PortalToolbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [accountUser, setAccountUser] = useState<CurrentUser | null>(user);
  const [accountLoading, setAccountLoading] = useState(!user);
  const [accountOpen, setAccountOpen] = useState(false);
  const [quickLinksOpen, setQuickLinksOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const accountWrapRef = useRef<HTMLDivElement>(null);
  const quickLinksRef = useRef<HTMLDivElement>(null);
  const config = portalConfig[role];
  const allLinks = config.sections.flatMap((section) => section.links);
  const selectedLink = allLinks.find(({ to }) => location.pathname === to || location.pathname.startsWith(`${to}/`));
  const selectedPath = selectedLink?.to || "";
  const fullName = accountUser ? `${accountUser.first_name} ${accountUser.last_name}`.trim() : accountLoading ? "Loading account…" : "Account";
  const email = accountUser?.email || "";

  useEffect(() => {
    setAccountUser(user);
    if (user) {
      setAccountLoading(false);
      return;
    }

    let cancelled = false;
    setAccountLoading(true);
    getCurrentUser()
      .then((currentUser) => {
        if (!cancelled) setAccountUser(currentUser);
      })
      .catch(() => {
        if (!cancelled) setAccountUser(null);
      })
      .finally(() => {
        if (!cancelled) setAccountLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setQuickLinksOpen(false);
        setNavigationOpen(false);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    function closeAccountMenu(event: PointerEvent) {
      if (!accountWrapRef.current?.contains(event.target as Node)) setAccountOpen(false);
      if (!quickLinksRef.current?.contains(event.target as Node)) setQuickLinksOpen(false);
    }
    document.addEventListener("pointerdown", closeAccountMenu);
    return () => document.removeEventListener("pointerdown", closeAccountMenu);
  }, []);

  async function signOut() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logoutUser();
      navigate("/login", { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Unable to log out right now.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <header className={`portal-toolbar portal-toolbar--${role}`}>
        <div className="portal-toolbar-inner">
          <Link to={config.home} className="portal-toolbar-brand" aria-label="StudentHaven portal home">
            <img src="/SH-logo.jpg" alt="" />
            <span>StudentHaven</span>
          </Link>

          <div className="portal-toolbar-context">
            <span>{config.roleLabel}</span>
            <strong>{pageTitle}</strong>
          </div>

          {role === "landlord" && <div className="portal-quick-links" ref={quickLinksRef}>
            <button
              className="portal-quick-links-trigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={quickLinksOpen}
              onClick={() => { setQuickLinksOpen((open) => !open); setAccountOpen(false); setNavigationOpen(false); }}
              title="Quick page links"
            >
              <ArrowRight size={16} aria-hidden="true" />
              <span className="portal-quick-link-label">{selectedLink?.label || "Quick links"}</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            {quickLinksOpen && (
              <div className="portal-quick-links-menu" role="menu" aria-label="Quick page links">
                {config.sections.map((section) => (
                  <section className="portal-quick-links-section" key={section.title}>
                    <h2>{section.title}</h2>
                    {section.links.map(({ to, label }) => {
                      const Icon = portalIcons[to] || House;
                      return (
                        <Link
                          role="menuitem"
                          to={to}
                          key={to}
                          aria-current={selectedPath === to ? "page" : undefined}
                          onClick={() => setQuickLinksOpen(false)}
                        >
                          <Icon size={17} aria-hidden="true" />
                          <span>{label}</span>
                        </Link>
                      );
                    })}
                  </section>
                ))}
              </div>
            )}
          </div>}

          <div className="portal-toolbar-actions">
            <Link
              className="portal-toolbar-icon"
              to={config.notificationPath}
              aria-label={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : "Notifications"}
              title="Notifications"
            >
              <Bell size={19} aria-hidden="true" />
              {unreadNotifications > 0 && <span className="portal-notification-badge">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
            </Link>

            <div className="portal-account-wrap" ref={accountWrapRef}>
              <button
                className="portal-account-trigger"
                type="button"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                onClick={() => { setAccountOpen((open) => !open); setNavigationOpen(false); }}
              >
                <span className="portal-avatar" aria-hidden="true">{initials(accountUser)}</span>
                <span className="portal-account-name">{fullName}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {accountOpen && (
                <div className="portal-account-menu" role="menu">
                  <div className="portal-account-summary">
                    <span className="portal-avatar" aria-hidden="true">{initials(accountUser)}</span>
                    <span>
                      <strong>{fullName}</strong>
                      <small>{email}</small>
                      <small className="portal-account-role">{accountUser?.role?.replaceAll("_", " ") || config.roleLabel}</small>
                      {accountUser?.landlord_profile?.verification_status && <small>{accountUser.landlord_profile.verification_status.toLowerCase()} landlord account</small>}
                    </span>
                  </div>
                  {role === "administrator" && <Link role="menuitem" to="/admin/dashboard" onClick={() => setAccountOpen(false)}><House size={17} aria-hidden="true" />Command centre</Link>}
                  {config.accountLinks.map(({ to, label }) => {
                    const Icon = accountIcon(label);
                    return (
                      <Link role="menuitem" to={to} key={to} onClick={() => setAccountOpen(false)}>
                        <Icon size={17} aria-hidden="true" />
                        {label}
                      </Link>
                    );
                  })}
                  {logoutError && <p className="portal-logout-error" role="alert">{logoutError}</p>}
                  <button role="menuitem" className="portal-logout-button" type="button" onClick={() => void signOut()} disabled={loggingOut}>
                    <LogOut size={17} aria-hidden="true" />{loggingOut ? "Logging out…" : "Log out"}
                  </button>
                </div>
              )}
            </div>

            <button
              className="portal-toolbar-icon portal-menu-trigger"
              type="button"
              aria-label={navigationOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={navigationOpen}
              onClick={() => { setNavigationOpen((open) => !open); setAccountOpen(false); }}
              title="Portal navigation"
            >
              {navigationOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {navigationOpen && (
        <div className="portal-drawer-layer">
          <button className="portal-drawer-backdrop" type="button" aria-label="Close navigation menu" onClick={() => setNavigationOpen(false)} />
          <nav className="portal-drawer" aria-label={`${config.roleLabel} navigation`}>
            <div className="portal-drawer-heading">
              <span><House size={17} aria-hidden="true" />{config.roleLabel}</span>
              <button type="button" aria-label="Close navigation menu" onClick={() => setNavigationOpen(false)}><X size={20} aria-hidden="true" /></button>
            </div>
            {config.sections.map((section) => (
              <section className="portal-drawer-section" key={section.title}>
                <h2>{section.title}</h2>
                {section.links.map(({ to, label }) => {
                  const Icon = portalIcons[to] || House;
                  return (
                    <Link to={to} key={to} onClick={() => setNavigationOpen(false)} aria-current={selectedPath === to ? "page" : undefined}>
                      <span className="portal-drawer-link-icon"><Icon size={18} aria-hidden="true" /></span>
                      <span>{label}</span>
                      <span className="portal-drawer-chevron" aria-hidden="true">›</span>
                    </Link>
                  );
                })}
              </section>
            ))}
            <div className="portal-drawer-user">
              <span className="portal-avatar" aria-hidden="true">{initials(accountUser)}</span>
              <span><strong>{fullName}</strong><small>{email}</small></span>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
