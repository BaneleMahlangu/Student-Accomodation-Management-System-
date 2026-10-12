import AdminNavigation from "../../components/AdminNavigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  createAdminAnnouncement,
  getAdminAnnouncements,
  getAdminPlatformReadiness,
  getAdminPlatformConfiguration,
  updateAdminAnnouncement,
  updateAdminPlatformConfiguration,
} from "../../services/api";
import type { PlatformAnnouncement, PlatformConfiguration, PlatformReadinessCheck } from "../../services/api";
import "../../App.css";

type ConfigurationDraft = Omit<PlatformConfiguration, "id" | "updated_at">;
type AnnouncementDraft = { title: string; body: string; audience: PlatformAnnouncement["audience"]; starts_at: string; ends_at: string; is_active: boolean };

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

const initialAnnouncement: AnnouncementDraft = { title: "", body: "", audience: "ALL", starts_at: toLocalInput(new Date().toISOString()), ends_at: "", is_active: true };

export default function AdminSystemSettings() {
  const [configuration, setConfiguration] = useState<ConfigurationDraft>({
    application_period_name: "Current accommodation intake", applications_open: true,
    application_opens_at: null, application_closes_at: null,
    closed_message: "Applications are temporarily closed. Please check back later.", support_email: "",
  });
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [readiness, setReadiness] = useState<{ checks: PlatformReadinessCheck[]; action_required: number; launch_ready: boolean } | null>(null);
  const [draft, setDraft] = useState<AnnouncementDraft>(initialAnnouncement);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [settings, items, readinessResult] = await Promise.all([
        getAdminPlatformConfiguration(),
        getAdminAnnouncements(),
        getAdminPlatformReadiness().catch(() => null),
      ]);
      setReadiness(readinessResult);
      setConfiguration({
        application_period_name: settings.application_period_name,
        applications_open: settings.applications_open,
        application_opens_at: toLocalInput(settings.application_opens_at),
        application_closes_at: toLocalInput(settings.application_closes_at),
        closed_message: settings.closed_message,
        support_email: settings.support_email,
      });
      setAnnouncements(items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load platform settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setSavingSettings(true);
    setError("");
    setNotice("");
    try {
      const result = await updateAdminPlatformConfiguration({
        ...configuration,
        application_opens_at: toIso(configuration.application_opens_at || ""),
        application_closes_at: toIso(configuration.application_closes_at || ""),
      });
      setNotice(result.landlords_notified > 0
        ? `Application period settings saved. Notified ${result.landlords_notified} landlord${result.landlords_notified === 1 ? "" : "s"}.`
        : "Application period settings saved; no landlord notification was needed.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save platform settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  function editAnnouncement(item: PlatformAnnouncement) {
    setEditingId(item.id);
    setDraft({ title: item.title, body: item.body, audience: item.audience, starts_at: toLocalInput(item.starts_at), ends_at: toLocalInput(item.ends_at), is_active: item.is_active });
  }

  function resetAnnouncement() {
    setEditingId(null);
    setDraft({ ...initialAnnouncement, starts_at: toLocalInput(new Date().toISOString()) });
  }

  async function saveAnnouncement(event: FormEvent) {
    event.preventDefault();
    setSavingAnnouncement(true);
    setError("");
    setNotice("");
    try {
      const payload = { ...draft, starts_at: toIso(draft.starts_at) as string, ends_at: toIso(draft.ends_at), is_active: draft.is_active };
      const result = editingId ? await updateAdminAnnouncement(editingId, payload) : await createAdminAnnouncement(payload);
      setNotice(`Announcement ${editingId ? "updated" : "scheduled"}: ${result.announcement.title}.${result.landlords_notified > 0 ? ` Notified ${result.landlords_notified} landlord${result.landlords_notified === 1 ? "" : "s"}.` : " No landlord notifications were sent."}`);
      resetAnnouncement();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this announcement.");
    } finally {
      setSavingAnnouncement(false);
    }
  }

  async function toggleAnnouncement(item: PlatformAnnouncement) {
    setError("");
    setNotice("");
    try {
      const result = await updateAdminAnnouncement(item.id, { is_active: !item.is_active });
      setNotice(`${item.title} ${item.is_active ? "paused" : "activated"}.${result.landlords_notified > 0 ? ` Notified ${result.landlords_notified} landlord${result.landlords_notified === 1 ? "" : "s"}.` : " No landlord notifications were sent."}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update this announcement.");
    }
  }

  return <div className="admin-dashboard-page admin-operations-page">
    <header className="admin-header"><Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link><div className="admin-header-title">System settings</div></header>
    <div className="admin-layout">
      <AdminNavigation />
      <main className="admin-content system-settings-content">
        <section className="admin-welcome"><div><span className="eyebrow">PLATFORM CONTROL</span><h1>System settings</h1><p>Manage the accommodation application window and schedule clear updates for each user group.</p></div></section>
        {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}
        {notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}
        {loading ? <div className="property-empty-state">Loading platform settings…</div> : <>
          <section className="sponsorship-admin-panel platform-readiness-panel"><div className="sponsorship-section-heading"><div><span className="eyebrow">LAUNCH READINESS</span><h2>{readiness?.launch_ready ? "Required setup complete" : "Production setup checklist"}</h2></div><span className={`admin-program-state ${readiness?.launch_ready ? "is-active" : ""}`}>{readiness ? `${readiness.action_required} action${readiness.action_required === 1 ? "" : "s"} required` : "Status unavailable"}</span></div><p className="system-settings-help">These checks report configuration state only. They do not validate institutional approvals, verify property claims, or replace a production security review.</p>
            {!readiness ? <div className="property-empty-state">Readiness checks could not be loaded. Check the backend connection and retry.</div> : <div className="platform-readiness-grid">{readiness.checks.map((check) => <article className={`platform-readiness-item readiness-${check.status.toLowerCase()}`} key={check.id}><div><strong>{check.label}</strong><span className="platform-readiness-status">{check.status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())}</span></div><p>{check.detail}</p></article>)}</div>}
            <button type="button" className="dashboard-secondary-action" onClick={() => void load()}>Refresh checks</button>
          </section>
          <section className="sponsorship-admin-panel"><div className="sponsorship-section-heading"><div><span className="eyebrow">APPLICATION PERIOD</span><h2>Submission controls</h2></div><span className={`admin-program-state ${configuration.applications_open ? "is-active" : ""}`}>{configuration.applications_open ? "Enabled" : "Paused"}</span></div>
            <p className="system-settings-help">When these settings change, active landlords receive an in-app notification. Optional update emails follow each landlord’s notification preferences.</p>
            <form className="sponsorship-program-form" onSubmit={(event) => void saveSettings(event)}>
              <label className="sponsorship-form-wide">Period name<input required maxLength={160} value={configuration.application_period_name} onChange={(event) => setConfiguration({ ...configuration, application_period_name: event.target.value })} /></label>
              <label>Applications open from<input type="datetime-local" value={configuration.application_opens_at || ""} onChange={(event) => setConfiguration({ ...configuration, application_opens_at: event.target.value || null })} /></label>
              <label>Applications close at<input type="datetime-local" value={configuration.application_closes_at || ""} onChange={(event) => setConfiguration({ ...configuration, application_closes_at: event.target.value || null })} /></label>
              <label className="property-checkbox"><input type="checkbox" checked={configuration.applications_open} onChange={(event) => setConfiguration({ ...configuration, applications_open: event.target.checked })} />Allow students to submit accommodation applications</label>
              <label>Support email<input type="email" maxLength={254} value={configuration.support_email} onChange={(event) => setConfiguration({ ...configuration, support_email: event.target.value })} /></label>
              <label className="sponsorship-form-wide">Message shown while applications are closed<textarea required rows={2} maxLength={300} value={configuration.closed_message} onChange={(event) => setConfiguration({ ...configuration, closed_message: event.target.value })} /></label>
              <p className="system-settings-help sponsorship-form-wide">Students can keep and edit drafts while submissions are paused. The closing and opening times are enforced when they submit.</p>
              <button className="dashboard-primary-action" disabled={savingSettings}>{savingSettings ? "Saving…" : "Save application settings"}</button>
            </form>
          </section>

          <section className="sponsorship-admin-panel"><div className="sponsorship-section-heading"><div><span className="eyebrow">PLATFORM ANNOUNCEMENTS</span><h2>{editingId ? "Edit announcement" : "Schedule an update"}</h2></div>{editingId && <button className="dashboard-secondary-action" onClick={resetAnnouncement}>Cancel edit</button>}</div>
            <p className="system-settings-help">Active updates for Landlords or Everyone are also sent to active landlords’ notification inboxes. Optional update emails follow each landlord’s notification preferences.</p>
            <form className="sponsorship-program-form" onSubmit={(event) => void saveAnnouncement(event)}>
              <label>Title<input required maxLength={180} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
              <label>Audience<select value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value as PlatformAnnouncement["audience"] })}><option value="ALL">Everyone</option><option value="STUDENT">Students</option><option value="LANDLORD">Landlords</option><option value="ADMINISTRATOR">Administrators</option></select></label>
              <label>Show from<input type="datetime-local" required value={draft.starts_at} onChange={(event) => setDraft({ ...draft, starts_at: event.target.value })} /></label>
              <label>Hide after (optional)<input type="datetime-local" value={draft.ends_at} onChange={(event) => setDraft({ ...draft, ends_at: event.target.value })} /></label>
              <label className="sponsorship-form-wide">Message<textarea required rows={3} maxLength={3000} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label>
              <label className="property-checkbox"><input type="checkbox" checked={draft.is_active} onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })} />Announcement is active</label>
              <button className="dashboard-primary-action" disabled={savingAnnouncement}>{savingAnnouncement ? "Saving…" : editingId ? "Save announcement" : "Schedule announcement"}</button>
            </form>
            <div className="system-announcement-list">{announcements.length === 0 ? <div className="property-empty-state"><p>No announcements have been scheduled.</p></div> : announcements.map((item) => <article className="system-announcement-item" key={item.id}><div><span className={`admin-program-state ${item.is_active ? "is-active" : ""}`}>{item.is_active ? "Active" : "Paused"}</span><h3>{item.title}</h3><p>{item.audience === "ALL" ? "Everyone" : item.audience.toLowerCase()} · Starts {new Date(item.starts_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}{item.ends_at ? ` · Ends ${new Date(item.ends_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}` : " · No end time"}</p><div>{item.body}</div></div><div><button className="dashboard-secondary-action" onClick={() => editAnnouncement(item)}>Edit</button><button className="dashboard-secondary-action" onClick={() => void toggleAnnouncement(item)}>{item.is_active ? "Pause" : "Activate"}</button></div></article>)}</div>
          </section>
        </>}
      </main>
    </div>
  </div>;
}
