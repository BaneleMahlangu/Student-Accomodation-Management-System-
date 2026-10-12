const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || "/api").trim().replace(/\/+$/, "");
export const API_BASE_URL = /\/api$/i.test(configuredApiBase)
  ? configuredApiBase
  : `${configuredApiBase}/api`;
const MEDIA_BASE_URL = API_BASE_URL.replace(/\/api\/?$/i, "");

async function readAccommodationResponse(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    const detail = contentType.includes("text/html")
      ? "The room service returned a web page instead of accommodation data. Check that the Django API is running and that VITE_API_BASE_URL points to /api or the Django API host."
      : `The room service returned an unexpected response type (${contentType || "unknown"}).`;
    throw new Error(`${detail} (HTTP ${response.status})`);
  }

  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    throw new Error(fallback);
  }
}

export function getMediaUrl(
  imagePath: string
): string {
  if (!imagePath) {
    return "";
  }

  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://")
  ) {
    return imagePath;
  }

  return `${MEDIA_BASE_URL}${
    imagePath.startsWith("/")
      ? imagePath
      : `/${imagePath}`
  }`;
}

export interface StudentRegistrationData {
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  password: string;
  password_confirm: string;
  student_number: string;
  national_id: string;
  date_of_birth: string;
  university: string;
  campus: string;
  course: string;
  year_of_study: number;
}

export interface LandlordRegistrationData {
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  password: string;
  password_confirm: string;

  business_name: string;
  registration_number: string;
  phone: string;
  address: string;
}

export async function registerStudent(
  data: StudentRegistrationData
) {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");

  const response = await fetch(
    `${API_BASE_URL}/accounts/register/student/`,
    {
      method: "POST",
      credentials: "include",

      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
      },

      body: JSON.stringify(data),
    }
  );

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || (result?.errors ? JSON.stringify(result.errors) : "Registration could not be completed. Check your connection and try again."));
  }
  return result;
}

export async function registerLandlord(
  data: LandlordRegistrationData
) {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");

  const response = await fetch(
    `${API_BASE_URL}/accounts/register/landlord/`,
    {
      method: "POST",
      credentials: "include",

      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
      },

      body: JSON.stringify(data),
    }
  );

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || (result?.errors ? JSON.stringify(result.errors) : "Registration could not be completed. Check your connection and try again."));
  }
  return result;
}

// Login interface function

export interface LoginData {
  email: string;
  password: string;
  two_factor_code?: string;
}

export interface PlatformReadinessCheck {
  id: string;
  label: string;
  status: "READY" | "ACTION_REQUIRED" | "OPTIONAL";
  detail: string;
}

export async function getAdminPlatformReadiness(): Promise<{ checks: PlatformReadinessCheck[]; action_required: number; launch_ready: boolean }> {
  const response = await fetch(`${API_BASE_URL}/core/admin/readiness/`, { credentials: "include", headers: { Accept: "application/json" } });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || data.detail || "Unable to load production readiness checks.");
  return data;
}

export async function loginUser(data: LoginData) {
  await getCSRFToken();

  const csrfToken = getCookie("csrftoken");

  const response = await fetch(
    `${API_BASE_URL}/accounts/login/`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        ...(csrfToken
          ? {
              "X-CSRFToken": csrfToken,
            }
          : {}),
      },

      credentials: "include",

      body: JSON.stringify(data),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.errors
        ? JSON.stringify(result.errors)
        : result?.message || "Login failed."
    );
  }

  return result;
}

export async function logoutUser(): Promise<void> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accounts/logout/`, {
    method: "POST",
    credentials: "include",
    headers: csrfToken ? { "X-CSRFToken": csrfToken } : {},
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.detail || result?.message || "Unable to log out right now.");
  }
}

//CSRF token function
export async function getCSRFToken() {
  const response = await fetch(
    `${API_BASE_URL}/accounts/csrf/`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Unable to initialise secure login.");
  }
}

//helper function to get cookie value by name

function getCookie(name: string): string | null {
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");

    if (key === name) {
      return decodeURIComponent(value.join("="));
    }
  }

  return null;
}

//reusable API function

export interface CurrentUser {
  id: number;

  email: string;

  first_name: string;

  last_name: string;

  mobile: string;

  role: string;

  is_verified: boolean;

  two_factor_enabled: boolean;

  student_profile?: {
    student_number: string;
    national_id: string;
    university: string;
    campus: string;
    course: string;
    year_of_study: number | null;
    date_of_birth: string;
      emergency_contact_name: string;
      emergency_contact_phone: string;
      accessibility_requirements: string;
      accommodation_preferences: {
        budget?: string;
        room_type?: string;
        accessible?: boolean;
        distance_km?: string;
      };
      profile_completed: boolean;
  };

  landlord_profile?: {
    business_name: string;
    registration_number: string;
    phone: string;
    address: string;
    verification_status:
      | "PENDING"
      | "VERIFIED"
      | "REJECTED"
      | "SUSPENDED";
    profile_completed: boolean;
  };

  administrator_profile?: {
    department: string;
    job_title: string;
    permissions_level: string;
  } | null;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await fetch(
    `${API_BASE_URL}/accounts/me/`,
    {
      method: "GET",

      credentials: "include",
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.detail ||
      "Unable to load your account."
    );
  }

  return result;
}

export interface TwoFactorSettings {
  enabled: boolean;
  email_verified: boolean;
}

async function twoFactorRequest(path: string, method = "GET", payload?: Record<string, string>) {
  if (method !== "GET") await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accounts/security/two-factor/${path}`, {
    method,
    credentials: "include",
    headers: { Accept: "application/json", ...(method !== "GET" ? { "Content-Type": "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to update security settings.");
  return result;
}

export async function getTwoFactorSettings(): Promise<TwoFactorSettings> {
  return twoFactorRequest("") as Promise<TwoFactorSettings>;
}

export async function requestTwoFactorSetupCode(): Promise<string> {
  const result = await twoFactorRequest("", "POST", {});
  return result.message as string;
}

export async function confirmTwoFactorSetup(code: string): Promise<string> {
  const result = await twoFactorRequest("confirm/", "POST", { code });
  return result.message as string;
}

export async function disableTwoFactor(password: string): Promise<string> {
  const result = await twoFactorRequest("disable/", "POST", { password });
  return result.message as string;
}

export interface AccountSecuritySession {
  id: number;
  user_agent: string;
  ip_address: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  is_current: boolean;
}

export interface AccountLoginEvent {
  id: number;
  method: string;
  outcome: string;
  status: "SUCCESSFUL" | "FAILED" | "CHALLENGE_REQUIRED" | "CHALLENGE_FAILED";
  failure_reason: string;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
}

export interface AccountSecurityHistory {
  sessions: AccountSecuritySession[];
  login_events: AccountLoginEvent[];
}

async function accountSecurityRequest<T>(path: string, method = "GET"): Promise<T> {
  if (method !== "GET") await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accounts/security/${path}`, {
    method,
    credentials: "include",
    headers: { Accept: "application/json", ...(method !== "GET" ? { "X-CSRFToken": csrfToken || "" } : {}) },
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to update account security.");
  return result as T;
}

export async function getAccountSecurityHistory(): Promise<AccountSecurityHistory> {
  return accountSecurityRequest<AccountSecurityHistory>("history/");
}

export async function revokeAccountSession(sessionId: number): Promise<string> {
  const result = await accountSecurityRequest<{ message: string }>(`sessions/${sessionId}/`, "DELETE");
  return result.message;
}

export async function revokeOtherAccountSessions(): Promise<string> {
  const result = await accountSecurityRequest<{ message: string }>("sessions/revoke-others/", "POST");
  return result.message;
}

export interface EmailChangeResult {
  message: string;
  pending_email?: string;
  email?: string;
}

async function accountEmailChangeRequest(path: string, payload: Record<string, string>): Promise<EmailChangeResult> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accounts/email-change/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to update your sign-in email.");
  return result as EmailChangeResult;
}

export function requestAccountEmailChange(newEmail: string, currentPassword: string): Promise<EmailChangeResult> {
  return accountEmailChangeRequest("request/", { new_email: newEmail, current_password: currentPassword });
}

export function confirmAccountEmailChange(code: string): Promise<EmailChangeResult> {
  return accountEmailChangeRequest("confirm/", { code });
}

export interface AdminDirectoryUser {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  mobile: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  profile: {
    student_number?: string;
    university?: string;
    campus?: string;
    course?: string;
    year_of_study?: number | null;
    business_name?: string;
    registration_number?: string;
    phone?: string;
    address?: string;
    verification_status?: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";
    profile_completed?: boolean;
  } | null;
}

export type AdminDirectoryKind = "students" | "landlords";

export async function getAdminDirectory(
  kind: AdminDirectoryKind,
  search = "",
  statusFilter = ""
): Promise<AdminDirectoryUser[]> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (kind === "students" && statusFilter) params.set("verified", statusFilter);
  if (kind === "landlords" && statusFilter) params.set("verification_status", statusFilter);
  const response = await fetch(`${API_BASE_URL}/accounts/admin/${kind}/?${params.toString()}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to load account records.");
  }
  return result.users as AdminDirectoryUser[];
}

export async function updateAdminAccountStatus(
  kind: AdminDirectoryKind,
  userId: number,
  payload: { is_active?: boolean; is_verified?: boolean; verification_status?: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED" }
): Promise<void> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accounts/admin/${kind}/${userId}/status/`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to update this account.");
  }
}

export async function deleteAdminAccount(
  kind: AdminDirectoryKind,
  userId: number,
  confirmationEmail: string
): Promise<void> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accounts/admin/${kind}/${userId}/delete/`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: JSON.stringify({ confirmation_email: confirmationEmail }),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to permanently delete this account.");
  }
}

async function postAccountAction(path: string, payload: Record<string, string>) {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accounts/${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to complete this account action.");
  }
  return result as { success: boolean; message: string };
}

export function verifyEmailAddress(email: string, code: string) {
  return postAccountAction("verify-email/", { email, code });
}

export function resendEmailVerification(email: string) {
  return postAccountAction("verify-email/resend/", { email });
}

export function requestPasswordReset(email: string) {
  return postAccountAction("password-reset/", { email });
}

export function confirmPasswordReset(payload: {
  email: string;
  code: string;
  new_password: string;
  password_confirm: string;
}) {
  return postAccountAction("password-reset/confirm/", payload);
}

