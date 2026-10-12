import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLink from "../../components/DashboardLink";
import { getProperties } from "../../services/api";
import type { Property } from "../../services/api";
import "../../App.css";

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function AccommodationMap() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [campusId, setCampusId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getProperties().then((result) => { if (active) setProperties(result.properties); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Unable to load accommodation locations."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const campuses = useMemo(() => {
    const unique = new Map<number, { id: number; name: string; university: string; latitude: number | null; longitude: number | null }>();
    properties.forEach((property) => unique.set(property.campus_id, {
      id: property.campus_id,
      name: property.campus,
      university: property.university,
      latitude: property.campus_latitude === null ? null : Number(property.campus_latitude),
      longitude: property.campus_longitude === null ? null : Number(property.campus_longitude),
    }));
    return [...unique.values()].sort((a, b) => `${a.university} ${a.name}`.localeCompare(`${b.university} ${b.name}`));
  }, [properties]);

  const visibleProperties = useMemo(() => properties.filter((property) => !campusId || String(property.campus_id) === campusId), [properties, campusId]);
  const focus = visibleProperties.find((property) => property.id === selectedPropertyId) ?? null;
  const campus = campuses.find((item) => item.id === (focus?.campus_id ?? Number(campusId))) ?? campuses.find((item) => item.id === visibleProperties[0]?.campus_id);
  const latitudes = [campus?.latitude, ...visibleProperties.map((item) => item.latitude === null ? null : Number(item.latitude))].filter((value): value is number => value !== null && value !== undefined);
  const longitudes = [campus?.longitude, ...visibleProperties.map((item) => item.longitude === null ? null : Number(item.longitude))].filter((value): value is number => value !== null && value !== undefined);
  const mapCenter = focus?.latitude !== null && focus?.latitude !== undefined && focus.longitude !== null
    ? { latitude: Number(focus.latitude), longitude: Number(focus.longitude) }
    : campus?.latitude !== null && campus?.latitude !== undefined && campus.longitude !== null
      ? { latitude: campus.latitude, longitude: campus.longitude }
      : latitudes.length > 0 && longitudes.length > 0
        ? { latitude: latitudes[0], longitude: longitudes[0] }
        : null;
  const bbox = mapCenter
    ? `${mapCenter.longitude - 0.025},${mapCenter.latitude - 0.018},${mapCenter.longitude + 0.025},${mapCenter.latitude + 0.018}`
    : "";
  const mapUrl = mapCenter
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${mapCenter.latitude}%2C${mapCenter.longitude}`
    : "";

  return <div className="accommodation-map-page">
    <header className="accommodation-header"><Link to="/accommodation" className="accommodation-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Accommodation map</span></div></Link><nav className="discovery-quick-links" aria-label="Accommodation tools"><Link to="/accommodation/favorites">Saved</Link><Link to="/accommodation/compare">Compare</Link><DashboardLink /></nav></header>
    <main className="map-page-content">
      <section className="map-page-heading"><div><Link className="collection-back-link" to="/accommodation">← Back to accommodation</Link><span className="eyebrow">FIND A PLACE NEAR CAMPUS</span><h1>Accommodation map</h1><p>Browse campus and accommodation locations on the OpenStreetMap map.</p></div><Link className="dashboard-secondary-action" to="/accommodation">Search listings</Link></section>
      {error && <div className="property-alert property-alert-error" role="alert">{error}<button type="button" onClick={() => { setLoading(true); setError(""); getProperties().then((result) => setProperties(result.properties)).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load accommodation locations.")).finally(() => setLoading(false)); }}>Try again</button></div>}
      {loading ? <div className="property-empty-state" role="status">Loading property locations…</div> : <>
        <section className="map-filter-bar" aria-label="Map filters">
          <label htmlFor="map-campus">University campus</label>
          <select id="map-campus" value={campusId} onChange={(event) => { setCampusId(event.target.value); setSelectedPropertyId(null); }}>
            <option value="">All listed campuses</option>
            {campuses.map((item) => <option key={item.id} value={item.id}>{item.university} · {item.name}</option>)}
          </select>
          {campus && <span>Showing {campus.university} · {campus.name}</span>}
        </section>
        {mapUrl ? <section className="map-real-world-frame" aria-label="OpenStreetMap view">
          <iframe title={`${focus?.name ?? campus?.name ?? "Campus"} on OpenStreetMap`} src={mapUrl} loading="lazy" referrerPolicy="no-referrer" />
          <p>Map data © OpenStreetMap contributors. The pin marks {focus ? focus.name : campus?.name ?? "the nearest mapped location"}. Choose a property below to move the map pin.</p>
        </section> : <div className="property-empty-state"><h2>Map coordinates aren’t available yet</h2><p>Add verified campus and property coordinates in property and campus records to show them on the map.</p></div>}
        <section className="map-property-list" aria-label="Accommodation listings">
          {visibleProperties.length === 0 ? <div className="property-empty-state"><h2>No properties at this campus</h2><p>Choose another campus or search all accommodation listings.</p></div> : visibleProperties.map((property) => {
            const latitude = property.latitude === null ? null : Number(property.latitude);
            const longitude = property.longitude === null ? null : Number(property.longitude);
            const campusLatitude = property.campus_latitude === null ? null : Number(property.campus_latitude);
            const campusLongitude = property.campus_longitude === null ? null : Number(property.campus_longitude);
            const approximateDistance = latitude !== null && longitude !== null && campusLatitude !== null && campusLongitude !== null
              ? distanceKm(latitude, longitude, campusLatitude, campusLongitude)
              : null;
            return <article key={property.id} className={selectedPropertyId === property.id ? "map-property-card is-focused" : "map-property-card"}>
              <span className="eyebrow">{property.campus} · {property.university}</span><h2>{property.name}</h2><p>{property.address}</p>
              <p>{approximateDistance !== null ? `${approximateDistance.toFixed(1)} km straight-line distance to campus` : "Campus distance not available"} · {property.available_beds} beds listed as available</p>
              <div className="map-property-actions"><Link to={`/accommodation/${property.id}`}>View property</Link>{latitude !== null && longitude !== null && <><button type="button" onClick={() => { setSelectedPropertyId(property.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Show on map</button><a href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${latitude}%2C${longitude}%3B${campusLatitude ?? latitude}%2C${campusLongitude ?? longitude}`} target="_blank" rel="noreferrer">Get directions</a></>}</div>
            </article>;
          })}
        </section>
      </>}
    </main>
  </div>;
}

export default AccommodationMap;
