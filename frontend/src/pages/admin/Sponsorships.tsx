import AdminNavigation from "../../components/AdminNavigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  createSponsorshipProgram,
  getAdminSponsorshipApplications,
  getAdminSponsorshipPrograms,
  reviewSponsorshipApplication,
  updateSponsorshipProgram,
} from "../../services/api";
import type { SponsorshipApplication, SponsorshipProgram, SponsorshipProgramPayload } from "../../services/api";
import "../../App.css";

const newProgram: SponsorshipProgramPayload = {
  name: "", sponsor_name: "", description: "", eligibility_rules: "", amount: "", currency: "ZAR",
  funding_period_start: "", funding_period_end: "", application_deadline: null, maximum_beneficiaries: null,
  conditions: "", is_active: true,
};

function money(amount: string, currency: string) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(Number(amount));
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export default function AdminSponsorships() {
  const [programs, setPrograms] = useState<SponsorshipProgram[]>([]);
  const [applications, setApplications] = useState<SponsorshipApplication[]>([]);
  const [program, setProgram] = useState<SponsorshipProgramPayload>(newProgram);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [reviewStates, setReviewStates] = useState<Record<number, SponsorshipApplication["status"]>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [awardAmounts, setAwardAmounts] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (nextSearch = search, nextStatus = statusFilter) => {
    setLoading(true);
    setError("");
    try {
      const [nextPrograms, nextApplications] = await Promise.all([
        getAdminSponsorshipPrograms(), getAdminSponsorshipApplications(nextStatus, nextSearch),
      ]);
      setPrograms(nextPrograms);
      setApplications(nextApplications);
      setReviewStates((current) => Object.fromEntries(nextApplications.map((item) => [item.id, current[item.id] || item.status])));
      setReviewNotes((current) => Object.fromEntries(nextApplications.map((item) => [item.id, current[item.id] || ""])));
      setAwardAmounts((current) => Object.fromEntries(nextApplications.map((item) => [item.id, current[item.id] || ""])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load bursary and sponsorship records.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { void load("", ""); }, []);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    void load(search, statusFilter);
  }

  function editProgram(item: SponsorshipProgram) {
    setEditingId(item.id);
    setProgram({
      name: item.name, sponsor_name: item.sponsor_name, description: item.description,
      eligibility_rules: item.eligibility_rules, amount: item.amount, currency: item.currency,
      funding_period_start: item.funding_period_start, funding_period_end: item.funding_period_end,
      application_deadline: item.application_deadline, maximum_beneficiaries: item.maximum_beneficiaries,
      conditions: item.conditions, is_active: item.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetProgram() {
    setEditingId(null);
    setProgram(newProgram);
  }

  async function saveProgram(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload = { ...program, application_deadline: program.application_deadline || null };
    try {
      const saved = editingId ? await updateSponsorshipProgram(editingId, payload) : await createSponsorshipProgram(payload);
      setNotice(`${saved.name} ${editingId ? "updated" : "created"}.`);
      resetProgram();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this programme.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDecision(application: SponsorshipApplication) {
    const reviewNote = (reviewNotes[application.id] || "").trim();
    if (!reviewNote) {
      setError("Add a review note before saving a decision.");
      return;
    }
    setSavingId(application.id);
    setError("");
    setNotice("");
    try {
      const decision = reviewStates[application.id] || application.status;
      await reviewSponsorshipApplication(application.id, {
        status: decision,
        review_note: reviewNote,
        ...(decision === "APPROVED" && awardAmounts[application.id] ? { award_amount: awardAmounts[application.id] } : {}),
      });
      setNotice(`Decision saved for ${application.student_name} — ${application.program_name}.`);
      setReviewNotes((current) => ({ ...current, [application.id]: "" }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this decision.");
    } finally {
      setSavingId(null);
    }
  }

  return <div className="admin-dashboard-page admin-operations-page">
    <header className="admin-header"><Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link><div className="admin-header-title">Bursaries & sponsorships</div></header>
    <div className="admin-layout">
      <AdminNavigation />
      <main className="admin-content sponsorship-admin-content">
        <section className="admin-welcome"><div><span className="eyebrow">FUNDING PROGRAMMES</span><h1>Bursaries & sponsorships</h1><p>Publish funding opportunities, manage beneficiary limits, and record reviewed student decisions.</p></div></section>
        {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}
        {notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}

        <section className="sponsorship-admin-panel"><div className="sponsorship-section-heading"><div><span className="eyebrow">PROGRAMME SETUP</span><h2>{editingId ? "Edit programme" : "Create a programme"}</h2></div>{editingId && <button className="dashboard-secondary-action" onClick={resetProgram}>Cancel edit</button>}</div>
          <form className="sponsorship-program-form" onSubmit={(event) => void saveProgram(event)}>
            <label>Programme name<input required maxLength={200} value={program.name} onChange={(event) => setProgram({ ...program, name: event.target.value })} /></label>
            <label>Sponsor<input required maxLength={200} value={program.sponsor_name} onChange={(event) => setProgram({ ...program, sponsor_name: event.target.value })} /></label>
            <label>Funding amount<input required type="number" min="0.01" step="0.01" value={program.amount} onChange={(event) => setProgram({ ...program, amount: event.target.value })} /></label>
            <label>Currency<input required minLength={3} maxLength={3} value={program.currency} onChange={(event) => setProgram({ ...program, currency: event.target.value.toUpperCase() })} /></label>
            <label>Funding starts<input required type="date" value={program.funding_period_start} onChange={(event) => setProgram({ ...program, funding_period_start: event.target.value })} /></label>
            <label>Funding ends<input required type="date" value={program.funding_period_end} onChange={(event) => setProgram({ ...program, funding_period_end: event.target.value })} /></label>
            <label>Application deadline<input type="date" value={program.application_deadline || ""} onChange={(event) => setProgram({ ...program, application_deadline: event.target.value || null })} /></label>
            <label>Beneficiary limit<input type="number" min="1" value={program.maximum_beneficiaries ?? ""} onChange={(event) => setProgram({ ...program, maximum_beneficiaries: event.target.value ? Number(event.target.value) : null })} placeholder="No limit" /></label>
            <label className="sponsorship-form-wide">Programme description<textarea required rows={3} value={program.description} onChange={(event) => setProgram({ ...program, description: event.target.value })} /></label>
            <label className="sponsorship-form-wide">Eligibility rules<textarea required rows={3} value={program.eligibility_rules} onChange={(event) => setProgram({ ...program, eligibility_rules: event.target.value })} placeholder="Describe who may apply. The funding team reviews eligibility manually." /></label>
            <label className="sponsorship-form-wide">Conditions<textarea rows={2} value={program.conditions} onChange={(event) => setProgram({ ...program, conditions: event.target.value })} /></label>
            <label className="property-checkbox"><input type="checkbox" checked={program.is_active} onChange={(event) => setProgram({ ...program, is_active: event.target.checked })} /> Open to student applications</label>
            <button className="dashboard-primary-action" disabled={saving}>{saving ? "Saving…" : editingId ? "Save programme" : "Publish programme"}</button>
          </form>
        </section>

        <section className="sponsorship-admin-panel"><div className="sponsorship-section-heading"><div><span className="eyebrow">PROGRAMME PORTFOLIO</span><h2>Published and archived</h2></div><span>{programs.length} programmes</span></div>
          {programs.length === 0 ? <div className="property-empty-state"><p>No funding programmes have been created yet.</p></div> : <div className="sponsorship-admin-program-list">{programs.map((item) => <article className="sponsorship-admin-program" key={item.id}><div><span className={`admin-program-state ${item.is_active ? "is-active" : ""}`}>{item.is_active ? "Open" : "Closed"}</span><h3>{item.name}</h3><p>{item.sponsor_name} · {money(item.amount, item.currency)} · {item.funding_period_start} – {item.funding_period_end}</p></div><div className="sponsorship-admin-program-counts"><strong>{item.application_count} applications</strong><span>{item.beneficiary_count}{item.maximum_beneficiaries ? ` / ${item.maximum_beneficiaries}` : ""} beneficiaries</span></div><button className="dashboard-secondary-action" onClick={() => editProgram(item)}>Edit</button></article>)}</div>}
        </section>

        <section className="sponsorship-admin-panel"><div className="sponsorship-section-heading"><div><span className="eyebrow">STUDENT REVIEW QUEUE</span><h2>Applications and awards</h2></div><span>{applications.length} shown</span></div>
          <form className="audit-filter-bar funding-filter-bar" onSubmit={submitSearch}><label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student or programme" /></label><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Not approved</option><option value="WAITLISTED">Waitlisted</option></select></label><button className="dashboard-primary-action">Apply filters</button></form>
          {loading ? <div className="property-empty-state">Loading applications…</div> : applications.length === 0 ? <div className="property-empty-state"><p>No sponsorship applications match these filters.</p></div> : <div className="sponsorship-review-list">{applications.map((application) => <article className="sponsorship-review-card" key={application.id}>
            <div className="sponsorship-review-heading"><div><span className="eyebrow">{application.sponsor_name}</span><h3>{application.program_name}</h3><p>{application.student_name} · {application.student_email}{application.student_number ? ` · ${application.student_number}` : ""}</p></div><span className={`sponsorship-status sponsorship-status-${application.status.toLowerCase()}`}>{statusLabel(application.status)}</span></div>
            {application.statement && <blockquote>{application.statement}</blockquote>}
            {application.status === "APPROVED" && <p className="sponsorship-award-summary">Award: <strong>{money(application.award_amount || application.program_amount, application.program_currency)}</strong> · {application.award_period_start || application.funding_period_start} – {application.award_period_end || application.funding_period_end}</p>}
            <div className="sponsorship-review-controls"><label>Decision<select value={reviewStates[application.id] || application.status} onChange={(event) => setReviewStates((current) => ({ ...current, [application.id]: event.target.value as SponsorshipApplication["status"] }))}><option value="PENDING">Pending review</option><option value="APPROVED">Approve award</option><option value="WAITLISTED">Waitlist</option><option value="REJECTED">Not approved</option></select></label>{reviewStates[application.id] === "APPROVED" && <label>Award amount (default {money(application.program_amount, application.program_currency)})<input type="number" min="0.01" step="0.01" value={awardAmounts[application.id] || ""} onChange={(event) => setAwardAmounts((current) => ({ ...current, [application.id]: event.target.value }))} placeholder={application.program_amount} /></label>}<label>Review note<textarea rows={2} maxLength={1500} value={reviewNotes[application.id] || ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [application.id]: event.target.value }))} placeholder="Explain the decision for the student" /></label><button className="dashboard-primary-action" disabled={savingId === application.id} onClick={() => void saveDecision(application)}>{savingId === application.id ? "Saving…" : "Save decision"}</button></div>
          </article>)}</div>}
          <p className="analytics-generated">Funding decisions are recorded in the audit log and sent to students as notifications.</p>
        </section>
      </main>
    </div>
  </div>;
}