export interface WaitingListEntry {
  id: number;
  property: number;
  property_name: string;
  campus_name: string;
  room_type: number | null;
  room_type_name: string;
  max_monthly_price: string | null;
  accessibility_required: boolean;
  priority_score: number;
  status: "WAITING" | "OFFERED" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  queue_position: number | null;
  offered_room: number | null;
  offered_room_number: string | null;
  offered_bed_number: string | null;
  offered_at: string | null;
  respond_by: string | null;
  accepted_at: string | null;
  created_at: string;
  student: number;
  student_name: string;
  student_email: string;
  application_id: number | null;
}

async function waitingListRequest(path: string, method = "GET", payload?: Record<string, unknown>) {
  if (method !== "GET") await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/waiting-list/${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(payload ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" && csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to update the waiting list.");
  }
  return result;
}

export async function getStudentWaitingList(): Promise<WaitingListEntry[]> {
  const result = await waitingListRequest("");
  return result.entries as WaitingListEntry[];
}

export async function joinStudentWaitingList(
  propertyId: number,
  preferences: { room_type_id?: number | null; max_monthly_price?: string; accessibility_required?: boolean } = {}
): Promise<{ entry: WaitingListEntry; message: string }> {
  return waitingListRequest("", "POST", { property_id: propertyId, ...preferences });
}

export async function actOnStudentWaitingList(
  entryId: number,
  action: "accept" | "cancel"
): Promise<{ message: string; application_id?: number }> {
  return waitingListRequest(`${entryId}/${action}/`, "POST", {});
}

export async function getLandlordWaitingList(statusFilter = ""): Promise<WaitingListEntry[]> {
  const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
  const result = await waitingListRequest(`landlord/${query}`);
  return result.entries as WaitingListEntry[];
}

export async function updateLandlordWaitingListPriority(entryId: number, priorityScore: number) {
  return waitingListRequest(`landlord/${entryId}/`, "PATCH", { priority_score: priorityScore });
}

export type ComplaintStatus = "OPEN" | "UNDER_REVIEW" | "AWAITING_RESPONSE" | "RESOLVED" | "CLOSED" | "ESCALATED";
export type ComplaintPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ComplaintCategory = "SAFETY" | "FACILITIES" | "LANDLORD_SERVICE" | "ROOMMATE" | "BILLING" | "DISCRIMINATION" | "OTHER";

