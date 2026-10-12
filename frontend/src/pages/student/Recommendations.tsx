import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { getAccommodationRecommendations, getCurrentUser, getMediaUrl, updateStudentProfile } from "../../services/api";
import type { AccommodationRecommendation } from "../../services/api";
import { normalizeStudentPreferences, readStudentPreferences, saveStudentPreferences } from "../../data/studentPreferences";
import "../../App.css";

function Recommendations() {
  const [matches, setMatches] = useState<AccommodationRecommendation[]>([]);
  const [preferences, setPreferences] = useState(readStudentPreferences);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadMatches(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    saveStudentPreferences(preferences);
    setLoading(true); setError("");
    try {
      await updateStudentProfile({ accommodation_preferences: preferences });
      setMatches(await getAccommodationRecommendations(preferences));
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load recommendations."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    async function loadSavedMatches() {
      setLoading(true);
      setError("");
      try {
        const user = await getCurrentUser();
        const stored = user.student_profile?.accommodation_preferences;
        const hasSaved = Boolean(stored && Object.keys(stored).length);
        const initialPreferences = hasSaved ? normalizeStudentPreferences(stored) : readStudentPreferences();
        if (!hasSaved) {
          await updateStudentProfile({ accommodation_preferences: initialPreferences });
        }
        if (!active) return;
        setPreferences(initialPreferences);
        saveStudentPreferences(initialPreferences);
        setMatches(await getAccommodationRecommendations(initialPreferences));
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load recommendations.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadSavedMatches();
    return () => { active = false; };
  }, []);

  return <main className="student-page recommendations-page">
    <header className="dashboard-header"><Link to="/student/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Accommodation matching</span></div></Link><Link className="dashboard-secondary-action" to="/student/dashboard">Dashboard</Link></header>
    <section className="recommendations-heading"><div><span className="eyebrow">PERSONALIZED DISCOVERY</span><h1>Find a better match</h1><p>Adjust your preferences to rank available accommodation. Each score shows the criteria that affected the match.</p></div><div className="recommendation-count"><strong>{matches.length}</strong><span>Available matches</span></div></section>
    <form className="recommendation-preferences" onSubmit={(event) => void loadMatches(event)}>
      <label>Monthly budget (R)<input type="number" min="1" step="100" value={preferences.budget} onChange={(event) => setPreferences((current) => ({ ...current, budget: event.target.value }))} placeholder="No budget limit" /></label>
      <label>Preferred room type<input value={preferences.room_type} onChange={(event) => setPreferences((current) => ({ ...current, room_type: event.target.value }))} placeholder="e.g. Single, Shared" /></label>
      <label>Maximum campus distance (km)<input type="number" min="0.1" step="0.1" value={preferences.distance_km} onChange={(event) => setPreferences((current) => ({ ...current, distance_km: event.target.value }))} placeholder="Any distance" /></label>
      <label className="recommendation-accessible"><input type="checkbox" checked={preferences.accessible} onChange={(event) => setPreferences((current) => ({ ...current, accessible: event.target.checked }))} /> Accessible room required</label>
      <button className="dashboard-primary-action" disabled={loading}>{loading ? "Finding matches…" : "Update matches"}</button>
    </form>
    {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => void loadMatches()}>Try again</button></div>}
    {loading ? <div className="property-empty-state">Ranking available properties…</div> : matches.length === 0 ? <div className="property-empty-state"><h2>No matching accommodation is available</h2><p>Try widening your budget or distance limit, or join a property waiting list.</p><Link className="dashboard-primary-action" to="/accommodation">Browse all properties</Link></div> : <section className="recommendation-results">{matches.map((match) => {
      const image = match.property.images.find((item) => item.is_primary) ?? match.property.images[0];
      return <article className="recommendation-card" key={match.property.id}>
        <div className="recommendation-image">{image ? <img src={getMediaUrl(image.image)} alt={image.caption || match.property.name} /> : <span>Student accommodation</span>}</div>
        <div className="recommendation-info"><div className="recommendation-title"><div><span className="eyebrow">{match.property.campus} · {match.property.university}</span><h2>{match.property.name}</h2></div><strong>{match.match_score}%<small>match</small></strong></div><p>{match.property.address}</p><div className="recommendation-facts"><span>{match.property.available_beds} beds available</span><span>{match.property.distance_from_campus_km ? `${match.property.distance_from_campus_km} km from campus` : "Distance not listed"}</span><span>From {match.property.monthly_min_price ? `R${Number(match.property.monthly_min_price).toLocaleString()}/month` : "price not listed"}</span></div><div className="recommendation-explanation"><strong>Why it matches</strong><ul>{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>{match.considerations.length > 0 && <details><summary>Things to consider</summary><ul>{match.considerations.map((item) => <li key={item}>{item}</li>)}</ul></details>}</div><Link className="dashboard-primary-action" to={`/accommodation/${match.property.id}`}>View property</Link></div>
      </article>;
    })}</section>}
  </main>;
}

export default Recommendations;
