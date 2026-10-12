import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  applyToSponsorshipProgram,
  getMySponsorshipApplications,
  getSponsorshipPrograms,
} from "../../services/api";
import type { SponsorshipApplication, SponsorshipProgram } from "../../services/api";
import "../../App.css";

const officialFundingResources = [
  {
    name: "NSFAS",
    description: "South African government student financial aid for eligible students at public universities and TVET colleges.",
    url: "https://www.nsfas.org.za/content/how-to-apply.html",
  },
  {
    name: "Funza Lushaka Bursary",
    description: "Department of Basic Education bursaries for eligible students pursuing teaching qualifications.",
    url: "https://www.education.gov.za/Programmes/FunzaLushaka.aspx",
  },
  {
    name: "Sasol Bursaries",
    description: "Sasol’s official bursary programme information and application guidance.",
    url: "https://www.sasolbursaries.com/welcome/how-to-apply/",
  },
];

function money(amount: string, currency: string) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(Number(amount));
}

function dateLabel(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "No deadline";
}

function statusLabel(status: SponsorshipApplication["status"]) {
  return status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export default function StudentSponsorships() {
  const [programs, setPrograms] = useState<SponsorshipProgram[]>([]);
  const [applications, setApplications] = useState<SponsorshipApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [statement, setStatement] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [listed, mine] = await Promise.all([getSponsorshipPrograms(), getMySponsorshipApplications()]);
      setPrograms(listed);
      setApplications(mine);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't load the funding programmes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(program: SponsorshipProgram) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await applyToSponsorshipProgram(program.id, statement.trim());
      setNotice(`Your application for ${program.name} has been submitted.`);
      setSelected(null);
      setStatement("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't submit your application.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="page-shell"><main className="student-sponsorship-page">
    <header className="funding-header"><div><span className="section-eyebrow">BURSARIES & SPONSORSHIPS</span><h1>Funding opportunities</h1><p>Review programme rules, apply, and follow each decision from your funding dashboard.</p></div><Link className="dashboard-secondary-action" to="/student/dashboard">Student dashboard</Link></header>
    {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => void load()}>Try again</button></div>}
    {notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}

    <section className="sponsorship-section"><div className="sponsorship-section-heading"><div><span className="eyebrow">OPEN PROGRAMMES</span><h2>Available to apply for</h2></div><span>{programs.length} open</span></div>
      {loading ? <div className="property-empty-state">Loading funding opportunities…</div> : programs.length === 0 ? <div className="property-empty-state"><h3>No open programmes right now</h3><p>New bursaries and sponsorships will appear here when administrators publish them.</p></div> : <div className="sponsorship-program-grid">{programs.map((program) => {
        const alreadyApplied = Boolean(program.my_application_id);
        const isSelected = selected === program.id;
        return <article className="sponsorship-program-card" key={program.id}>
          <div className="sponsorship-program-top"><span className="eyebrow">{program.sponsor_name}</span><strong>{money(program.amount, program.currency)}</strong></div>
          <h3>{program.name}</h3><p>{program.description}</p>
          <div className="sponsorship-program-facts"><div><span>Funding period</span><strong>{dateLabel(program.funding_period_start)} – {dateLabel(program.funding_period_end)}</strong></div><div><span>Apply by</span><strong>{dateLabel(program.application_deadline)}</strong></div><div><span>Places remaining</span><strong>{program.available_slots === null ? "Open to eligible applicants" : String(program.available_slots)}</strong></div></div>
          <details><summary>Eligibility and conditions</summary><p><strong>Eligibility</strong><br />{program.eligibility_rules}</p>{program.conditions && <p><strong>Conditions</strong><br />{program.conditions}</p>}</details>
          {alreadyApplied ? <div className={`sponsorship-status sponsorship-status-${(program.my_application_status || "pending").toLowerCase()}`}><strong>{statusLabel(program.my_application_status as SponsorshipApplication["status"])}</strong><span>Your application is in your funding history below.</span></div> : <button className="dashboard-primary-action" disabled={program.available_slots === 0} onClick={() => { setSelected(isSelected ? null : program.id); setStatement(""); }}>{program.available_slots === 0 ? "Places allocated" : isSelected ? "Close application" : "Apply to this programme"}</button>}
          {isSelected && <form className="sponsorship-apply-form" onSubmit={(event) => { event.preventDefault(); void submit(program); }}><label>Short supporting statement <textarea maxLength={5000} rows={4} value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="Share any context that will help the funding team review your application." /></label><small>{statement.length}/5,000 characters. Eligibility is reviewed by the funding team.</small><button className="dashboard-primary-action" disabled={saving}>{saving ? "Submitting…" : "Submit application"}</button></form>}
        </article>;
      })}</div>}
    </section>

    <section className="sponsorship-section"><div className="sponsorship-section-heading"><div><span className="eyebrow">OFFICIAL EXTERNAL RESOURCES</span><h2>Bursaries and sponsorships</h2></div></div>
      <p className="external-funding-note">These links go to the funders’ official websites. Check each website for current eligibility requirements and application dates.</p>
      <div className="external-funding-resource-grid">{officialFundingResources.map((resource) => <article className="external-funding-resource" key={resource.name}>
        <h3>{resource.name}</h3><p>{resource.description}</p><a href={resource.url} target="_blank" rel="noopener noreferrer">Visit official website <span aria-hidden="true">↗</span></a>
      </article>)}</div>
    </section>

    <section className="sponsorship-section"><div className="sponsorship-section-heading"><div><span className="eyebrow">YOUR FUNDING JOURNEY</span><h2>My applications and awards</h2></div><Link to="/student/dashboard">Back to dashboard</Link></div>
      {applications.length === 0 ? <div className="property-empty-state"><p>You haven’t applied for a bursary or sponsorship yet.</p></div> : <div className="sponsorship-history-list">{applications.map((application) => <article className="sponsorship-history-card" key={application.id}>
        <div><span className="eyebrow">{application.sponsor_name}</span><h3>{application.program_name}</h3><p>Submitted {new Date(application.submitted_at).toLocaleDateString("en-ZA")}</p></div>
        <span className={`sponsorship-status sponsorship-status-${application.status.toLowerCase()}`}>{statusLabel(application.status)}</span>
        {application.status === "APPROVED" && <div className="sponsorship-award-details"><strong>{money(application.award_amount || application.program_amount, application.program_currency)}</strong><span>{dateLabel(application.award_period_start || application.funding_period_start)} – {dateLabel(application.award_period_end || application.funding_period_end)}</span>{application.award_conditions && <p>{application.award_conditions}</p>}</div>}
        {application.review_note && <p className="sponsorship-review-note"><strong>Funding team:</strong> {application.review_note}</p>}
      </article>)}</div>}
    </section>
  </main></div>;
}