export interface ComplaintMessage {
  id: number;
  sender: number;
  sender_name: string;
  sender_role: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface StudentComplaint {
  id: number;
  reference_number: string;
  student: number;
  student_name: string;
  student_email: string;
  property: number | null;
  property_name: string;
  application: number | null;
  application_number: string | null;
  category: ComplaintCategory;
  category_display: string;
  title: string;
  description: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  assigned_to: number | null;
  assigned_to_name: string | null;
  resolution: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  messages?: ComplaintMessage[];
}

async function complaintRequest(path = "", method = "GET", payload?: Record<string, unknown>) {
  if (method !== "GET") await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/complaints/${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(payload ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" && csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to update the complaint.");
  }
  return result;
}

export async function getComplaints(statusFilter: ComplaintStatus | "" = ""): Promise<StudentComplaint[]> {
  const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
  const result = await complaintRequest(query);
  return result.complaints as StudentComplaint[];
}

export async function getComplaint(complaintId: number): Promise<StudentComplaint> {
  const result = await complaintRequest(`${complaintId}/`);
  return result.complaint as StudentComplaint;
}

export async function createComplaint(payload: {
  property_id: number;
  application_id?: number | null;
  category: ComplaintCategory;
  title: string;
  description: string;
}): Promise<StudentComplaint> {
  const result = await complaintRequest("", "POST", payload);
  return result.complaint as StudentComplaint;
}

export async function sendComplaintMessage(complaintId: number, body: string, isInternal = false): Promise<StudentComplaint> {
  const result = await complaintRequest(`${complaintId}/messages/`, "POST", { body, is_internal: isInternal });
  return result.complaint as StudentComplaint;
}

export async function updateComplaint(complaintId: number, payload: {
  status?: ComplaintStatus;
  resolution?: string;
}): Promise<StudentComplaint> {
  const result = await complaintRequest(`${complaintId}/`, "PATCH", payload);
  return result.complaint as StudentComplaint;
}

export interface ConversationMessage {
  id: number;
  sender: number;
  sender_name: string;
  sender_role: string;
  body: string;
  created_at: string;
}

export interface StudentHavenConversation {
  id: number;
  subject: string;
  property: number | null;
  property_name: string | null;
  application: number | null;
  application_number: string | null;
  status: "ACTIVE" | "CLOSED";
  created_by: number;
  participants: { id: number; name: string; email: string; role: string }[];
  other_participants: { id: number; name: string; email: string; role: string }[];
  last_message: ConversationMessage | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
  messages?: ConversationMessage[];
}

export interface MessagingRecipient {
  id: number;
  name: string;
  email: string;
  role: string;
}

async function messagingRequest(path = "", method = "GET", payload?: Record<string, unknown>) {
  if (method !== "GET") await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/messaging/${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(payload ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" && csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const result = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : null;
  if (!response.ok || !result?.success) {
    if (!result) {
      throw new Error(
        response.ok
          ? "Messages returned an unreadable response. Please try again."
          : `Messages are temporarily unavailable (HTTP ${response.status}). Please try again.`,
      );
    }
    throw new Error(result?.message || result?.detail || "Unable to update messages.");
  }
  return result;
}

export async function getConversations(): Promise<StudentHavenConversation[]> {
  const result = await messagingRequest();
  return result.conversations as StudentHavenConversation[];
}

export async function getMessagingRecipients(): Promise<MessagingRecipient[]> {
  const result = await messagingRequest("recipients/");
  return result.recipients as MessagingRecipient[];
}

export async function getConversation(conversationId: number): Promise<StudentHavenConversation> {
  const result = await messagingRequest(`${conversationId}/`);
  return result.conversation as StudentHavenConversation;
}

export async function startConversation(payload: {
  subject: string;
  body: string;
  property_id?: number | null;
  application_id?: number | null;
  recipient_id: number;
}): Promise<StudentHavenConversation> {
  const result = await messagingRequest("", "POST", payload);
  return result.conversation as StudentHavenConversation;
}

export async function sendConversationMessage(conversationId: number, body: string): Promise<ConversationMessage> {
  const result = await messagingRequest(`${conversationId}/messages/`, "POST", { body });
  return result.message as ConversationMessage;
}

export interface AdminAnalyticsOverview {
  success: boolean;
  period_days: number;
  generated_at: string;
  users: { total: number; students: number; landlords: number; administrators: number; verified_landlords: number; pending_landlord_verification: number; new_in_period: number };
  properties: { total: number; approved: number; pending: number; draft: number; rejected_or_suspended: number };
  beds: { total: number; available: number; reserved: number; occupied: number; blocked: number; occupancy_percent: number };
  applications: { total: number; in_period: number; by_status: Record<string, number>; monthly_trend: { month: string; count: number }[] };
  registrations_by_month: { month: string; role: string; count: number }[];
  finance: { amount_due: string | number; amount_paid: string | number; successful_transaction_total: string | number; successful_transaction_count: number; revenue_by_month: { month: string; amount: string | number }[] };
  complaints: { open: number; total: number };
  maintenance: { open: number; total: number };
  waiting_list: { waiting: number; offers: number };
  property_occupancy: { id: number; name: string; total_beds: number; occupied_beds: number; available_beds: number; occupancy_percent: number }[];
  occupancy_outlook: {
    method: string;
    approved_bed_capacity: number;
    average_monthly_applications: number;
    average_monthly_waitlist_entries: number;
    demand_by_type_and_location: { campus: string; room_type: string; application_count: number }[];
    monthly: { month: string; known_occupied_beds: number; known_occupancy_percent: number; known_move_ins: number; scheduled_vacancies: number }[];
  };
}

export async function getAdminAnalytics(days = 30): Promise<AdminAnalyticsOverview> {
  const response = await fetch(`${API_BASE_URL}/analytics/admin/overview/?days=${days}`, { credentials: "include", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to load platform analytics.");
  return result as AdminAnalyticsOverview;
}

export interface AdminAuditEvent {
  id: number;
  actor: number | null;
  actor_name: string;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  summary: string;
  metadata: Record<string, string | number | boolean | null>;
  ip_address: string | null;
  created_at: string;
}

export interface AdminSearchResult {
  kind: string;
  label: string;
  detail: string;
  path: string;
}

export async function getAdminGlobalSearch(query: string): Promise<AdminSearchResult[]> {
  const params = new URLSearchParams({ q: query.trim() });
  const response = await fetch(`${API_BASE_URL}/analytics/admin/search/?${params}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to search platform records.");
  return result.results as AdminSearchResult[];
}

export interface StudentPrivacySettings {
  share_contact_with_landlord: boolean;
}

export async function getStudentPrivacySettings(): Promise<StudentPrivacySettings> {
  const response = await fetch(`${API_BASE_URL}/accounts/privacy-settings/`, { credentials: "include", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to load privacy settings.");
  return result.settings as StudentPrivacySettings;
}

export async function updateStudentPrivacySettings(share_contact_with_landlord: boolean): Promise<StudentPrivacySettings> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accounts/privacy-settings/`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) },
    body: JSON.stringify({ share_contact_with_landlord }),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to save privacy settings.");
  return result.settings as StudentPrivacySettings;
}

export interface StudentProfilePhoto {
  photo_url: string | null;
}

export async function getStudentProfilePhoto(): Promise<StudentProfilePhoto> {
  const response = await fetch(`${API_BASE_URL}/accounts/profile/photo/`, { credentials: "include", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to load your profile photo.");
  return { photo_url: result.photo_url ?? null };
}

export async function uploadStudentProfilePhoto(file: File): Promise<StudentProfilePhoto> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const formData = new FormData();
  formData.append("photo", file);
  const response = await fetch(`${API_BASE_URL}/accounts/profile/photo/`, {
    method: "PUT", credentials: "include",
    headers: { Accept: "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) },
    body: formData,
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to upload your profile photo.");
  return { photo_url: result.photo_url ?? null };
}

export async function deleteStudentProfilePhoto(): Promise<void> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accounts/profile/photo/`, {
    method: "DELETE", credentials: "include",
    headers: { Accept: "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) },
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to remove your profile photo.");
}

export async function getAdminAuditEvents(filters: { search?: string; action?: string; entity_type?: string } = {}): Promise<AdminAuditEvent[]> {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.action?.trim()) params.set("action", filters.action.trim());
  if (filters.entity_type?.trim()) params.set("entity_type", filters.entity_type.trim());
  const response = await fetch(`${API_BASE_URL}/analytics/admin/audit-logs/?${params}`, { credentials: "include", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to load audit events.");
  return result.events as AdminAuditEvent[];
}

export type RiskSignalStatus = "OPEN" | "IN_REVIEW" | "DISMISSED" | "RESOLVED";

export interface AdminRiskSignal {
  id: number;
  student: number;
  student_name: string;
  student_email: string;
  application: number;
  application_number: string;
  property_name: string;
  signal_type: string;
  signal_type_display: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: RiskSignalStatus;
  occurrence_count: number;
  explanation: string;
  reviewed_by: string | null;
  review_note: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminLandlordRiskSignal {
  id: number;
  landlord: number;
  landlord_name: string;
  landlord_email: string;
  property: number | null;
  property_name: string;
  signal_type: string;
  signal_type_display: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: RiskSignalStatus;
  occurrence_count: number;
  explanation: string;
  reviewed_by: string | null;
  review_note: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAdminRiskSignals(filters: { search?: string; status?: string; severity?: string; application_id?: number } = {}): Promise<AdminRiskSignal[]> {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.application_id) params.set("application_id", String(filters.application_id));
  const response = await fetch(`${API_BASE_URL}/risk/admin/signals/?${params}`, { credentials: "include", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to load review signals.");
  return result.signals as AdminRiskSignal[];
}

export async function refreshAdminRiskSignals(): Promise<{ scanned_students: number; scanned_landlords: number; new_signals: number; message: string }> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/risk/admin/signals/refresh/`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) },
    body: JSON.stringify({}),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to refresh review signals.");
  return result;
}

export async function getAdminLandlordRiskSignals(filters: { search?: string; status?: string; severity?: string } = {}): Promise<AdminLandlordRiskSignal[]> {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.severity) params.set("severity", filters.severity);
  const response = await fetch(`${API_BASE_URL}/risk/admin/landlord-signals/?${params}`, { credentials: "include", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to load landlord review signals.");
  return result.signals as AdminLandlordRiskSignal[];
}

export async function updateAdminLandlordRiskSignal(signalId: number, status: RiskSignalStatus, reviewNote = ""): Promise<AdminLandlordRiskSignal> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/risk/admin/landlord-signals/${signalId}/decision/`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) },
    body: JSON.stringify({ status, review_note: reviewNote }),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to update this landlord review signal.");
  return result.signal as AdminLandlordRiskSignal;
}

export async function updateAdminRiskSignal(signalId: number, status: RiskSignalStatus, reviewNote = ""): Promise<AdminRiskSignal> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/risk/admin/signals/${signalId}/decision/`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) },
    body: JSON.stringify({ status, review_note: reviewNote }),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to update this review signal.");
  return result.signal as AdminRiskSignal;
}

export type AdminReportType = "applications" | "properties" | "occupancy" | "landlords" | "payments" | "waiting_list" | "complaints" | "maintenance";

export interface AdminReportTable {
  type: AdminReportType;
  generated_at: string;
  headers: string[];
  rows: string[][];
}

export interface AdminReportSchedule {
  id: number;
  report_type: AdminReportType;
  report_label: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  frequency_label: string;
  recipient_email: string;
  next_run_at: string;
  last_sent_at: string | null;
  last_error: string;
  is_active: boolean;
}

async function reportScheduleRequest(path: string, method: "GET" | "POST" | "PATCH" | "DELETE", payload?: Record<string, string | boolean>) {
  if (method !== "GET") await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/analytics/admin/report-schedules/${path}`, {
    method,
    credentials: "include",
    headers: { Accept: "application/json", ...(method !== "GET" ? { "Content-Type": "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to update the report schedule.");
  return result;
}

export async function getAdminReportSchedules(): Promise<AdminReportSchedule[]> {
  const result = await reportScheduleRequest("", "GET");
  return result.schedules as AdminReportSchedule[];
}

export async function createAdminReportSchedule(report_type: AdminReportType, frequency: AdminReportSchedule["frequency"]): Promise<AdminReportSchedule> {
  const result = await reportScheduleRequest("", "POST", { report_type, frequency });
  return result.schedule as AdminReportSchedule;
}

export async function setAdminReportScheduleActive(id: number, is_active: boolean): Promise<AdminReportSchedule> {
  const result = await reportScheduleRequest(`${id}/`, "PATCH", { is_active });
  return result.schedule as AdminReportSchedule;
}

export async function deleteAdminReportSchedule(id: number): Promise<void> {
  await reportScheduleRequest(`${id}/`, "DELETE");
}

export async function getAdminReportTable(reportType: AdminReportType): Promise<AdminReportTable> {
  const response = await fetch(`${API_BASE_URL}/analytics/admin/reports/?type=${encodeURIComponent(reportType)}&format=table`, { credentials: "include", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to prepare the printable report.");
  return result as AdminReportTable;
}

export async function downloadAdminReport(reportType: AdminReportType) {
  const response = await fetch(`${API_BASE_URL}/analytics/admin/reports/?type=${reportType}`, { credentials: "include" });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result?.message || result?.detail || "Unable to download this report.");
  }
  const file = await response.blob();
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `student-haven-${reportType}-report.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface ApplicationStatusHistory {
  id: number;
  from_status: string | null;
  to_status: string;
  note: string;
  changed_by_name: string | null;
  created_at: string;
}

export interface Application {
  id: number;
  application_number: string;
  student_name: string;

  property: number;
  property_name: string;

  room: number;
  room_number: string;

  status: string;
  current_step: number;

  date_of_birth: string | null;

  emergency_contact_name: string;
  emergency_contact_phone: string;

  academic_year: number | null;
  university: string;
  campus: string;
  course: string;
  year_of_study: number | null;

  expected_sign_in_date: string | null;
  expected_sign_out_date: string | null;

  accessibility_required: boolean;
  accessibility_notes: string;

  meal_preference: string;
  student_notes: string;

  funding_method: string;
  funding_notes: string;

  admin_notes: string;
  decline_reason: string;

  submitted_at: string | null;
  reviewed_at: string | null;

  created_at: string;
  updated_at: string;

  status_history: ApplicationStatusHistory[];
}

export interface LandlordApplication {
  id: number;
  application_number: string;
  student_name: string;
  property_name: string;
  room_number: string;
  status: string;
  university: string;
  campus: string;
  course: string;
  year_of_study: number | null;
  expected_sign_in_date: string | null;
  expected_sign_out_date: string | null;
  accessibility_required: boolean;
  meal_preference: string;
  funding_method: string;
  admin_notes: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export async function getLandlordApplications(filters: { q?: string; status?: string } = {}): Promise<LandlordApplication[]> {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.status) query.set("status", filters.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/applications/landlord/${suffix}`, { credentials: "include" });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data?.message || data?.detail || "Unable to load applications for your properties.");
  return data.applications;
}

//Room interface function

export interface RoomImage {
  id: number;
  image: string;
  caption: string;
  display_order: number;
}

export interface BedImage {
  id: number;
  image: string;
  caption: string;
  display_order: number;
}

export interface Bed {
  id: number;
  bed_number: string;
  status: string;
  images: BedImage[];
}

export interface Room {
  id: number;
  room_number: string;
  room_type: string;
  capacity: number;
  monthly_price: string;
  status: string;
  is_accessible: boolean;
  description: string;
  available_beds: number;
  occupied_beds: number;
  reserved_beds: number;
  blocked_beds: number;
  total_beds: number;
  beds: Bed[];
  images: RoomImage[];
}

// Accommodation interface function

export interface Amenity {
  id: number;
  name: string;
  icon: string;
  description: string;
}

export interface Property {
  id: number;
  name: string;
  property_type: string;
  description: string;
  virtual_tour_url: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  university: string;
  campus: string;
  campus_id: number;
  campus_latitude: string | null;
  campus_longitude: string | null;
  distance_from_campus_km: string | null;
  walking_minutes: number | null;
  rating: string | null;
  review_count: number;
  is_demo: boolean;
  monthly_min_price: string | null;
  monthly_max_price: string | null;
  status: string;
  available_rooms: number;
  available_beds: number;
  total_rooms: number;
  amenities: Amenity[];
  rooms: Room[];
  images: PropertyImage[];
}

export interface PropertyResponse {
  success: boolean;
  count: number;
  properties: Property[];
}

export interface PropertyImage {
  id: number;
  image: string;
  category: string;
  caption: string;
  is_primary: boolean;
  display_order: number;
}

export async function getProperties(
  search = "",
  sort = "recommended",
  propertyType = "",
  maxPrice = ""
): Promise<PropertyResponse> {

  const params = new URLSearchParams();

  if (search) {
    params.append("search", search);
  }

  if (sort) {
    params.append("sort", sort);
  }

  if (propertyType) {
    params.append(
      "property_type",
      propertyType
    );
  }

  if (maxPrice) {
    params.append(
      "max_price",
      maxPrice
    );
  }
  

  const response = await fetch(
    `${API_BASE_URL}/accommodations/properties/?${params.toString()}`,
    { headers: { Accept: "application/json" } }
  );

  const result = await readAccommodationResponse(response, "Unable to read accommodation data.");

  if (!response.ok) {
    throw new Error(
      typeof result.message === "string" ? result.message : "Unable to load accommodation."
    );
  }

  return result as unknown as PropertyResponse;
}

export async function getProperty(
  propertyId: number
): Promise<Property> {
  const response = await fetch(
    `${API_BASE_URL}/accommodations/properties/${propertyId}/`,
    { headers: { Accept: "application/json" } }
  );

  const result = await readAccommodationResponse(response, "Unable to read this property's room data.");

  if (!response.ok) {
    throw new Error(
      typeof result.message === "string" ? result.message : "Unable to load this property."
    );
  }

  return result.property as Property;
}

export interface PropertyReview {
  id: number;
  property: number;
  booking?: number;
  rating: number;
  title: string;
  body: string;
  status: "PENDING" | "PUBLISHED" | "REJECTED";
  created_at: string;
  reviewer?: string;
  property_name?: string;
  student_name?: string;
  student_email?: string;
}

export interface PropertyReviewPage {
  success: boolean;
  count: number;
  page: number;
  total_pages: number;
  has_previous: boolean;
  has_next: boolean;
  reviews: PropertyReview[];
}

export interface LandlordPropertyReviewPage extends PropertyReviewPage {
  average_rating: string | null;
}

export interface PropertyReviewFeed {
  success: boolean;
  property: number;
  viewer_is_student: boolean;
  average_rating: string | null;
  review_count: number;
  reviews: PropertyReview[];
  eligible_bookings: {
    id: number;
    booking_number: string;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
    checked_out_at: string | null;
  }[];
  my_reviews: PropertyReview[];
}

export async function getPropertyReviewFeed(propertyId: number): Promise<PropertyReviewFeed> {
  const response = await fetch(`${API_BASE_URL}/accommodations/properties/${propertyId}/reviews/`, { credentials: "include", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to load property reviews.");
  return result as PropertyReviewFeed;
}

export async function getAllPropertyReviews(page = 1): Promise<PropertyReviewPage> {
  const response = await fetch(`${API_BASE_URL}/accommodations/reviews/?page=${page}`, { credentials: "include", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to load resident reviews.");
  return result as PropertyReviewPage;
}

export async function getLandlordPropertyReviews(page = 1): Promise<LandlordPropertyReviewPage> {
  const response = await fetch(`${API_BASE_URL}/accommodations/landlord/reviews/?page=${page}`, { credentials: "include", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to load reviews for your properties.");
  return result as LandlordPropertyReviewPage;
}

export async function submitPropertyReview(propertyId: number, data: { booking_id: number; rating: number; title: string; body: string }): Promise<PropertyReview> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accommodations/properties/${propertyId}/reviews/`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to submit property review.");
  return result.review as PropertyReview;
}

export async function getAdminPropertyReviews(): Promise<PropertyReview[]> {
  const response = await fetch(`${API_BASE_URL}/accommodations/admin/property-reviews/`, { credentials: "include", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to load property reviews.");
  return result.reviews as PropertyReview[];
}

export async function getStudentFavoriteProperties(): Promise<Property[]> {
  const response = await fetch(`${API_BASE_URL}/accommodations/favorites/`, { credentials: "include", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Sign in as a student to view saved properties.");
  return result.properties as Property[];
}

export async function setStudentFavoriteProperty(propertyId: number, isFavorite: boolean): Promise<void> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accommodations/favorites/${propertyId}/`, {
    method: isFavorite ? "POST" : "DELETE",
    credentials: "include",
    headers: { Accept: "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) },
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to update saved properties.");
}

export interface AccommodationRecommendation {
  property: Property;
  match_score: number;
  reasons: string[];
  considerations: string[];
}

export async function getAccommodationRecommendations(preferences: {
  budget?: string;
  room_type?: string;
  accessible?: boolean;
  distance_km?: string;
}): Promise<AccommodationRecommendation[]> {
  const params = new URLSearchParams();
  if (preferences.budget) params.set("budget", preferences.budget);
  if (preferences.room_type?.trim()) params.set("room_type", preferences.room_type.trim());
  if (preferences.accessible) params.set("accessible", "true");
  if (preferences.distance_km) params.set("distance_km", preferences.distance_km);
  const response = await fetch(`${API_BASE_URL}/accommodations/recommendations/?${params}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to create accommodation matches.");
  }
  return result.recommendations as AccommodationRecommendation[];
}

// ============================================================
// LANDLORD PROPERTY MANAGEMENT
// ============================================================

export interface ManagementCampus {
  id: number;
  name: string;
  university: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
}

export interface ManagementRoomType {
  id: number;
  name: string;
  description: string;
  default_capacity: number;
  default_monthly_price: string | null;
}

export interface ManagementAmenity {
  id: number;
  name: string;
}

export interface AccommodationManagementOptions {
  campuses: ManagementCampus[];
  room_types: ManagementRoomType[];
  amenities: ManagementAmenity[];
  property_types: { value: string; label: string }[];
  property_statuses: { value: string; label: string }[];
}

export interface ManagedBed {
  id: number;
  bed_number: string;
  status: "AVAILABLE" | "RESERVED" | "OCCUPIED" | "BLOCKED";
}

export interface ManagedRoom {
  id: number;
  room_number: string;
  room_type: number;
  room_type_name: string;
  capacity: number;
  monthly_price: string;
  status: string;
  is_accessible: boolean;
  description: string;
  available_beds: number;
  occupied_beds: number;
  reserved_beds: number;
  blocked_beds: number;
  total_beds: number;
  beds: ManagedBed[];
  images: RoomImage[];
}

export interface ManagedFloor {
  id: number;
  floor_number: number;
  name: string;
  rooms: ManagedRoom[];
}

export interface ManagedBuilding {
  id: number;
  name: string;
  description: string;
  number_of_floors: number;
  floors: ManagedFloor[];
}

export interface ManagedProperty {
  id: number;
  landlord_name: string;
  name: string;
  property_type: string;
  description: string;
  virtual_tour_url: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  campus: number;
  campus_name: string;
  university_name: string;
  distance_from_campus_km: string | null;
  walking_minutes: number | null;
  rating: string | null;
  review_count: number;
  is_demo: boolean;
  monthly_min_price: string | null;
  monthly_max_price: string | null;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  verification_notes: string;
  approved_at: string | null;
  amenities: Amenity[];
  images: PropertyImage[];
  buildings: ManagedBuilding[];
  total_rooms: number;
  total_beds: number;
  available_beds: number;
  occupied_beds: number;
  reserved_beds: number;
}

export interface PropertyManagementPayload {
  name: string;
  property_type: string;
  description: string;
  virtual_tour_url: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  campus: number;
  distance_from_campus_km: string;
  walking_minutes: number | null;
  monthly_min_price: string | null;
  monthly_max_price: string | null;
  amenities: number[];
}

async function accommodationManagementRequest<T>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    await getCSRFToken();
    headers["Content-Type"] = "application/json";
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) headers["X-CSRFToken"] = csrfToken;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok || result?.success === false) {
    const firstError = result?.errors && Object.values(result.errors)[0];
    const message = Array.isArray(firstError) ? firstError[0] : firstError;
    throw new Error(result?.message || result?.detail || message || "Unable to save accommodation details.");
  }
  return result as T;
}

export async function getAccommodationManagementOptions(): Promise<AccommodationManagementOptions> {
  const result = await accommodationManagementRequest<{ options?: AccommodationManagementOptions } & AccommodationManagementOptions>("/accommodations/landlord/options/");
  return result.options ?? result;
}

export async function getLandlordProperties(): Promise<ManagedProperty[]> {
  const result = await accommodationManagementRequest<{ properties: ManagedProperty[] }>("/accommodations/landlord/properties/");
  return result.properties;
}

export async function createManagedProperty(payload: PropertyManagementPayload): Promise<ManagedProperty> {
  const result = await accommodationManagementRequest<{ property: ManagedProperty }>("/accommodations/landlord/properties/", "POST", payload);
  return result.property;
}

export async function updateManagedProperty(propertyId: number, payload: Partial<PropertyManagementPayload>): Promise<ManagedProperty> {
  const result = await accommodationManagementRequest<{ property: ManagedProperty }>(`/accommodations/landlord/properties/${propertyId}/`, "PATCH", payload);
  return result.property;
}

export async function submitManagedProperty(propertyId: number): Promise<ManagedProperty> {
  const result = await accommodationManagementRequest<{ property: ManagedProperty }>(`/accommodations/landlord/properties/${propertyId}/submit/`, "POST", {});
  return result.property;
}

export async function uploadManagedPropertyImage(
  propertyId: number,
  file: File,
  fields: { category: string; caption: string; is_primary: boolean }
): Promise<void> {
  await getCSRFToken();
  const formData = new FormData();
  formData.append("image", file);
  formData.append("category", fields.category);
  formData.append("caption", fields.caption);
  formData.append("is_primary", String(fields.is_primary));
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accommodations/landlord/properties/${propertyId}/images/`, {
    method: "POST",
    credentials: "include",
    headers: csrfToken ? { "X-CSRFToken": csrfToken } : {},
    body: formData,
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to upload this photo.");
  }
}

export async function deleteManagedPropertyImage(propertyId: number, imageId: number): Promise<void> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accommodations/landlord/properties/${propertyId}/images/${imageId}/`, {
    method: "DELETE",
    credentials: "include",
    headers: csrfToken ? { "X-CSRFToken": csrfToken } : {},
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to remove this photo.");
  }
}

export async function createManagedBuilding(propertyId: number, payload: { name: string; description: string; number_of_floors: number }): Promise<void> {
  await accommodationManagementRequest(`/accommodations/landlord/properties/${propertyId}/buildings/`, "POST", payload);
}

export async function createManagedFloor(buildingId: number, payload: { floor_number: number; name: string }): Promise<void> {
  await accommodationManagementRequest(`/accommodations/landlord/buildings/${buildingId}/floors/`, "POST", payload);
}

export async function createManagedRoom(floorId: number, payload: {
  room_number: string; room_type: number; capacity: number; monthly_price: string;
  status: string; is_accessible: boolean; description: string;
}): Promise<void> {
  await accommodationManagementRequest(`/accommodations/landlord/floors/${floorId}/rooms/`, "POST", payload);
}

export async function createManagedBed(roomId: number, payload: { bed_number: string; status: "AVAILABLE" | "BLOCKED" }): Promise<void> {
  await accommodationManagementRequest(`/accommodations/landlord/rooms/${roomId}/beds/`, "POST", payload);
}

export async function updateManagedStructure(kind: "building" | "floor" | "room" | "bed", id: number, payload: Record<string, unknown>): Promise<void> {
  await accommodationManagementRequest(`/accommodations/landlord/structures/${kind}/${id}/`, "PATCH", payload);
}

export async function getAdminPropertyQueue(): Promise<ManagedProperty[]> {
  const result = await accommodationManagementRequest<{ properties: ManagedProperty[] }>("/accommodations/admin/properties/");
  return result.properties;
}

export async function decideManagedProperty(
  propertyId: number,
  decision: "APPROVED" | "REJECTED",
  notes = ""
): Promise<ManagedProperty> {
  const result = await accommodationManagementRequest<{ property: ManagedProperty }>(
    `/accommodations/admin/properties/${propertyId}/decision/`,
    "POST",
    { decision, notes }
  );
  return result.property;
}

// Room details

export function getRoomFromProperty(
  property: Property,
  roomId: number
): Room {
  const room = property.rooms.find(
    (item) => item.id === roomId
  );

  if (!room) {
    throw new Error("Room not found.");
  }

  return room;
}

//AdminApplicationReviewView interface function

export interface AdminApplicationResponse {
  success: boolean;
  application: Application;
}

export interface AdminApplicationsResponse {
  success: boolean;
  count: number;
  applications: Application[];
}

export async function getAdminApplications(): Promise<AdminApplicationsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/applications/admin/`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.message ||
      result?.detail ||
      "Unable to load applications."
    );
  }

  return result;
}

export async function getAdminApplication(
  applicationId: number
): Promise<AdminApplicationResponse> {
  const response = await fetch(
    `${API_BASE_URL}/applications/admin/${applicationId}/`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.message ||
      result?.detail ||
      "Unable to load application."
    );
  }

  return result;
}

export interface AdminApplicationEligibility {
  success: boolean;
  application_id: number;
  application_number: string;
  eligible: boolean;
  reasons: string[];
  required_documents_verified: number;
  required_documents_total: number;
}

export async function getAdminApplicationEligibility(
  applicationId: number
): Promise<AdminApplicationEligibility> {
  const response = await fetch(
    `${API_BASE_URL}/applications/admin/${applicationId}/eligibility/`,
    { method: "GET", credentials: "include" }
  );
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to check application eligibility.");
  return result as AdminApplicationEligibility;
}

// Admin application status update function

export async function startApplicationReview(
  applicationId: number
) {
  await getCSRFToken();

  const csrfToken = getCookie("csrftoken");

  const response = await fetch(
    `${API_BASE_URL}/applications/${applicationId}/start-review/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken || "",
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.detail ||
        "Unable to start application review."
    );
  }

  return result;
}

export async function reopenApplicationReview(
  applicationId: number,
  note = ""
) {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/applications/${applicationId}/reopen-review/`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: JSON.stringify({ note }),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to reopen this application for review.");
  }
  return result;
}

export async function submitApplicationDecision(
  applicationId: number,
  decision: "APPROVED" | "DECLINED" | "WAITING_LIST" | "ADDITIONAL_INFO",
  note = "",
  declineReason = ""
) {
  await getCSRFToken();

  const csrfToken = getCookie("csrftoken");

  const response = await fetch(
    `${API_BASE_URL}/applications/${applicationId}/decision/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken || "",
      },
      body: JSON.stringify({
        decision,
        note,
        decline_reason: declineReason,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.detail ||
        "Unable to update application decision."
    );
  }

