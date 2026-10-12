import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import DashboardLink from "../../components/DashboardLink";
import { getMediaUrl, getStudentFavoriteProperties, setStudentFavoriteProperty } from "../../services/api";
import type { Property } from "../../services/api";
import "../../App.css";

function SavedProperties() {
  const location = useLocation();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { setProperties(await getStudentFavoriteProperties()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Sign in as a student to view saved properties."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function remove(propertyId: number) {
    try {
      await setStudentFavoriteProperty(propertyId, false);
      setProperties((current) => current.filter((property) => property.id !== propertyId));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to remove this property."); }
  }

  return <div className="property-collection-page"><header className="accommodation-header"><Link to="/accommodation" className="accommodation-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Saved accommodation</span></div></Link><nav className="discovery-quick-links"><Link to="/accommodation/map">Map</Link><Link to="/accommodation/compare">Compare</Link><DashboardLink /></nav></header><main className="collection-page-content"><section className="collection-page-heading"><div><Link className="collection-back-link" to="/accommodation">← Back to accommodation</Link><span className="eyebrow">YOUR SHORTLIST</span><h1>Saved properties</h1><p>Keep the residences you’re considering together.</p></div><Link className="dashboard-secondary-action" to="/accommodation">Browse accommodation</Link></section>
    {error && <div className="property-alert property-alert-error" role="alert">{error} <Link to="/login" state={{ from: location }}>Sign in</Link></div>}
    {loading ? <div className="property-empty-state">Loading your saved properties…</div> : properties.length === 0 && !error ? <div className="property-empty-state"><h2>No saved properties yet</h2><p>Save a residence from accommodation discovery to keep it here.</p><Link className="dashboard-primary-action" to="/accommodation">Explore properties</Link></div> : <section className="collection-property-grid">{properties.map((property) => <article className="collection-property-card" key={property.id}>{property.images[0] && <img className="collection-property-image" src={getMediaUrl(property.images[0].image)} alt={property.images[0].caption || property.name} />}<span className="eyebrow">{property.campus} · {property.university}</span><h2>{property.name}</h2><p>{property.distance_from_campus_km ? `${property.distance_from_campus_km} km from campus` : property.address}</p><p>{property.available_beds} beds available · {property.monthly_min_price ? `From R${Number(property.monthly_min_price).toLocaleString()}/month` : "Contact property for pricing"}</p><div className="collection-card-actions"><Link to={`/accommodation/${property.id}`}>View property</Link><Link to={`/accommodation/compare`}>Compare</Link><button onClick={() => void remove(property.id)}>Remove saved</button></div></article>)}</section>}
  </main></div>;
}

export default SavedProperties;
