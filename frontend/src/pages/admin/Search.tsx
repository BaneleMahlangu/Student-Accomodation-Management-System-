import AdminNavigation from "../../components/AdminNavigation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminGlobalSearch } from "../../services/api";
import type { AdminSearchResult } from "../../services/api";
import "../../App.css";

export default function AdminSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const found = await getAdminGlobalSearch(search);
        if (active) setResults(found);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to search platform records.");
      } finally {
        if (active) setLoading(false);
      }
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  return <div className="admin-dashboard-page admin-operations-page"><header className="admin-header"><Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link><div className="admin-header-title">Global Search</div></header><div className="admin-layout"><AdminNavigation /><main className="admin-content"><section className="admin-welcome"><div><span className="eyebrow">PLATFORM RECORDS</span><h1>Search StudentHaven</h1><p>Find students, student numbers, applications, landlords, properties, rooms, payments, documents, contracts and maintenance requests.</p></div></section><label className="admin-global-search-label">Search records<input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, student number, reference, property or room" aria-describedby="admin-search-help" /></label><p id="admin-search-help" className="analytics-generated">Enter at least two characters. Suggestions update as you type.</p>{error && <div className="property-alert property-alert-error" role="alert">{error}</div>}{loading && <p className="property-empty-state" role="status">Searching records…</p>}{!loading && query.trim().length >= 2 && !error && results.length === 0 && <div className="property-empty-state"><h2>No matching records</h2><p>Try a name, student number, record reference, property or room.</p></div>}{results.length > 0 && <section className="admin-global-search-results" aria-label="Search suggestions"><h2>{results.length} suggestion{results.length === 1 ? "" : "s"}</h2>{results.map((result, index) => <Link className="admin-global-search-result" to={result.path} key={`${result.kind}-${result.label}-${index}`}><span className="admin-global-search-kind">{result.kind}</span><span className="admin-global-search-copy"><strong>{result.label}</strong><small>{result.detail}</small></span><span className="admin-global-search-open" aria-hidden="true">Open →</span></Link>)}</section>}</main></div></div>;
}