  return result;
}

//User application Contracts interface function

export interface StudentContract {
  id: number;
  contract_number: string;
  application: number;
  student: number;
  student_name: string;
  property_name: string;
  room_number: string;
  start_date: string | null;
  end_date: string | null;
  monthly_fee: string;
  terms: string | null;
  rules: string | null;
  cancellation_policy: string | null;
  status: "DRAFT" | "PENDING_SIGNATURE" | "SIGNED" | "CANCELLED" | "EXPIRED";
  signed_at: string | null;
  signature_name: string;
  signature_consent_version: string;
  created_at: string;
  updated_at: string;
}

// Fetch student contracts

export async function getStudentContract(
  applicationId: number
): Promise<StudentContract> {
  const response = await fetch(
    `${API_BASE_URL}/contracts/application/${applicationId}/`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || "Unable to load contract."
    );
  }

  return data.contract;
}

export async function getLandlordContracts(status = "", search = ""): Promise<StudentContract[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  const suffix = params.size ? `?${params}` : "";
  const response = await fetch(`${API_BASE_URL}/contracts/landlord/${suffix}`, { credentials: "include" });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data?.message || data?.detail || "Unable to load property contracts.");
  return data.contracts;
}

//Application response interface function

export interface MyApplicationsResponse {
  success: boolean;
  applications: Application[];
}

