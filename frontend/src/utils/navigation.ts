const DASHBOARD_PATHS: Record<string, string> = {
  STUDENT: "/student/dashboard",
  LANDLORD: "/landlord/dashboard",
  ADMINISTRATOR: "/admin/dashboard",
};

export function getDashboardPath(role: string | null | undefined): string {
  return role ? DASHBOARD_PATHS[role] || "/login" : "/login";
}

type ReturnLocation = {
  pathname?: unknown;
  search?: unknown;
  hash?: unknown;
};

export function getPostLoginPath(state: unknown, role: string): string | null {
  if (!state || typeof state !== "object" || !("from" in state)) return null;

  const from = (state as { from?: ReturnLocation }).from;
  if (!from || typeof from.pathname !== "string") return null;

  const pathname = from.pathname;
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;

  const allowedRoots: Record<string, string[]> = {
    STUDENT: ["/student", "/applications", "/contracts", "/funding", "/accommodation"],
    LANDLORD: ["/landlord", "/account", "/accommodation"],
    ADMINISTRATOR: ["/admin", "/account", "/accommodation"],
  };

  if (!allowedRoots[role]?.some((root) => pathname === root || pathname.startsWith(`${root}/`))) return null;

  const search = typeof from.search === "string" ? from.search : "";
  const hash = typeof from.hash === "string" ? from.hash : "";
  return `${pathname}${search}${hash}`;
}
