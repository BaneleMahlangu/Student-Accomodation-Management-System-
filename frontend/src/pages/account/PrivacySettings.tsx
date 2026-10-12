import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStudentPrivacySettings, updateStudentPrivacySettings } from "../../services/api";
import "../../App.css";

export default function PrivacySettings() {
  const [shareContact, setShareContact] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getStudentPrivacySettings()
      .then((settings) => setShareContact(settings.share_contact_with_landlord))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load privacy settings."))
      .finally(() => setLoading(false));
  }, []);

  async function save(value: boolean) {
    setSaving(true); setError(""); setNotice("");
    try {
      const settings = await updateStudentPrivacySettings(value);
      setShareContact(settings.share_contact_with_landlord);
      setNotice("Your privacy preference has been saved.");
    } catch (caught) { setShareContact(!value); setError(caught instanceof Error ? caught.message : "Unable to save this preference."); }
    finally { setSaving(false); }
  }

  return <main className="profile-page"><section className="profile-header"><div><p className="profile-eyebrow">STUDENTHAVEN ACCOUNT</p><h1>Privacy settings</h1><p>Choose what contact information is shared with the landlord for your active accommodation.</p><Link className="profile-security-link" to="/student/profile">Back to profile</Link></div></section><section className="profile-card privacy-settings-card">{error && <div className="profile-message profile-error" role="alert">{error}</div>}{notice && <div className="profile-message profile-success" role="status">{notice}</div>}{loading ? <p role="status">Loading privacy preferences…</p> : <><label className="privacy-toggle"><span><strong>Share my email address and phone number with my property landlord</strong><small>This applies to landlords of your active bookings. StudentHaven administrators retain the access needed to support and protect your account. You can still contact landlords through in-app messages when this is turned off.</small></span><input type="checkbox" checked={shareContact} disabled={saving} onChange={(event) => void save(event.target.checked)} /></label><p className="analytics-generated">Turning this off removes your email and phone from the landlord tenant and booking register. Your name and accommodation details remain visible for booking operations.</p></>}</section></main>;
}