export async function getMyApplications(): Promise<Application[]> {
  const response = await fetch(
    `${API_BASE_URL}/applications/mine/`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data?.message ||
        data?.detail ||
        "Unable to load your applications."
    );
  }

  return data.applications;
}



// Sign student contract

export async function signStudentContract(
  applicationId: number,
  signatureName: string,
  confirmation: boolean
): Promise<StudentContract> {
  await getCSRFToken();

  const csrfToken = getCookie("csrftoken");

  const response = await fetch(
    `${API_BASE_URL}/contracts/application/${applicationId}/sign/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken || "",
      },
      body: JSON.stringify({
        confirmation,
        signature_name: signatureName,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || "Unable to sign contract."
    );
  }

  return data.contract;
}

// payment transaction interface function

export interface PaymentTransaction {
  id: number;
  transaction_reference: string;
  provider: string;
  amount: string;
  currency: string;
  status:
    | "PROCESSING"
    | "SUCCESSFUL"
    | "FAILED"
    | "REVERSED"
    | "REFUNDED";
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch student funding payments

export interface FundingPayment {
  id: number;
  contract: number;
  application: number;
  student: number;
  student_name: string;
  property_name: string;
  monthly_rent: string;
  stay_start_date: string | null;
  stay_end_date: string | null;
  rent_schedule: {
    due_date: string;
    start_date: string;
    end_date: string;
    amount_due: string;
    amount_paid: string;
    balance: string;
    status: "PAID" | "PARTIALLY_PAID" | "DUE";
  }[];

  funding_method: string;
  funding_status:
    | "PENDING"
    | "VERIFIED"
    | "PARTIALLY_FUNDED"
    | "REJECTED";

  payment_status:
    | "PENDING"
    | "PROCESSING"
    | "SUCCESSFUL"
    | "FAILED"
    | "REVERSED"
    | "REFUNDED";

  amount_due: string;
  amount_paid: string;
  balance: string;
  remaining_months: number;
  pending_payment_amount: string | null;
  booking_confirmed: boolean;
  currency: string;

  payment_reference: string;
  funding_notes: string;
  due_date: string | null;

  transactions: PaymentTransaction[];


  created_at: string;
  updated_at: string;
}

export interface AdminFundingRecord extends FundingPayment {
  student_name: string;
  student_email: string;
  application_number: string;
  property_name: string;
  contract_number: string;
}

export interface RefundRequest {
  id: number;
  application: number;
  application_number: string;
  student: number;
  student_name: string;
  student_email: string;
  property_name: string;
  transaction: number;
  transaction_reference: string;
  provider: string;
  transaction_amount: string;
  amount: string;
  currency: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "PROCESSING" | "REJECTED" | "REFUNDED" | "FAILED";
  review_note: string;
  provider_reference: string;
  requested_at: string;
  reviewed_at: string | null;
  processed_at: string | null;
}

async function refundApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (init.method && init.method !== "GET") {
    await getCSRFToken();
  }
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
      ...init.headers,
    },
    ...init,
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to update refund request.");
  }
  return result as T;
}

export async function getStudentRefundRequests(applicationId: number): Promise<RefundRequest[]> {
  const result = await refundApiRequest<{ refunds: RefundRequest[] }>(`/funding/application/${applicationId}/refunds/`);
  return result.refunds;
}

export async function createStudentRefundRequest(applicationId: number, transactionId: number, amount: string, reason: string): Promise<RefundRequest> {
  const result = await refundApiRequest<{ refund: RefundRequest }>(`/funding/application/${applicationId}/refunds/`, {
    method: "POST",
    body: JSON.stringify({ transaction_id: transactionId, amount, reason }),
  });
  return result.refund;
}

export async function getAdminRefundRequests(status = ""): Promise<RefundRequest[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const result = await refundApiRequest<{ refunds: RefundRequest[] }>(`/funding/admin/refunds/${query}`);
  return result.refunds;
}

export async function updateAdminRefundRequest(id: number, status: RefundRequest["status"], reviewNote: string, providerReference = ""): Promise<RefundRequest> {
  const result = await refundApiRequest<{ refund: RefundRequest }>(`/funding/admin/refunds/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ status, review_note: reviewNote, provider_reference: providerReference }),
  });
  return result.refund;
}

export async function getLandlordFundingPayments(status = ""): Promise<FundingPayment[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetch(`${API_BASE_URL}/funding/landlord/records/${suffix}`, { credentials: "include" });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data?.message || data?.detail || "Unable to load property payment records.");
  return data.funding_payments;
}

export interface SponsorshipProgram {
  id: number;
  name: string;
  sponsor_name: string;
  description: string;
  eligibility_rules: string;
  amount: string;
  currency: string;
  funding_period_start: string;
  funding_period_end: string;
  application_deadline: string | null;
  maximum_beneficiaries: number | null;
  conditions: string;
  is_active: boolean;
  application_count: number;
  beneficiary_count: number;
  available_slots: number | null;
  created_at: string;
  updated_at: string;
  my_application_id?: number | null;
  my_application_status?: SponsorshipApplication["status"] | "";
}

export interface SponsorshipApplication {
  id: number;
  program: number;
  program_name: string;
  sponsor_name: string;
  program_description: string;
  eligibility_rules: string;
  program_amount: string;
  program_currency: string;
  funding_period_start: string;
  funding_period_end: string;
  student: number;
  student_name: string;
  student_email: string;
  student_number: string;
  statement: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WAITLISTED";
  review_note: string;
  award_amount: string | null;
  award_conditions: string;
  award_period_start: string | null;
  award_period_end: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  submitted_at: string;
  updated_at: string;
}

export type SponsorshipProgramPayload = Omit<SponsorshipProgram, "id" | "application_count" | "beneficiary_count" | "available_slots" | "created_at" | "updated_at" | "my_application_id" | "my_application_status">;

async function sponsorshipRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    await getCSRFToken();
    headers["Content-Type"] = "application/json";
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) headers["X-CSRFToken"] = csrfToken;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    const firstError = result?.errors ? Object.values(result.errors as Record<string, unknown>).flat()[0] : undefined;
    throw new Error(result?.message || result?.detail || String(firstError || "Unable to complete this funding action."));
  }
  return result as T;
}

export async function getSponsorshipPrograms(): Promise<SponsorshipProgram[]> {
  const result = await sponsorshipRequest<{ programs: SponsorshipProgram[] }>("/funding/programs/");
  return result.programs;
}

export async function getMySponsorshipApplications(): Promise<SponsorshipApplication[]> {
  const result = await sponsorshipRequest<{ applications: SponsorshipApplication[] }>("/funding/my-sponsorship-applications/");
  return result.applications;
}

export async function applyToSponsorshipProgram(programId: number, statement: string): Promise<SponsorshipApplication> {
  const result = await sponsorshipRequest<{ application: SponsorshipApplication }>(`/funding/programs/${programId}/apply/`, "POST", { statement });
  return result.application;
}

