import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { confirmAccountEmailChange, confirmTwoFactorSetup, disableTwoFactor, getAccountSecurityHistory, getCurrentUser, getTwoFactorSettings, requestAccountEmailChange, requestTwoFactorSetupCode, revokeAccountSession, revokeOtherAccountSessions } from "../../services/api";
import type { AccountSecurityHistory, TwoFactorSettings } from "../../services/api";
import { getDashboardPath } from "../../utils/navigation";
import "../../App.css";

function SecuritySettings() {
  const [settings, setSettings] = useState<TwoFactorSettings | null>(null);
  const [securityHistory, setSecurityHistory] = useState<AccountSecurityHistory | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [dashboardPath, setDashboardPath] = useState("/login");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [twoFactor, history, currentUser] = await Promise.all([getTwoFactorSettings(), getAccountSecurityHistory(), getCurrentUser()]);
      setSettings(twoFactor);
      setSecurityHistory(history);
      setEmail(currentUser.email);
      setDashboardPath(getDashboardPath(currentUser.role));
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load security settings."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function requestCode() {
    setSaving(true); setError(""); setNotice("");
    try { setNotice(await requestTwoFactorSetupCode()); setCodeRequested(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send a security code."); }
    finally { setSaving(false); }
  }

  async function enable() {
    setSaving(true); setError(""); setNotice("");
    try {
      setNotice(await confirmTwoFactorSetup(code));
      setCode(""); setCodeRequested(false);
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to enable two-factor authentication."); }
    finally { setSaving(false); }
  }

  async function disable() {
    setSaving(true); setError(""); setNotice("");
    try {
      setNotice(await disableTwoFactor(password));
      setPassword("");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to disable two-factor authentication."); }
    finally { setSaving(false); }
  }

  async function revokeSession(sessionId: number) {
    setRevokingId(sessionId); setError(""); setNotice("");
    try { setNotice(await revokeAccountSession(sessionId)); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to sign out this device."); }
    finally { setRevokingId(null); }
  }

  async function revokeOthers() {
    if (!window.confirm("Sign out every other active StudentHaven session? This device will stay signed in.")) return;
    setSaving(true); setError(""); setNotice("");
    try { setNotice(await revokeOtherAccountSessions()); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to sign out other devices."); }
    finally { setSaving(false); }
  }

  async function requestEmailChange() {
    setEmailSaving(true); setEmailError(""); setEmailMessage("");
    try {
      const result = await requestAccountEmailChange(newEmail.trim(), emailPassword);
      setPendingEmail(result.pending_email || newEmail.trim());
      setEmailMessage(result.message);
    } catch (caught) { setEmailError(caught instanceof Error ? caught.message : "Unable to send an email-change code."); }
    finally { setEmailSaving(false); }
  }

  async function confirmEmailChange() {
    setEmailSaving(true); setEmailError(""); setEmailMessage("");
    try {
      const result = await confirmAccountEmailChange(emailCode);
      if (result.email) setEmail(result.email);
      setPendingEmail(""); setNewEmail(""); setEmailCode(""); setEmailPassword("");
      setEmailMessage(result.message);
      await load();
    } catch (caught) { setEmailError(caught instanceof Error ? caught.message : "Unable to verify the new email address."); }
    finally { setEmailSaving(false); }
  }

  return <main className="security-settings-page">
    <header><Link to={dashboardPath} className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Account security</span></div></Link><nav className="account-security-nav"><Link aria-current="page" to="/account/security">Security</Link><Link to="/account/notifications">Notifications</Link></nav></header>
    <section className="security-settings-card"><span className="eyebrow">ACCOUNT SECURITY</span><h1>Two-factor authentication</h1><p>Add an email security code to sign-ins after your password.</p>
      <section className="security-history-section"><div className="security-section-heading"><div><span className="eyebrow">SIGN-IN EMAIL</span><h2>Change email address</h2><p>Current email: <strong>{email || "Loading…"}</strong>. We will keep using it until you confirm access to the new address.</p></div></div>
        {emailError && <div className="property-alert property-alert-error" role="alert">{emailError}</div>}
        {emailMessage && <div className="property-alert property-alert-success" role="status">{emailMessage}</div>}
        {!pendingEmail ? <form className="security-settings-form" onSubmit={(event) => { event.preventDefault(); void requestEmailChange(); }}><label htmlFor="new-sign-in-email">New email address</label><input id="new-sign-in-email" type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required /><label htmlFor="email-change-password">Current password</label><input id="email-change-password" type="password" autoComplete="current-password" value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} required /><button className="dashboard-primary-action" disabled={emailSaving || loading}>{emailSaving ? "Sending code…" : "Send verification code"}</button></form> : <form className="security-settings-form" onSubmit={(event) => { event.preventDefault(); void confirmEmailChange(); }}><p>We sent a six-digit code to <strong>{pendingEmail}</strong>. It expires in 15 minutes.</p><label htmlFor="email-change-code">Confirmation code</label><input id="email-change-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required /><button className="dashboard-primary-action" disabled={emailSaving || emailCode.length !== 6}>{emailSaving ? "Verifying…" : "Confirm new email"}</button><button type="button" className="security-text-action" disabled={emailSaving} onClick={() => void requestEmailChange()}>Send another code</button><button type="button" className="security-text-action" disabled={emailSaving} onClick={() => { setPendingEmail(""); setEmailCode(""); setEmailMessage(""); setEmailError(""); }}>Use a different email address</button></form>}
      </section>
      {error && <div className="property-alert property-alert-error" role="alert">{error}</div>}
      {notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}
      {loading ? <div className="property-empty-state">Loading your security settings…</div> : settings?.enabled ? <>
        <div className="security-enabled-state"><span aria-hidden="true">✓</span><div><strong>Email verification is enabled for sign-in</strong><p>New sign-ins require a one-time code sent to {" "}{settings.email_verified ? "your verified email address" : "your account email address"}. Codes expire after 15 minutes.</p></div></div>
        <form className="security-settings-form" onSubmit={(event) => { event.preventDefault(); void disable(); }}><label htmlFor="current-password">Current password to disable</label><input id="current-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button className="security-secondary-action" disabled={saving}>{saving ? "Updating…" : "Turn off two-factor authentication"}</button></form>
      </> : <>
        {!settings?.email_verified && <div className="risk-review-notice"><strong>Verify your email first.</strong><span>Two-factor sign-in codes are delivered by email, so the address needs to be verified.</span><Link to="/verify-email">Verify email address</Link></div>}
        {!codeRequested ? <button className="dashboard-primary-action" disabled={saving || !settings?.email_verified} onClick={() => void requestCode()}>{saving ? "Sending code…" : "Email me a setup code"}</button> : <form className="security-settings-form" onSubmit={(event) => { event.preventDefault(); void enable(); }}><label htmlFor="setup-code">Six-digit setup code</label><input id="setup-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required /><p>The code expires in 15 minutes. Five incorrect attempts require a new code.</p><button className="dashboard-primary-action" disabled={saving || code.length !== 6}>{saving ? "Verifying…" : "Enable two-factor authentication"}</button><button type="button" className="security-text-action" disabled={saving} onClick={() => void requestCode()}>Send another code</button></form>}
      </>}
      {!loading && <>
        <section className="security-history-section"><div className="security-section-heading"><div><span className="eyebrow">ACTIVE ACCESS</span><h2>Your signed-in devices</h2><p>End sessions you no longer recognize. This device cannot be ended from this list.</p></div>{(securityHistory?.sessions.length || 0) > 1 && <button className="security-secondary-action" disabled={saving} onClick={() => void revokeOthers()}>{saving ? "Signing out…" : "Sign out other devices"}</button>}</div>
          {!securityHistory || securityHistory.sessions.length === 0 ? <div className="property-empty-state"><p>No active sessions are recorded. Sign in again to register this device.</p></div> : <div className="security-session-list">{securityHistory.sessions.map((session) => <article className="security-session-card" key={session.id}><div><strong>{session.is_current ? "This device" : "Signed-in device"}</strong><p>{session.user_agent || "Device details unavailable"}</p><small>{session.ip_address || "IP address unavailable"} · Last active {new Date(session.last_seen_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}</small><small>Session expires {new Date(session.expires_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}</small></div>{session.is_current ? <span className="security-current-device">Current</span> : <button className="security-text-action" disabled={revokingId === session.id} onClick={() => void revokeSession(session.id)}>{revokingId === session.id ? "Signing out…" : "Sign out device"}</button>}</article>)}</div>}
        </section>
        <section className="security-history-section"><div className="security-section-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Sign-in history</h2><p>Recent successful sign-ins and security-code challenges for this account.</p></div></div>
          {!securityHistory || securityHistory.login_events.length === 0 ? <div className="property-empty-state"><p>No sign-in history is available yet.</p></div> : <div className="security-login-history-list">{securityHistory.login_events.map((event) => <article className="security-login-event" key={event.id}><div><strong>{event.outcome}</strong><span>{event.method} · {event.ip_address || "IP unavailable"}</span>{event.failure_reason && <small>{event.failure_reason}</small>}</div><time>{new Date(event.created_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}</time></article>)}</div>}
        </section>
      </>}
      <Link className="security-back-link" to={dashboardPath}>Back to dashboard</Link>
    </section>
  </main>;
}

export default SecuritySettings;
