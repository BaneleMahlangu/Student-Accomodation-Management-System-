import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  DEFAULT_STUDENT_PREFERENCES,
  readOnboardingStep,
  readStudentPreferences,
  normalizeStudentPreferences,
  saveOnboardingStep,
  saveStudentPreferences,
} from "../../data/studentPreferences";
import type { StudentAccommodationPreferences } from "../../data/studentPreferences";
import { getCurrentUser, updateStudentProfile } from "../../services/api";
import type { CurrentUser, StudentProfileUpdatePayload } from "../../services/api";
import "../../App.css";

const emptyProfile: StudentProfileUpdatePayload = {
  first_name: "",
  last_name: "",
  mobile: "",
  university: "",
  campus: "",
  course: "",
  year_of_study: null,
  date_of_birth: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
};

const steps = ["Your details", "Your preferences", "Documents", "Funding", "Recommendations"];

export default function StudentOnboarding() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState(emptyProfile);
  const [preferences, setPreferences] = useState<StudentAccommodationPreferences>(DEFAULT_STUDENT_PREFERENCES);
  const [step, setStep] = useState(readOnboardingStep);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    getCurrentUser().then((currentUser) => {
      if (!active) return;
      setUser(currentUser);
      const details = currentUser.student_profile;
      setProfile({
        first_name: currentUser.first_name || "",
        last_name: currentUser.last_name || "",
        mobile: currentUser.mobile || "",
        university: details?.university || "",
        campus: details?.campus || "",
        course: details?.course || "",
        year_of_study: details?.year_of_study ?? null,
        date_of_birth: details?.date_of_birth || "",
        emergency_contact_name: details?.emergency_contact_name || "",
        emergency_contact_phone: details?.emergency_contact_phone || "",
      });
      const savedPreferences = details?.accommodation_preferences;
      setPreferences(savedPreferences && Object.keys(savedPreferences).length
        ? normalizeStudentPreferences(savedPreferences)
        : readStudentPreferences());
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "Unable to load your account details.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function goToStep(next: number) {
    const bounded = Math.min(5, Math.max(1, next));
    saveOnboardingStep(bounded);
    setStep(bounded);
    setError("");
    setNotice("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await updateStudentProfile({
        ...profile,
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        mobile: profile.mobile.trim(),
        university: profile.university.trim(),
        campus: profile.campus.trim(),
        course: profile.course.trim(),
        emergency_contact_name: profile.emergency_contact_name.trim(),
        emergency_contact_phone: profile.emergency_contact_phone.trim(),
      });
      setUser(updated);
      goToStep(2);
      setNotice("Your profile details have been saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save your profile details.");
    } finally {
      setSaving(false);
    }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await updateStudentProfile({ accommodation_preferences: preferences });
      setUser(updated);
      saveStudentPreferences(preferences);
      goToStep(3);
      setNotice("Your preferences are saved to your account and will follow you across devices.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save your accommodation preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function leaveForLater() {
    setError("");
    if (step === 1) {
      setSaving(true);
      try {
        const partialProfile = {
          ...(profile.first_name.trim() ? { first_name: profile.first_name.trim() } : {}),
          ...(profile.last_name.trim() ? { last_name: profile.last_name.trim() } : {}),
          ...(profile.mobile.trim() ? { mobile: profile.mobile.trim() } : {}),
          ...(profile.university.trim() ? { university: profile.university.trim() } : {}),
          ...(profile.campus.trim() ? { campus: profile.campus.trim() } : {}),
          ...(profile.course.trim() ? { course: profile.course.trim() } : {}),
          ...(profile.year_of_study ? { year_of_study: profile.year_of_study } : {}),
          ...(profile.date_of_birth ? { date_of_birth: profile.date_of_birth } : {}),
          ...(profile.emergency_contact_name.trim() ? { emergency_contact_name: profile.emergency_contact_name.trim() } : {}),
          ...(profile.emergency_contact_phone.trim() ? { emergency_contact_phone: profile.emergency_contact_phone.trim() } : {}),
        };
        const updated = await updateStudentProfile(partialProfile);
        setUser(updated);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to save your profile progress.");
        return;
      } finally {
        setSaving(false);
      }
    }
    if (step === 2) {
      setSaving(true);
      try {
        await updateStudentProfile({ accommodation_preferences: preferences });
        saveStudentPreferences(preferences);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to save your accommodation preferences.");
        return;
      } finally {
        setSaving(false);
      }
    }
    saveOnboardingStep(step);
    navigate("/student/dashboard");
  }

  const progress = `${(step / steps.length) * 100}%`;

  return (
    <div className="student-onboarding-page">
      <header className="dashboard-header"><Link to="/student/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Student onboarding</span></div></Link><Link className="dashboard-secondary-action" to="/student/dashboard">Student dashboard</Link></header>
      <main className="student-onboarding-shell">
        <div className="student-onboarding-heading"><span className="section-eyebrow">YOUR ACCOMMODATION JOURNEY</span><h1>Let’s get you ready</h1><p>Complete the steps that apply to you. You can save your progress and come back any time.</p></div>
        <section className="onboarding-progress-card" aria-label={`Step ${step} of ${steps.length}`}>
          <div className="onboarding-progress-meta"><strong>Step {step} of {steps.length}</strong><span>{steps[step - 1]}</span></div>
          <div className="onboarding-progress-track"><span style={{ width: progress }} /></div>
          <ol className="onboarding-step-list">{steps.map((label, index) => <li key={label} className={index + 1 < step ? "complete" : index + 1 === step ? "current" : ""}><span>{index + 1 < step ? "✓" : index + 1}</span>{label}</li>)}</ol>
        </section>
        {error && <div className="property-alert property-alert-error" role="alert">{error}</div>}
        {notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}
        {loading ? <div className="dashboard-loading">Loading your saved details…</div> : (
          <section className="onboarding-step-panel">
            {step === 1 && <form onSubmit={(event) => void saveProfile(event)}>
              <span className="section-eyebrow">PERSONAL AND UNIVERSITY INFORMATION</span><h2>Confirm your profile</h2><p>These details help staff verify your student profile and contact you about your application.</p>
              <div className="property-form-grid">
                <label>First name<input required maxLength={100} value={profile.first_name} onChange={(event) => setProfile((current) => ({ ...current, first_name: event.target.value }))} /></label>
                <label>Last name<input required maxLength={100} value={profile.last_name} onChange={(event) => setProfile((current) => ({ ...current, last_name: event.target.value }))} /></label>
                <label>Mobile number<input required type="tel" maxLength={20} value={profile.mobile} onChange={(event) => setProfile((current) => ({ ...current, mobile: event.target.value }))} /></label>
                <label>Date of birth<input required type="date" value={profile.date_of_birth} onChange={(event) => setProfile((current) => ({ ...current, date_of_birth: event.target.value }))} /></label>
                <label>University<input required maxLength={200} value={profile.university} onChange={(event) => setProfile((current) => ({ ...current, university: event.target.value }))} /></label>
                <label>Campus<input required maxLength={200} value={profile.campus} onChange={(event) => setProfile((current) => ({ ...current, campus: event.target.value }))} /></label>
                <label>Course or programme<input required maxLength={200} value={profile.course} onChange={(event) => setProfile((current) => ({ ...current, course: event.target.value }))} /></label>
                <label>Year of study<input required type="number" min={1} max={20} value={profile.year_of_study ?? ""} onChange={(event) => setProfile((current) => ({ ...current, year_of_study: event.target.value ? Number(event.target.value) : null }))} /></label>
                <label>Emergency contact name<input required maxLength={200} value={profile.emergency_contact_name} onChange={(event) => setProfile((current) => ({ ...current, emergency_contact_name: event.target.value }))} /></label>
                <label>Emergency contact number<input required type="tel" maxLength={20} value={profile.emergency_contact_phone} onChange={(event) => setProfile((current) => ({ ...current, emergency_contact_phone: event.target.value }))} /></label>
              </div>
              <div className="onboarding-actions"><button className="dashboard-primary-action" disabled={saving}>{saving ? "Saving details…" : "Save and continue"}</button><button type="button" className="dashboard-secondary-action" onClick={leaveForLater}>Save and finish later</button></div>
            </form>}
            {step === 2 && <form onSubmit={savePreferences}>
              <span className="section-eyebrow">ACCOMMODATION PREFERENCES</span><h2>What matters most to you?</h2><p>These preferences rank available properties for you. You can change them whenever you search.</p>
              <div className="property-form-grid">
                <label>Maximum monthly budget (R)<input type="number" min={1} step={100} value={preferences.budget} onChange={(event) => setPreferences((current) => ({ ...current, budget: event.target.value }))} placeholder="No limit" /></label>
                <label>Preferred room type<select value={preferences.room_type} onChange={(event) => setPreferences((current) => ({ ...current, room_type: event.target.value }))}><option value="">No preference</option><option value="SINGLE">Single room</option><option value="SHARED">Shared room</option><option value="STUDIO">Studio</option></select></label>
                <label>Maximum distance to campus (km)<input type="number" min={0.1} step={0.1} value={preferences.distance_km} onChange={(event) => setPreferences((current) => ({ ...current, distance_km: event.target.value }))} placeholder="Any distance" /></label>
                <label className="onboarding-accessibility"><input type="checkbox" checked={preferences.accessible} onChange={(event) => setPreferences((current) => ({ ...current, accessible: event.target.checked }))} /> I need an accessible room</label>
              </div>
              <p className="onboarding-privacy-note">Preferences are saved to your StudentHaven account so they follow you across devices.</p>
              <div className="onboarding-actions"><button className="dashboard-secondary-action" type="button" onClick={() => goToStep(1)}>Back</button><button className="dashboard-primary-action" disabled={saving}>{saving ? "Saving…" : "Save preferences and continue"}</button><button type="button" className="dashboard-secondary-action" onClick={() => void leaveForLater()} disabled={saving}>Save and finish later</button></div>
            </form>}
            {step === 3 && <div><span className="section-eyebrow">DOCUMENTS AND VERIFICATION</span><h2>Prepare your documents</h2><p>{user?.is_verified ? "Your email address is verified." : "Verify your email address to protect your account and receive important updates."} Required documents are attached to an accommodation application for the property landlord to review.</p><div className="onboarding-checklist"><span className={user?.is_verified ? "done" : "pending"}>{user?.is_verified ? "✓" : "!"}</span><div><strong>Email verification</strong><small>{user?.is_verified ? "Complete" : "Check your email to finish verification."}</small></div></div><div className="onboarding-checklist"><span className="pending">•</span><div><strong>Application documents</strong><small>Upload proof of registration and identification when you create an application.</small></div></div><div className="onboarding-actions"><button className="dashboard-secondary-action" onClick={() => goToStep(2)}>Back</button><Link className="dashboard-secondary-action" to="/student/documents">Open documents</Link><button className="dashboard-primary-action" onClick={() => goToStep(4)}>Continue</button><button className="dashboard-secondary-action" onClick={leaveForLater}>Save and finish later</button></div></div>}
            {step === 4 && <div><span className="section-eyebrow">FUNDING AND PAYMENT</span><h2>See your funding options</h2><p>Your funding method and supporting information are recorded with each accommodation application. Bursaries and sponsorship programmes have their own eligibility and review process.</p><div className="onboarding-link-cards"><Link to="/student/funding-programs"><strong>Explore bursaries and sponsorships</strong><span>See eligibility, deadlines and application status.</span></Link><Link to="/student/applications"><strong>Review accommodation applications</strong><span>Funding and payment records appear after the application reaches the contract stage.</span></Link></div><div className="onboarding-actions"><button className="dashboard-secondary-action" onClick={() => goToStep(3)}>Back</button><button className="dashboard-primary-action" onClick={() => goToStep(5)}>Continue to matches</button><button className="dashboard-secondary-action" onClick={leaveForLater}>Save and finish later</button></div></div>}
            {step === 5 && <div><span className="section-eyebrow">PERSONALISED ACCOMMODATION</span><h2>Your profile is ready for discovery</h2><p>Use your budget, room and distance preferences to see why each available property may suit you. Availability can change while applications are reviewed.</p><div className="onboarding-summary"><span><strong>Monthly budget</strong>{preferences.budget ? `R${Number(preferences.budget).toLocaleString("en-ZA")}` : "No limit set"}</span><span><strong>Room type</strong>{preferences.room_type || "No preference"}</span><span><strong>Campus distance</strong>{preferences.distance_km ? `${preferences.distance_km} km max` : "Any distance"}</span><span><strong>Accessible room</strong>{preferences.accessible ? "Required" : "No preference"}</span></div><div className="onboarding-actions"><button className="dashboard-secondary-action" onClick={() => goToStep(4)}>Back</button><Link className="dashboard-primary-action" to="/student/recommendations">View accommodation matches</Link><button className="dashboard-secondary-action" onClick={() => { saveOnboardingStep(5); navigate("/student/dashboard"); }}>Finish onboarding</button></div></div>}
          </section>
        )}
      </main>
    </div>
  );
}