export async function getAdminSponsorshipPrograms(): Promise<SponsorshipProgram[]> {
  const result = await sponsorshipRequest<{ programs: SponsorshipProgram[] }>("/funding/admin/sponsorship-programs/");
  return result.programs;
}

export async function createSponsorshipProgram(payload: SponsorshipProgramPayload): Promise<SponsorshipProgram> {
  const result = await sponsorshipRequest<{ program: SponsorshipProgram }>("/funding/admin/sponsorship-programs/", "POST", payload);
  return result.program;
}

export async function updateSponsorshipProgram(programId: number, payload: Partial<SponsorshipProgramPayload>): Promise<SponsorshipProgram> {
  const result = await sponsorshipRequest<{ program: SponsorshipProgram }>(`/funding/admin/sponsorship-programs/${programId}/`, "PATCH", payload);
  return result.program;
}

export async function getAdminSponsorshipApplications(status = "", search = ""): Promise<SponsorshipApplication[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  const result = await sponsorshipRequest<{ applications: SponsorshipApplication[] }>(`/funding/admin/sponsorship-applications/?${params}`);
  return result.applications;
}

export async function reviewSponsorshipApplication(applicationId: number, decision: {
  status: SponsorshipApplication["status"];
  review_note: string;
  award_amount?: string | null;
  award_conditions?: string;
  award_period_start?: string | null;
  award_period_end?: string | null;
}): Promise<SponsorshipApplication> {
  const result = await sponsorshipRequest<{ application: SponsorshipApplication }>(`/funding/admin/sponsorship-applications/${applicationId}/`, "PATCH", decision);
  return result.application;
}

export interface PlatformConfiguration {
  id: number;
  application_period_name: string;
  applications_open: boolean;
  application_opens_at: string | null;
  application_closes_at: string | null;
  closed_message: string;
  support_email: string;
  updated_at: string;
}

export interface PlatformAnnouncement {
  id: number;
  title: string;
  body: string;
  audience: "ALL" | "STUDENT" | "LANDLORD" | "ADMINISTRATOR";
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ApplicationAvailability {
  is_open: boolean;
  period_name: string;
  opens_at: string | null;
  closes_at: string | null;
  message: string;
}

async function coreApiRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    await getCSRFToken();
    headers["Content-Type"] = "application/json";
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) headers["X-CSRFToken"] = csrfToken;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method, credentials: "include", headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    const firstError = result?.errors ? Object.values(result.errors as Record<string, unknown>).flat()[0] : undefined;
    throw new Error(result?.message || result?.detail || String(firstError || "Unable to complete this platform action."));
  }
  return result as T;
}

export async function getCurrentAnnouncements(): Promise<PlatformAnnouncement[]> {
  const result = await coreApiRequest<{ announcements: PlatformAnnouncement[] }>("/core/announcements/");
  return result.announcements;
}

export async function getApplicationAvailability(): Promise<ApplicationAvailability> {
  return coreApiRequest<ApplicationAvailability>("/core/application-availability/");
}

export async function getAdminPlatformConfiguration(): Promise<PlatformConfiguration> {
  const result = await coreApiRequest<{ configuration: PlatformConfiguration }>("/core/admin/settings/");
  return result.configuration;
}

export async function updateAdminPlatformConfiguration(payload: Partial<Omit<PlatformConfiguration, "id" | "updated_at">>): Promise<{ configuration: PlatformConfiguration; landlords_notified: number }> {
  return coreApiRequest<{ configuration: PlatformConfiguration; landlords_notified: number }>("/core/admin/settings/", "PATCH", payload);
}

export async function getAdminAnnouncements(): Promise<PlatformAnnouncement[]> {
  const result = await coreApiRequest<{ announcements: PlatformAnnouncement[] }>("/core/admin/announcements/");
  return result.announcements;
}

export async function createAdminAnnouncement(payload: Omit<PlatformAnnouncement, "id" | "created_by" | "created_at" | "updated_at">): Promise<{ announcement: PlatformAnnouncement; landlords_notified: number }> {
  return coreApiRequest<{ announcement: PlatformAnnouncement; landlords_notified: number }>("/core/admin/announcements/", "POST", payload);
}

export async function updateAdminAnnouncement(announcementId: number, payload: Partial<Omit<PlatformAnnouncement, "id" | "created_by" | "created_at" | "updated_at">>): Promise<{ announcement: PlatformAnnouncement; landlords_notified: number }> {
  return coreApiRequest<{ announcement: PlatformAnnouncement; landlords_notified: number }>(`/core/admin/announcements/${announcementId}/`, "PATCH", payload);
}

export async function getAdminFundingRecords(filters: { search?: string; funding_status?: string; payment_status?: string } = {}): Promise<AdminFundingRecord[]> {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.funding_status) params.set("funding_status", filters.funding_status);
  if (filters.payment_status) params.set("payment_status", filters.payment_status);
  const response = await fetch(`${API_BASE_URL}/funding/admin/records/?${params}`, { credentials: "include", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to load funding records.");
  return result.records as AdminFundingRecord[];
}

export async function updateAdminFundingRecord(recordId: number, fundingStatus: FundingPayment["funding_status"], reviewNote: string): Promise<AdminFundingRecord> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/funding/admin/records/${recordId}/`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) },
    body: JSON.stringify({ funding_status: fundingStatus, review_note: reviewNote }),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to save the funding review.");
  return result.record as AdminFundingRecord;
}

//get student funding payments
export async function getStudentFundingPayment(
  applicationId: number
): Promise<FundingPayment> {
  const response = await fetch(
    `${API_BASE_URL}/funding/application/${applicationId}/`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.detail ||
        "Unable to load funding and payment information."
    );
  }

  return data.funding_payment;
}

// make payment for student funding

export async function makeStudentPayment(
  applicationId: number,
  amount?: string
): Promise<FundingPayment> {
  await getCSRFToken();

  const csrfToken = getCookie("csrftoken");

  const response = await fetch(
    `${API_BASE_URL}/funding/application/${applicationId}/pay/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken || "",
      },
      body: JSON.stringify(amount ? { amount } : {}),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.detail ||
        "Unable to process payment."
    );
  }

  return data.funding_payment;
}

// Booking interface function

export interface Booking {
  id: number;
  booking_number: string;
  application: number;
  contract: number;
  student: number;
  student_name: string;
  property: number;
  property_name: string;
  room: number;
  room_number: string;
  bed: number;
  bed_number: string;
  start_date: string;
  end_date: string;
  monthly_fee: string;
  status: string;
  confirmed_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  check_in_eligible: boolean;
  check_out_eligible: boolean;
  check_in_record: {
    staff_name: string;
    identity_document_type: "NATIONAL_ID" | "PASSPORT" | "OTHER_OFFICIAL_ID";
    identity_verified: boolean;
    room_inspected: boolean;
    keys_handed_over: boolean;
    arrival_notes: string;
    checked_in_at: string;
  } | null;
  check_in_token: string;
  created_at: string;
  updated_at: string;
}

export interface PayFastConfiguration {
  enabled: boolean;
  mode: "disabled" | "sandbox" | "live";
  checkout_url: string | null;
  local_simulation_enabled: boolean;
  message: string;
}

export interface PayFastCheckout {
  checkout_url: string;
  form_fields: Record<string, string>;
  transaction_reference: string;
}

export async function getPayFastConfiguration(): Promise<PayFastConfiguration> {
  const response = await fetch(`${API_BASE_URL}/funding/payfast/config/`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || data?.detail || "Unable to load payment gateway settings.");
  }
  return data as PayFastConfiguration;
}

export async function startPayFastCheckout(applicationId: number, amount?: string): Promise<PayFastCheckout> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/funding/application/${applicationId}/payfast/checkout/`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) },
    body: JSON.stringify(amount ? { amount } : {}),
  });
  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || data?.detail || "Unable to start PayFast checkout.");
  }
  return data as PayFastCheckout;
}

export async function cancelPayFastCheckout(applicationId: number, transactionReference: string): Promise<void> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/funding/application/${applicationId}/payfast/cancel/`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}) },
    body: JSON.stringify({ transaction_reference: transactionReference }),
  });
  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || data?.detail || "Unable to update the cancelled checkout.");
  }
}

