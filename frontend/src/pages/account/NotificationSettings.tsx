import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAccountNotificationPreferences,
  getCurrentUser,
  updateAccountNotificationPreferences,
} from "../../services/api";
import type { AccountNotificationPreferences, CurrentUser } from "../../services/api";
import { getDashboardPath } from "../../utils/navigation";
import "../../App.css";

const categories: Array<{
  key: keyof Pick<AccountNotificationPreferences,
    "email_application_updates" | "email_finance_updates" | "email_accommodation_updates" | "email_support_updates" | "email_product_updates">;
  title: string;
  description: string;
}> = [
  { key: "email_application_updates", title: "Applications and documents", description: "Application progress, decisions, document requests and review updates." },
  { key: "email_finance_updates", title: "Funding and contracts", description: "Contract availability, signatures, funding changes, payment reminders and recorded transactions." },
  { key: "email_accommodation_updates", title: "Accommodation and check-in", description: "Booking changes, room offers, waiting-list updates and check-in or check-out information." },
  { key: "email_support_updates", title: "Maintenance and support", description: "Maintenance progress, resolution updates and support-case responses." },
  { key: "email_product_updates", title: "Platform announcements", description: "Optional StudentHaven service news and product updates." },
];

export default function NotificationSettings() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [preferences, setPreferences] = useState<AccountNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getCurrentUser(), getAccountNotificationPreferences()])
      .then(([currentUser, saved]) => {
        if (!active) return;
        setUser(currentUser);
        setPreferences(saved);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load notification settings.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save() {
    if (!preferences) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await updateAccountNotificationPreferences({
        email_application_updates: preferences.email_application_updates,
        email_finance_updates: preferences.email_finance_updates,
        email_accommodation_updates: preferences.email_accommodation_updates,
        email_support_updates: preferences.email_support_updates,
        email_product_updates: preferences.email_product_updates,
      });
      setPreferences(saved);
      setNotice("Your email notification preferences have been saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save notification settings.");
    } finally {
      setSaving(false);
    }
  }

  const dashboard = getDashboardPath(user?.role);

  return (
    <main className="account-notification-page">
      <header className="account-notification-header">
        <Link to={dashboard} className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Account settings</span></div></Link>
        <nav aria-label="Account settings"><Link to="/account/security">Security</Link><Link aria-current="page" to="/account/notifications">Notifications</Link></nav>
      </header>
      <section className="account-notification-card" aria-labelledby="notification-settings-title">
        <span className="section-eyebrow">YOUR ACCOUNT</span>
        <h1 id="notification-settings-title">Email notification preferences</h1>
        <p>Choose which StudentHaven updates we send by email. Important sign-in, verification and password-recovery messages remain on for account safety.</p>
        {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => window.location.reload()}>Retry</button></div>}
        {notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}
        {loading || !preferences ? <div className="property-empty-state" role="status">Loading your preferences…</div> : <>
          {!preferences.email_verified && <div className="risk-review-notice"><strong>Verify your email address to receive updates.</strong><span>You can set your preferences now. Email notifications will be sent after this account’s email is verified.</span><Link to="/verify-email">Verify email address</Link></div>}
          {preferences.delivery_mode === "development_console" && <div className="risk-review-notice"><strong>Development email mode is active.</strong><span>Messages are printed in the backend terminal during local development and are not delivered to an external mailbox.</span></div>}
          {preferences.delivery_mode === "unconfigured" && <div className="risk-review-notice"><strong>Email delivery is not configured.</strong><span>Your choices are saved, but a mail service must be configured on this installation before notifications can reach your inbox.</span></div>}
          <div className="account-notification-options">{categories.map((category) => <label className="account-notification-option" key={category.key}>
            <span><strong>{category.title}</strong><small>{category.description}</small></span>
            <input type="checkbox" checked={preferences[category.key]} onChange={(event) => setPreferences({ ...preferences, [category.key]: event.target.checked })} aria-label={`Email me about ${category.title.toLowerCase()}`} />
          </label>)}</div>
          <div className="account-notification-note"><strong>In-app alerts stay on</strong><p>Application status, document decisions, booking changes and support updates remain in your StudentHaven notification centre. These preferences only control optional email copies.</p></div>
          <div className="account-notification-actions"><button className="dashboard-primary-action" onClick={() => void save()} disabled={saving}>{saving ? "Saving preferences…" : "Save preferences"}</button><Link className="dashboard-secondary-action" to="/account/security">Review account security</Link></div>
        </>}
      </section>
    </main>
  );
}
