import LandlordNavigation from "../../components/LandlordNavigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { getCurrentUser, updateLandlordProfile } from "../../services/api";
import type { LandlordProfileUpdatePayload } from "../../services/api";
import "../../App.css";

const emptyProfile: LandlordProfileUpdatePayload = {
  first_name: "",
  last_name: "",
  mobile: "",
  business_name: "",
  registration_number: "",
  phone: "",
  address: "",
};

export default function LandlordProfile() {
  const [form, setForm] = useState(emptyProfile);
  const [verification, setVerification] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    getCurrentUser().then((user) => {
      if (!active) return;
      const profile = user.landlord_profile;
      setForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        mobile: user.mobile || "",
        business_name: profile?.business_name || "",
        registration_number: profile?.registration_number || "",
        phone: profile?.phone || "",
        address: profile?.address || "",
      });
      setVerification(profile?.verification_status || "PENDING");
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "Unable to load your landlord profile.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function updateField(field: keyof LandlordProfileUpdatePayload, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const user = await updateLandlordProfile({
        ...form,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        mobile: form.mobile.trim(),
        business_name: form.business_name.trim(),
        registration_number: form.registration_number.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });
      setVerification(user.landlord_profile?.verification_status || "PENDING");
      setNotice("Your profile has been saved. Changes to business identity details may require renewed verification.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save your landlord profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="landlord-dashboard-page">
      <header className="landlord-header">
        <Link to="/landlord/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Landlord Portal</span></div></Link>
        <div className="landlord-header-actions"><Link to="/account/security" className="occupancy-security-link">Account Security</Link><Link to="/account/notifications" className="occupancy-security-link">Notifications</Link></div>
      </header>
      <div className="landlord-layout">
        <LandlordNavigation />
        <main className="landlord-content">
          <section className="landlord-welcome"><span className="eyebrow">LANDLORD ACCOUNT</span><h1>Business and contact details</h1><p>Keep your contact information current so students and StudentHaven staff can reach you.</p></section>
          <section className="landlord-panel landlord-profile-panel">
            <div className="property-panel-heading"><div><span className="eyebrow">VERIFICATION</span><h2>Landlord account status</h2></div><span className={`property-status-pill property-status-${verification.toLowerCase()}`}>{verification.replaceAll("_", " ")}</span></div>
            <p>Updating your business name or registration number can return an approved profile to verification review.</p>
          </section>
          {error && <div className="property-alert property-alert-error" role="alert">{error}</div>}
          {notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}
          {loading ? <div className="dashboard-loading">Loading your profile…</div> : (
            <form className="landlord-property-form landlord-profile-form" onSubmit={(event) => void save(event)}>
              <section className="landlord-panel"><div className="property-panel-heading"><div><span className="eyebrow">ACCOUNT HOLDER</span><h2>Personal contact</h2></div></div>
                <div className="property-form-grid">
                  <label>First name<input required maxLength={100} value={form.first_name} onChange={(event) => updateField("first_name", event.target.value)} /></label>
                  <label>Last name<input required maxLength={100} value={form.last_name} onChange={(event) => updateField("last_name", event.target.value)} /></label>
                  <label>Mobile number<input type="tel" maxLength={20} value={form.mobile} onChange={(event) => updateField("mobile", event.target.value)} /></label>
                  <label>Business contact number<input type="tel" maxLength={20} value={form.phone} onChange={(event) => updateField("phone", event.target.value)} /></label>
                </div>
              </section>
              <section className="landlord-panel"><div className="property-panel-heading"><div><span className="eyebrow">BUSINESS DETAILS</span><h2>Registered landlord</h2></div></div>
                <div className="property-form-grid">
                  <label>Business or landlord name<input required maxLength={200} value={form.business_name} onChange={(event) => updateField("business_name", event.target.value)} /></label>
                  <label>Registration number<input maxLength={100} value={form.registration_number} onChange={(event) => updateField("registration_number", event.target.value)} /></label>
                  <label className="property-form-wide">Business address<textarea rows={4} required value={form.address} onChange={(event) => updateField("address", event.target.value)} /></label>
                </div>
              </section>
              <div className="property-form-actions"><button className="dashboard-primary-action" disabled={saving}>{saving ? "Saving profile…" : "Save profile"}</button><Link className="dashboard-secondary-action" to="/account/security">Security settings</Link></div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