export interface AccommodationChangeRequest {
  id: number;
  booking: number;
  booking_number: string;
  student: number;
  student_name: string;
  request_type: "RENEWAL" | "TRANSFER";
  status: "PENDING" | "APPROVED" | "DECLINED" | "WITHDRAWN";
  reason: string;
  requested_end_date: string | null;
  target_property: number | null;
  target_property_name: string;
  current_property_name: string;
  current_room_number: string;
  decision_note: string;
  reviewed_by: number | null;
  reviewed_by_name: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferPropertyOption {
  id: number;
  name: string;
  campus_name: string;
}

export interface ManagedBooking {
  id: number;
  booking_number: string;
  application: number;
  contract: number;
  student: number;
  student_name: string;
  student_email: string;
  student_mobile: string;
  property: number;
  property_name: string;
  room: number;
  room_number: string;
  bed: number;
  bed_number: string;
  start_date: string;
  end_date: string;
  monthly_fee: string;
  status: string;
  confirmed_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  check_in_record: {
    staff_name: string;
    identity_document_type: "NATIONAL_ID" | "PASSPORT" | "OTHER_OFFICIAL_ID";
    identity_verified: boolean;
    room_inspected: boolean;
    keys_handed_over: boolean;
    arrival_notes: string;
    checked_in_at: string;
  } | null;
  updated_at: string;
}

export async function getManagedBookings(filters: { q?: string; status?: string } = {}): Promise<ManagedBooking[]> {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.status) query.set("status", filters.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/bookings/managed/${suffix}`, { credentials: "include" });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data?.message || data?.detail || "Unable to load landlord bookings.");
  return data.bookings;
}

export interface ManagedBookingTransferRoom {
  id: number;
  room_number: string;
  monthly_price: string;
  beds: { id: number; bed_number: string }[];
}

export async function getManagedBookingTransferOptions(bookingId: number): Promise<ManagedBookingTransferRoom[]> {
  const response = await fetch(`${API_BASE_URL}/bookings/managed/${bookingId}/transfer-options/`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data?.message || data?.detail || "Unable to load available room transfers.");
  return data.rooms as ManagedBookingTransferRoom[];
}

async function postManagedBookingAction<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/bookings/managed/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRFToken": csrfToken || "" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data?.message || data?.detail || "Unable to update the accommodation booking.");
  return data as T;
}

export async function terminateManagedBooking(bookingId: number, reason: string): Promise<ManagedBooking> {
  const data = await postManagedBookingAction<{ success: boolean; booking: ManagedBooking }>(`${bookingId}/terminate/`, { reason });
  return data.booking;
}

export async function transferManagedBooking(bookingId: number, targetBed: number, reason: string): Promise<ManagedBooking> {
  const data = await postManagedBookingAction<{ success: boolean; booking: ManagedBooking }>(`${bookingId}/transfer/`, { target_bed: targetBed, reason });
  return data.booking;
}

export interface AccommodationChangeRequestPayload {
  request_type: "RENEWAL" | "TRANSFER";
  reason: string;
  requested_end_date?: string;
  target_property?: number | null;
}

async function postAccommodationLifecycle<T>(path: string, body: unknown): Promise<T> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/bookings/lifecycle/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken || "" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.message || data?.detail || "Unable to process the accommodation request.");
  }
  return data as T;
}

export async function getAccommodationChangeRequests(applicationId: number): Promise<AccommodationChangeRequest[]> {
  const response = await fetch(`${API_BASE_URL}/bookings/lifecycle/application/${applicationId}/requests/`, { credentials: "include" });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data?.message || data?.detail || "Unable to load accommodation requests.");
  return data.requests;
}

export async function getTransferPropertyOptions(): Promise<TransferPropertyOption[]> {
  const response = await fetch(`${API_BASE_URL}/bookings/lifecycle/transfer-options/`, { credentials: "include" });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data?.message || data?.detail || "Unable to load transfer destinations.");
  return data.properties;
}

export async function createAccommodationChangeRequest(applicationId: number, payload: AccommodationChangeRequestPayload): Promise<AccommodationChangeRequest> {
  const data = await postAccommodationLifecycle<{ success: boolean; request: AccommodationChangeRequest }>(`application/${applicationId}/requests/`, payload);
  return data.request;
}

export async function withdrawAccommodationChangeRequest(requestId: number): Promise<AccommodationChangeRequest> {
  const data = await postAccommodationLifecycle<{ success: boolean; request: AccommodationChangeRequest }>(`requests/${requestId}/withdraw/`, {});
  return data.request;
}

export async function getManagedAccommodationChangeRequests(filters: { status?: string; request_type?: string } = {}): Promise<AccommodationChangeRequest[]> {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.request_type) query.set("request_type", filters.request_type);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/bookings/lifecycle/management/requests/${suffix}`, { credentials: "include" });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data?.message || data?.detail || "Unable to load the request queue.");
  return data.requests;
}

export async function decideAccommodationChangeRequest(requestId: number, decision: "APPROVED" | "DECLINED", decisionNote: string): Promise<AccommodationChangeRequest> {
  const data = await postAccommodationLifecycle<{ success: boolean; request: AccommodationChangeRequest }>(`management/requests/${requestId}/decision/`, { decision, decision_note: decisionNote });
  return data.request;
}

export async function getStudentBooking(
  applicationId: number
): Promise<Booking | null> {
  const response = await fetch(
    `${API_BASE_URL}/bookings/application/${applicationId}/`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const data = await readAccommodationResponse(response, "Unable to load booking information.");

  if (!response.ok || !data.success) {
    throw new Error(String(data.message || data.detail || "Unable to load booking information."));
  }

  return (data.booking as Booking | null) ?? null;
}

export interface CheckInConfirmation {
  identity_document_type: "NATIONAL_ID" | "PASSPORT" | "OTHER_OFFICIAL_ID";
  identity_verified: boolean;
  room_inspected: boolean;
  keys_handed_over: boolean;
  arrival_notes: string;
}

export async function previewStudentCheckIn(token: string): Promise<Booking> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/bookings/scan/check-in/preview/`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken || "" },
    body: JSON.stringify({ token }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.message || data?.detail || "Unable to verify this check-in QR code.");
  }
  return data.booking as Booking;
}

export async function adminScanCheckIn(
  token: string,
  confirmation: CheckInConfirmation,
): Promise<Booking> {
  await getCSRFToken();

  const csrfToken = getCookie("csrftoken");

  const response = await fetch(
    `${API_BASE_URL}/bookings/scan/check-in/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken || "",
      },
      body: JSON.stringify({ token, ...confirmation }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data?.message ||
        data?.detail ||
        "Unable to complete the student's check-in."
    );
  }

  return data.booking;
}

export async function checkOutStudentBooking(
  applicationId: number
): Promise<Booking> {
  await getCSRFToken();

  const csrfToken = getCookie("csrftoken");

  const response = await fetch(
    `${API_BASE_URL}/bookings/application/${applicationId}/check-out/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken || "",
      },
      body: JSON.stringify({}),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data?.message ||
        data?.detail ||
        "Unable to check you out."
    );
  }

  return data.booking;
}

// student profile update interface function

export interface StudentProfileUpdatePayload {
  first_name: string;
  last_name: string;
  mobile: string;
  university: string;
  campus: string;
  course: string;
  year_of_study: number | null;
  date_of_birth: string;
  national_id?: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    accessibility_requirements?: string;
    accommodation_preferences?: {
      budget?: string;
      room_type?: string;
      accessible?: boolean;
      distance_km?: string;
    };
  }

export async function updateStudentProfile(
  payload: Partial<StudentProfileUpdatePayload>
): Promise<CurrentUser> {

  // Make sure Django sets the CSRF cookie first.
  await getCSRFToken();

  // Read the CSRF token from the browser cookie.
  const csrfCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrftoken="));

  const csrfToken = csrfCookie
    ? decodeURIComponent(csrfCookie.split("=")[1])
    : "";

  if (!csrfToken) {
    throw new Error(
      "Unable to obtain the CSRF token."
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/accounts/me/`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {

    const firstError =
      data?.errors &&
      Object.values(data.errors)[0];

    throw new Error(
      data?.message ||
      data?.detail ||
      (Array.isArray(firstError)
        ? firstError[0]
        : "") ||
      "Unable to update your profile."
    );
  }

  return data as CurrentUser;
}

export interface LandlordProfileUpdatePayload {
  first_name: string;
  last_name: string;
  mobile: string;
  business_name: string;
  registration_number: string;
  phone: string;
  address: string;
}

export async function updateLandlordProfile(payload: LandlordProfileUpdatePayload): Promise<CurrentUser> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accounts/me/`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken || "" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    const firstError = data?.errors && Object.values(data.errors)[0];
    throw new Error(data?.message || data?.detail || (Array.isArray(firstError) ? firstError[0] : "") || "Unable to update your landlord profile.");
  }
  return data as CurrentUser;
}

// ============================================================
// STUDENT DOCUMENTS
// ============================================================

export type DocumentType =
  | "PROOF_OF_REGISTRATION"
  | "STUDENT_ID"
  | "FUNDING_CONFIRMATION"
  | "BURSARY_SPONSORSHIP"
  | "OTHER";

export type DocumentStatus =
  | "PROCESSING"
  | "VERIFIED"
  | "NEEDS_REVIEW"
  | "REJECTED";

export interface StudentDocument {
  id: number;
  application: number;
  student: number;
  document_type: DocumentType;
  document_type_display: string;
  file: string;
  file_url: string | null;
  preview_url: string | null;
  original_filename: string;
  status: DocumentStatus;
  status_display: string;
  verification_notes: string;
  rejection_reason: string;
  uploaded_at: string;
  verified_at: string | null;
  expiry_date: string | null;
  updated_at: string;
}

export interface StudentDocumentsResponse {
  success: boolean;
  documents: StudentDocument[];
}

export interface LandlordApplicationDocumentsResponse {
  success: boolean;
  application: {
    id: number;
    application_number: string;
    student_name: string;
    property_name: string;
  };
  documents: StudentDocument[];
}

export async function getLandlordApplicationDocuments(
  applicationId: number
): Promise<LandlordApplicationDocumentsResponse> {
  const response = await fetch(`${API_BASE_URL}/documents/landlord/application/${applicationId}/`, { credentials: "include" });
  const result = await response.json();
  if (!response.ok || !result?.success) throw new Error(result?.message || result?.detail || "Unable to load application documents.");
  return result as LandlordApplicationDocumentsResponse;
}

export async function getLandlordDocumentPreview(documentId: number): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/documents/preview/${documentId}/`, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.message || result?.detail || "Unable to open this document preview.");
  }
  return response.blob();
}

export async function getStudentDocuments(
  applicationId: number
): Promise<StudentDocument[]> {

  const response = await fetch(
    `${API_BASE_URL}/documents/application/${applicationId}/`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const data =
    await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data?.message ||
        data?.detail ||
        "Unable to load your documents."
    );
  }

  return data.documents;
}

export async function submitStudentApplication(applicationId: number): Promise<void> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/applications/${applicationId}/submit/`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to submit your application.");
  }
}

export async function uploadStudentDocument(
  applicationId: number,
  documentType: DocumentType,
  file: File,
  expiryDate = ""
): Promise<StudentDocument> {

  await getCSRFToken();

  const csrfToken =
    getCookie("csrftoken");

  const formData =
    new FormData();

  formData.append(
    "application_id",
    String(applicationId)
  );

  formData.append(
    "document_type",
    documentType
  );

  formData.append(
    "file",
    file
  );

  if (expiryDate) {
    formData.append(
      "expiry_date",
      expiryDate
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/documents/application/${applicationId}/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "X-CSRFToken":
          csrfToken || "",
      },
      body: formData,
    }
  );

  const data =
    await response.json();

  if (!response.ok || !data.success) {

    const firstError =
      data?.errors &&
      Object.values(
        data.errors
      )[0];

    throw new Error(
      data?.message ||
        data?.detail ||
        (Array.isArray(firstError)
          ? firstError[0]
          : "") ||
        "Unable to upload the document."
    );
  }

  return data.document;
}

export async function deleteStudentDocument(
  documentId: number
): Promise<void> {

  await getCSRFToken();

  const csrfToken =
    getCookie("csrftoken");

  const response = await fetch(
    `${API_BASE_URL}/documents/${documentId}/`,
    {
      method: "DELETE",
      credentials: "include",
      headers: {
        "X-CSRFToken":
          csrfToken || "",
      },
    }
  );

  const data =
    await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data?.message ||
        data?.detail ||
        "Unable to delete the document."
    );
  }
}

export type LandlordDocumentDecision = "VERIFIED" | "REJECTED";

export async function decideLandlordDocument(
  documentId: number,
  decision: LandlordDocumentDecision,
  note = ""
): Promise<StudentDocument> {
  await getCSRFToken();

  const csrfToken = getCookie("csrftoken");

  const response = await fetch(
    `${API_BASE_URL}/documents/landlord/${documentId}/decision/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken
          ? { "X-CSRFToken": csrfToken }
          : {}),
      },
      body: JSON.stringify({
        decision,
        note,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.detail ||
        "Unable to update document status."
    );
  }

  return result.document ?? result;
}

