import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLink from "../../components/DashboardLink";
import { getProperty, getMediaUrl } from "../../services/api";
import type { Property } from "../../services/api";
import "../../App.css";

const STORAGE_KEY = "studenthaven.compare-property-ids";

function readIds(): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)).slice(0, 3) : [];
  } catch { return []; }
}

function CompareProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ids, setIds] = useState<number[]>([]);

  async function load() {
    const selected = readIds();
    setIds(selected); setLoading(true); setError("");
    try {
      const results = await Promise.allSettled(selected.map((id) => getProperty(id)));
      const available = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setProperties(available);
      if (selected.length > 0 && available.length === 0) setError("Those properties are no longer available. Clear the comparison and choose current listings.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load the selected properties."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function remove(id: number) {
    const next = ids.filter((item) => item !== id);
    setIds(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setProperties((current) => current.filter((property) => property.id !== id));
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY); setIds([]); setProperties([]);
  }

  const rows: { label: string; value: (property: Property) => string }[] = [
    { label: "Location", value: (property) => `${property.campus}, ${property.university}` },
    { label: "Property type", value: (property) => property.property_type.replaceAll("_", " ") },
    { label: "Distance to campus", value: (property) => property.distance_from_campus_km ? `${property.distance_from_campus_km} km · ${property.walking_minutes ?? "—"} min walk` : "Not listed" },
    { label: "Monthly price", value: (property) => property.monthly_min_price ? `R${Number(property.monthly_min_price).toLocaleString()}–R${Number(property.monthly_max_price || property.monthly_min_price).toLocaleString()}` : "Contact property" },
    { label: "Availability", value: (property) => `${property.available_rooms} rooms · ${property.available_beds} beds` },
    { label: "Rating", value: (property) => property.rating ? `${property.rating} / 5 · ${property.review_count} review${property.review_count === 1 ? "" : "s"}` : "Not rated" },
    { label: "Amenities", value: (property) => property.amenities.length ? property.amenities.map((amenity) => amenity.name).join(", ") : "Not listed" },
    { label: "Address", value: (property) => property.address },
  ];

  return <div className="property-collection-page"><header className="accommodation-header"><Link to="/accommodation" className="accommodation-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Property comparison</span></div></Link><nav className="discovery-quick-links"><Link to="/accommodation/map">Map</Link><Link to="/accommodation/favorites">Saved</Link><DashboardLink /></nav></header><main className="collection-page-content"><section className="collection-page-heading"><div><Link className="collection-back-link" to="/accommodation">← Back to accommodation</Link><span className="eyebrow">SIDE-BY-SIDE</span><h1>Compare properties</h1><p>Compare up to three residences by location, price, availability and amenities.</p></div><div className="collection-card-actions"><Link to="/accommodation">Browse properties</Link>{properties.length > 0 && <button onClick={clear}>Clear comparison</button>}</div></section>
    {error && <div className="property-alert property-alert-error" role="alert">{error}</div>}
    {loading ? <div className="property-empty-state">Loading comparison…</div> : properties.length === 0 ? <div className="property-empty-state"><h2>No properties selected</h2><p>Add properties to compare from the accommodation search.</p><Link className="dashboard-primary-action" to="/accommodation">Explore properties</Link></div> : <div className="compare-table-wrap"><table className="compare-table"><thead><tr><th>Compare</th>{properties.map((property) => <th key={property.id}>{property.images[0] && <img className="compare-property-image" src={getMediaUrl(property.images[0].image)} alt={property.name} />}<strong>{property.name}</strong><div className="collection-card-actions"><Link to={`/accommodation/${property.id}`}>View</Link><button onClick={() => remove(property.id)}>Remove</button></div></th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{properties.map((property) => <td key={property.id}>{row.value(property)}</td>)}</tr>)}</tbody></table></div>}
  </main></div>;
}

export default CompareProperties;
