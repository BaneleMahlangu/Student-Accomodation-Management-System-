import AdminNavigation from "../../components/AdminNavigation";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "../../App.css";
import { deleteAdminAccount, getAdminDirectory, getCurrentUser, updateAdminAccountStatus } from "../../services/api";
import type { AdminDirectoryKind, AdminDirectoryUser, CurrentUser } from "../../services/api";

type StatusPayload = { is_active?: boolean; is_verified?: boolean; verification_status?: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED" };

function Directory({ kind }: { kind: AdminDirectoryKind }) {
  const [searchParams] = useSearchParams();
  const routeSearch = searchParams.get("search") ?? "";
  const [admin, setAdmin] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<AdminDirectoryUser[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState(routeSearch);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<AdminDirectoryUser | null>(null);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<{ user: AdminDirectoryUser; payload: StatusPayload; title: string; detail: string } | null>(null);

  const isLandlord = kind === "landlords";
  const title = isLandlord ? "Landlord management" : "Student management";
  const selectedUser = useMemo(() => users.find((user) => user.id === selectedId) ?? users[0] ?? null, [users, selectedId]);

  useEffect(() => {
    getCurrentUser().then(setAdmin).catch(() => setAdmin(null));
  }, []);

  useEffect(() => { setSearch(routeSearch); }, [kind, routeSearch]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const result = await getAdminDirectory(kind, search, statusFilter);
        if (!active) return;
        setUsers(result);
        if (!result.some((user) => user.id === selectedId)) setSelectedId(result[0]?.id ?? null);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load this account directory.");
      } finally {
        if (active) setLoading(false);
      }
    }, 160);
    return () => { active = false; window.clearTimeout(timer); };
  }, [kind, search, statusFilter]);

  async function confirmChange() {
    if (!confirmation) return;
    setSaving(true); setSavingId(confirmation.user.id); setError(""); setNotice("");
    try {
      await updateAdminAccountStatus(kind, confirmation.user.id, confirmation.payload);
      setNotice(`${confirmation.user.full_name}’s account record was updated.`);
      setConfirmation(null);
      const refreshed = await getAdminDirectory(kind, search, statusFilter);
      setUsers(refreshed);
      if (!refreshed.some((user) => user.id === selectedId)) setSelectedId(refreshed[0]?.id ?? null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update this account."); }
    finally { setSaving(false); setSavingId(null); }
  }

  async function confirmDelete() {
    if (!deleteConfirmation || deleteEmail.trim().toLowerCase() !== deleteConfirmation.email.toLowerCase()) return;
    setDeleting(true); setError(""); setNotice("");
    const deletedUser = deleteConfirmation;
    try {
      await deleteAdminAccount(kind, deletedUser.id, deleteEmail.trim());
      setNotice(`${deletedUser.full_name}’s account and removable data were permanently deleted.`);
      setDeleteConfirmation(null);
      setDeleteEmail("");
      setUsers((current) => current.filter((user) => user.id !== deletedUser.id));
      setSelectedId((current) => current === deletedUser.id ? null : current);
      try {
        const refreshed = await getAdminDirectory(kind, search, statusFilter);
        setUsers(refreshed);
        setSelectedId((current) => current && refreshed.some((user) => user.id === current) ? current : refreshed[0]?.id ?? null);
      } catch {
        setError("The account was deleted, but the directory could not be refreshed.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to permanently delete this account.");
    } finally { setDeleting(false); }
  }

  function askToChange(user: AdminDirectoryUser, payload: StatusPayload, heading: string, detail: string) {
    setConfirmation({ user, payload, title: heading, detail });
  }

  const verifiedCount = users.filter((user) => isLandlord ? user.profile?.verification_status === "VERIFIED" : user.is_verified).length;
  const pendingCount = users.filter((user) => isLandlord ? user.profile?.verification_status === "PENDING" : !user.is_verified).length;
  const activeCount = users.filter((user) => user.is_active).length;

  return <div className="admin-dashboard-page admin-directory-page">
    <header className="admin-header">
      <Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link>
      <div className="admin-header-title">{title}</div>
    </header>
    <div className="admin-layout">
      <AdminNavigation />
      <main className="admin-content admin-directory-content">
        <section className="admin-welcome admin-directory-title"><div><span className="eyebrow">PLATFORM ACCOUNTS</span><h1>{title}</h1><p>{isLandlord ? "Review landlord details and verify businesses before property listings can be submitted." : "Search student records and manage account verification and access."}</p></div>{admin && <span className="admin-directory-reviewer">Administrator · {admin.first_name} {admin.last_name}</span>}</section>

        <section className="admin-directory-metrics">
          <div><span>Matching accounts</span><strong>{loading ? "—" : users.length}</strong><small>Current search and filters</small></div>
          <div><span>{isLandlord ? "Verified landlords" : "Verified students"}</span><strong>{loading ? "—" : verifiedCount}</strong><small>Eligible for platform workflows</small></div>
          <div><span>{isLandlord ? "Awaiting verification" : "Not verified"}</span><strong>{loading ? "—" : pendingCount}</strong><small>Needs administrator review</small></div>
          <div><span>Active accounts</span><strong>{loading ? "—" : activeCount}</strong><small>Can sign in to StudentHaven</small></div>
        </section>

        {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
        {notice && <div className="property-alert property-alert-success" role="status">{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}

        <div className="admin-directory-grid">
          <section className="admin-directory-list-panel">
            <div className="admin-directory-filters"><label>Search accounts<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isLandlord ? "Name, email or business" : "Name, email or student number"} /></label>
              <label>Verification<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{isLandlord ? <><option value="">All statuses</option><option value="PENDING">Pending</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option><option value="SUSPENDED">Suspended</option></> : <><option value="">All students</option><option value="false">Not verified</option><option value="true">Verified</option></>}</select></label>
            </div>
            <div className="admin-directory-list-heading"><div><span className="eyebrow">DIRECTORY</span><h2>{isLandlord ? "Landlord accounts" : "Student accounts"}</h2></div><span>{users.length}</span></div>
            {loading ? <div className="property-empty-state">Loading accounts…</div> : users.length === 0 ? <div className="property-empty-state"><h3>No matching accounts</h3><p>Try clearing a filter or searching with a different term.</p><button className="dashboard-secondary-action" onClick={() => { setSearch(""); setStatusFilter(""); }}>Clear filters</button></div> : <div className="admin-directory-records">{users.map((user) => {
              const verification = isLandlord ? user.profile?.verification_status ?? "PENDING" : user.is_verified ? "VERIFIED" : "UNVERIFIED";
              return <button key={user.id} className={`admin-directory-record ${selectedUser?.id === user.id ? "selected" : ""}`} onClick={() => setSelectedId(user.id)}>
                <span className="admin-directory-avatar">{user.first_name.charAt(0)}{user.last_name.charAt(0)}</span><span className="admin-directory-record-main"><strong>{user.full_name}</strong><small>{isLandlord ? user.profile?.business_name || "Business name not provided" : user.profile?.student_number || "Student number not provided"}</small><small>{user.email}</small></span><span className={`property-status-pill property-status-${verification.toLowerCase()}`}>{verification}</span>
              </button>;
            })}</div>}
          </section>

          {selectedUser && <section className="admin-directory-detail">
            <div className="admin-directory-detail-heading"><div><span className="eyebrow">ACCOUNT DETAILS</span><h2>{selectedUser.full_name}</h2><p>{selectedUser.email}</p></div><span className={`property-status-pill ${selectedUser.is_active ? "property-status-approved" : "property-status-suspended"}`}>{selectedUser.is_active ? "ACTIVE" : "INACTIVE"}</span></div>
            <div className="admin-directory-facts"><div><span>Mobile</span><strong>{selectedUser.mobile || "Not provided"}</strong></div><div><span>Joined</span><strong>{new Date(selectedUser.created_at).toLocaleDateString()}</strong></div>
              {isLandlord ? <><div><span>Business name</span><strong>{selectedUser.profile?.business_name || "Not provided"}</strong></div><div><span>Registration number</span><strong>{selectedUser.profile?.registration_number || "Not provided"}</strong></div><div><span>Business phone</span><strong>{selectedUser.profile?.phone || "Not provided"}</strong></div><div><span>Business address</span><strong>{selectedUser.profile?.address || "Not provided"}</strong></div><div><span>Landlord verification</span><strong>{selectedUser.profile?.verification_status || "PENDING"}</strong></div><div><span>Profile completed</span><strong>{selectedUser.profile?.profile_completed ? "Yes" : "No"}</strong></div></> : <><div><span>Student number</span><strong>{selectedUser.profile?.student_number || "Not provided"}</strong></div><div><span>University</span><strong>{selectedUser.profile?.university || "Not provided"}</strong></div><div><span>Campus</span><strong>{selectedUser.profile?.campus || "Not provided"}</strong></div><div><span>Programme</span><strong>{selectedUser.profile?.course || "Not provided"}</strong></div><div><span>Year of study</span><strong>{selectedUser.profile?.year_of_study ?? "Not provided"}</strong></div><div><span>Email/account verification</span><strong>{selectedUser.is_verified ? "Verified" : "Not verified"}</strong></div></>}
            </div>
            <section className="admin-directory-actions"><span className="eyebrow">ADMIN ACTIONS</span>
              {isLandlord ? <div className="admin-directory-action-buttons">
                {selectedUser.profile?.verification_status !== "VERIFIED" && <button className="dashboard-primary-action" disabled={saving && savingId === selectedUser.id} onClick={() => askToChange(selectedUser, { verification_status: "VERIFIED" }, "Verify this landlord?", "A verified landlord can submit property listings for administrator approval.")}>Verify landlord</button>}
                {selectedUser.profile?.verification_status !== "REJECTED" && <button className="admin-directory-secondary-button" onClick={() => askToChange(selectedUser, { verification_status: "REJECTED" }, "Reject this landlord registration?", "The landlord will not be able to submit property listings until the account is reviewed again.")}>Reject registration</button>}
                {selectedUser.profile?.verification_status !== "SUSPENDED" && <button className="admin-directory-danger-button" onClick={() => askToChange(selectedUser, { verification_status: "SUSPENDED" }, "Suspend this landlord?", "Suspended landlords cannot submit properties for approval.")}>Suspend</button>}
                {selectedUser.profile?.verification_status === "SUSPENDED" && <button className="dashboard-secondary-action" onClick={() => askToChange(selectedUser, { verification_status: "PENDING" }, "Return this landlord to review?", "Their verification returns to the pending queue.")}>Return to pending</button>}
              </div> : <div className="admin-directory-action-buttons">
                <button className="dashboard-primary-action" disabled={selectedUser.is_verified} onClick={() => askToChange(selectedUser, { is_verified: true }, "Verify this student account?", "This marks the student account as verified for platform workflows.")}>Verify student</button>
                {selectedUser.is_verified && <button className="admin-directory-secondary-button" onClick={() => askToChange(selectedUser, { is_verified: false }, "Remove student verification?", "The student account returns to an unverified state.")}>Mark unverified</button>}
              </div>}
              <button className={selectedUser.is_active ? "admin-directory-danger-button" : "admin-directory-secondary-button"} onClick={() => askToChange(selectedUser, { is_active: !selectedUser.is_active }, selectedUser.is_active ? "Deactivate this account?" : "Reactivate this account?", selectedUser.is_active ? "The account will no longer be able to sign in." : "The account will be able to sign in again.")}>{selectedUser.is_active ? "Deactivate account" : "Reactivate account"}</button>
              <button className="admin-directory-danger-button" onClick={() => { setError(""); setDeleteEmail(""); setDeleteConfirmation(selectedUser); }}>Permanently delete account</button>
            </section>
          </section>}
        </div>
      </main>
    </div>
    {confirmation && <div className="property-modal-backdrop" role="presentation"><section className="property-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="admin-action-title"><span className="eyebrow">CONFIRM ADMIN ACTION</span><h2 id="admin-action-title">{confirmation.title}</h2><p>{confirmation.detail}</p><div><button className="admin-directory-secondary-button" onClick={() => setConfirmation(null)} disabled={saving}>Cancel</button><button className="dashboard-primary-action" onClick={() => void confirmChange()} disabled={saving}>{saving ? "Saving…" : "Confirm"}</button></div></section></div>}
    {deleteConfirmation && <div className="property-modal-backdrop" role="presentation"><section className="property-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title"><span className="eyebrow">PERMANENT ACCOUNT DELETION</span><h2 id="delete-account-title">Delete {deleteConfirmation.full_name}?</h2><p>This permanently removes the account, profile, sign-in sessions, login history, and other removable account data. This cannot be undone. Accounts with protected application, housing, support, or payment history must be deactivated instead so those records remain intact.</p>{error && <div className="property-alert property-alert-error" role="alert">{error}</div>}<label className="admin-directory-delete-confirmation">Type the account email to confirm: <strong>{deleteConfirmation.email}</strong><input autoFocus type="email" value={deleteEmail} onChange={(event) => setDeleteEmail(event.target.value)} autoComplete="off" /></label><div><button className="admin-directory-secondary-button" onClick={() => { setDeleteConfirmation(null); setDeleteEmail(""); }} disabled={deleting}>Cancel</button><button className="admin-directory-danger-button" onClick={() => void confirmDelete()} disabled={deleting || deleteEmail.trim().toLowerCase() !== deleteConfirmation.email.toLowerCase()}>{deleting ? "Deleting…" : "Delete permanently"}</button></div></section></div>}
  </div>;
}

export default Directory;