// ============================================================
// STUDENT MAINTENANCE
// ============================================================

export type MaintenanceCategory =
  | "ELECTRICAL"
  | "PLUMBING"
  | "WIFI"
  | "FURNITURE"
  | "CLEANING"
  | "SECURITY"
  | "ROOM_DAMAGE"
  | "OTHER";

export type MaintenancePriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "URGENT";

export type MaintenanceStatus =
  | "SUBMITTED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_FOR_PARTS"
  | "RESOLVED"
  | "STUDENT_CONFIRMED"
  | "ESCALATED"
  | "CANCELLED";


export interface MaintenanceRequest {
  id: number;

  reference_number: string;

  booking: number;

  booking_number: string;

  student: number;

  student_name: string;

  student_email: string;

  property_name: string;

  room_number: string;

  bed_number: string;

  category: MaintenanceCategory;

  category_display: string;

  title: string;

  description: string;

  priority: MaintenancePriority;

  priority_display: string;

  status: MaintenanceStatus;

  status_display: string;

  photo: string | null;

  assigned_to: number | null;

  assigned_to_name: string | null;

  resolution_notes: string;

  submitted_at: string;

  assigned_at: string | null;

  started_at: string | null;

  resolved_at: string | null;

  student_confirmed_at: string | null;

  created_at: string;

  updated_at: string;
}


export async function getStudentMaintenanceRequests(
  applicationId: number
): Promise<MaintenanceRequest[]> {

  const response = await fetch(
    `${API_BASE_URL}/maintenance/application/${applicationId}/`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const data =
    await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data?.message ||
        data?.detail ||
        "Unable to load maintenance requests."
    );
  }

  return data.maintenance_requests;
}


export async function createStudentMaintenanceRequest(
  applicationId: number,
  payload: {
    category: MaintenanceCategory;
    title: string;
    description: string;
    priority: MaintenancePriority;
    photo?: File | null;
  }
): Promise<MaintenanceRequest> {

  await getCSRFToken();

  const csrfToken =
    getCookie("csrftoken");

  const formData =
    new FormData();

  formData.append(
    "category",
    payload.category
  );

  formData.append(
    "title",
    payload.title
  );

  formData.append(
    "description",
    payload.description
  );

  formData.append(
    "priority",
    payload.priority
  );

  if (payload.photo) {
    formData.append(
      "photo",
      payload.photo
    );
  }

  const response =
    await fetch(
      `${API_BASE_URL}/maintenance/application/${applicationId}/`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRFToken":
            csrfToken || "",
        },
        body: formData,
      }
    );

  const data =
    await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data?.message ||
        data?.detail ||
        "Unable to submit maintenance request."
    );
  }

  return data.maintenance_request;
}


export async function getStudentMaintenanceRequest(
  requestId: number
): Promise<MaintenanceRequest> {

  const response =
    await fetch(
      `${API_BASE_URL}/maintenance/${requestId}/`,
      {
        method: "GET",
        credentials: "include",
      }
    );

  const data =
    await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data?.message ||
        data?.detail ||
        "Unable to load maintenance request."
    );
  }

  return data.maintenance_request;
}

// ============================================================
// ADMIN MAINTENANCE
// ============================================================

export interface AdminMaintenanceRequestsResponse {
  success: boolean;
  count: number;
  maintenance_requests: MaintenanceRequest[];
}


export async function getAdminMaintenanceRequests(): Promise<
  AdminMaintenanceRequestsResponse
> {
  const response = await fetch(
    `${API_BASE_URL}/maintenance/admin/`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result?.message ||
        result?.detail ||
        "Unable to load maintenance requests."
    );
  }

  return result;
}


export interface AdminMaintenanceUpdatePayload {
  status?: MaintenanceStatus;
  resolution_notes?: string;
}


export async function updateAdminMaintenanceRequest(
  requestId: number,
  payload: AdminMaintenanceUpdatePayload
): Promise<MaintenanceRequest> {

  await getCSRFToken();

  const csrfToken = getCookie("csrftoken");

  const response = await fetch(
    `${API_BASE_URL}/maintenance/admin/${requestId}/`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken
          ? {
              "X-CSRFToken": csrfToken,
            }
          : {}),
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result?.message ||
        result?.detail ||
        "Unable to update maintenance request."
    );
  }

  return result.maintenance_request;
}

export async function getLandlordMaintenanceRequests(statusFilter = ""): Promise<MaintenanceRequest[]> {
  const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
  const response = await fetch(`${API_BASE_URL}/maintenance/landlord/${query}`, { credentials: "include" });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result?.message || result?.detail || "Unable to load property maintenance requests.");
  return result.maintenance_requests;
}

export async function updateLandlordMaintenanceRequest(requestId: number, payload: { status: MaintenanceStatus; resolution_notes?: string }): Promise<MaintenanceRequest> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/maintenance/landlord/${requestId}/`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken || "" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result?.message || result?.detail || "Unable to update this maintenance request.");
  return result.maintenance_request;
}

export async function confirmStudentMaintenanceRequest(
  requestId: number
): Promise<MaintenanceRequest> {

  await getCSRFToken();

  const csrfToken = getCookie("csrftoken");

  const response = await fetch(
    `${API_BASE_URL}/maintenance/${requestId}/confirm/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken
          ? {
              "X-CSRFToken": csrfToken,
            }
          : {}),
      },
      body: JSON.stringify({}),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result?.message ||
        result?.detail ||
        "Unable to confirm maintenance resolution."
    );
  }

  return result.maintenance_request;
}

// =====================================================
// NOTIFICATIONS
// =====================================================

export interface AccountNotificationPreferences {
  email_application_updates: boolean;
  email_finance_updates: boolean;
  email_accommodation_updates: boolean;
  email_support_updates: boolean;
  email_product_updates: boolean;
  email_verified: boolean;
  delivery_mode: "smtp" | "development_console" | "unconfigured";
}

export async function getAccountNotificationPreferences(): Promise<AccountNotificationPreferences> {
  const response = await fetch(`${API_BASE_URL}/accounts/notification-preferences/`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to load notification preferences.");
  }
  return { ...result.preferences, email_verified: result.email_verified, delivery_mode: result.delivery_mode };
}

export async function updateAccountNotificationPreferences(
  values: Partial<Omit<AccountNotificationPreferences, "email_verified" | "delivery_mode">>,
): Promise<AccountNotificationPreferences> {
  await getCSRFToken();
  const csrfToken = getCookie("csrftoken");
  const response = await fetch(`${API_BASE_URL}/accounts/notification-preferences/`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    body: JSON.stringify(values),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || result?.detail || "Unable to save notification preferences.");
  }
  return { ...result.preferences, email_verified: result.email_verified, delivery_mode: result.delivery_mode };
}

export type NotificationType =
    | "APPLICATION_SUBMITTED"
    | "APPLICATION_RECEIVED"
    | "APPLICATION_UNDER_REVIEW"
    | "APPLICATION_APPROVED"
    | "APPLICATION_REJECTED"
    | "APPLICATION_UPDATED"
    | "ADDITIONAL_INFORMATION"
    | "WAITING_LIST"
    | "ADMIN_FEEDBACK"
    | "LANDLORD_FEEDBACK"
    | "DOCUMENTS_SUBMITTED"
    | "DOCUMENT_VERIFIED"
    | "DOCUMENT_REJECTED"
    | "DOCUMENT_NEEDS_REVIEW"
    | "DOCUMENT_REQUESTED"
    | "CONTRACT_READY"
    | "CONTRACT_SIGNED"
    | "PAYMENT_DUE"
    | "PAYMENT_SUCCESSFUL"
    | "PAYMENT_FAILED"
    | "FUNDING_UPDATED"
    | "BOOKING_CONFIRMED"
    | "BOOKING_TERMINATED"
    | "BOOKING_ROOM_TRANSFERRED"
    | "CHECK_IN_AVAILABLE"
    | "CHECKED_IN"
    | "CHECKED_OUT"
    | "MAINTENANCE_SUBMITTED"
    | "MAINTENANCE_ASSIGNED"
    | "MAINTENANCE_UPDATED"
    | "MAINTENANCE_RESOLVED"
    | "MAINTENANCE_CONFIRMED"
    | "SYSTEM";

export interface StudentNotification {
    id: number;
    notification_type: NotificationType;
    notification_type_display: string;
    title: string;
    message: string;

    actor: number | null;
    actor_name: string | null;

    application: number | null;
    application_number: string | null;

    document: number | null;
    document_type: string | null;

    maintenance_request: number | null;
    maintenance_reference: string | null;

    extra_data: Record<string, unknown>;

    is_read: boolean;
    read_at: string | null;

    created_at: string;
    updated_at: string;
}

export interface NotificationsResponse {
    success: boolean;
    count: number;
    unread_count: number;
    notifications: StudentNotification[];
}

export async function getNotifications(): Promise<NotificationsResponse> {
    const response = await fetch(
        `${API_BASE_URL}/notifications/`,
        {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json",
            },
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result?.detail ||
            result?.message ||
            "Unable to load notifications."
        );
    }

    return result;
}

export async function markNotificationRead(
    notificationId: number
): Promise<StudentNotification> {
    await getCSRFToken();

    const csrfToken = getCookie("csrftoken");

    const response = await fetch(
        `${API_BASE_URL}/notifications/${notificationId}/read/`,
        {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...(csrfToken
                    ? { "X-CSRFToken": csrfToken }
                    : {}),
            },
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result?.detail ||
            result?.message ||
            "Unable to mark notification as read."
        );
    }

    return result.notification;
}

export async function markAllNotificationsRead(): Promise<void> {
    await getCSRFToken();

    const csrfToken = getCookie("csrftoken");

    const response = await fetch(
        `${API_BASE_URL}/notifications/mark-all-read/`,
        {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...(csrfToken
                    ? { "X-CSRFToken": csrfToken }
                    : {}),
            },
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result?.detail ||
            result?.message ||
            "Unable to mark notifications as read."
        );
    }
}
