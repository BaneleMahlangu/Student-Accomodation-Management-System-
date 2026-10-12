import AdminNavigation from "../../components/AdminNavigation";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminApplications } from "../../services/api";
import type { Application } from "../../services/api";
import "../../App.css";

export default function DocumentsIndex() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminApplications()
      .then((result) => { if (active) setApplications(result.applications); })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load application records.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return applications;
    return applications.filter((application) => [
      application.application_number,
      application.student_name,
      application.property_name,
      application.room_number,
    ].some((value) => value.toLowerCase().includes(term)));
  }, [applications, search]);

  return (
    <div className="admin-dashboard-page admin-directory-page">
      <header className="admin-header">
        <Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link>
        <div className="admin-header-title">Eligibility checks</div>
      </header>
      <div className="admin-layout">
        <AdminNavigation />
        <main className="admin-content admin-directory-content">
          <section className="admin-welcome admin-directory-title"><div><span className="eyebrow">APPLICATION ELIGIBILITY</span><h1>Choose an application</h1><p>Check whether each application meets the submission, room selection, and landlord verified-document requirements.</p></div></section>
          <label className="audit-search-label">Search applications<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student, application, property or room" /></label>
          {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => { setLoading(true); setError(""); getAdminApplications().then((result) => setApplications(result.applications)).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Unable to load application records.")).finally(() => setLoading(false)); }}>Try again</button></div>}
          {loading ? <div className="dashboard-loading">Loading applications…</div> : filtered.length === 0 ? <div className="property-empty-state"><h2>No applications found</h2><p>Applications to check for eligibility will appear here when submitted.</p></div> : (
            <div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>Application</th><th>Student</th><th>Accommodation</th><th>Status</th></tr></thead><tbody>
              {filtered.map((application) => <tr key={application.id}>
                <td><strong>{application.application_number}</strong></td>
                <td>{application.student_name}</td>
                <td>{application.property_name}<small>Room {application.room_number}</small></td>
                <td>{application.status.replaceAll("_", " ")}</td>
              </tr>)}
            </tbody></table></div>
          )}
          <p className="analytics-generated">{filtered.length} of {applications.length} application records</p>
        </main>
      </div>
    </div>
  );
}
