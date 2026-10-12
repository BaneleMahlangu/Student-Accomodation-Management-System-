import AdminNavigation from "../../components/AdminNavigation";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../../App.css";
import { decideManagedProperty, getAdminPropertyQueue, getCurrentUser, getMediaUrl } from "../../services/api";
import type { CurrentUser, ManagedProperty } from "../../services/api";

function AdminProperties() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [properties, setProperties] = useState<ManagedProperty[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const selectedProperty = useMemo(() => properties.find((item) => item.id === selectedId) ?? properties[0] ?? null, [properties, selectedId]);

  async function loadQueue() {
    setLoading(true); setError("");
    try {
      const [currentUser, queue] = await Promise.all([getCurrentUser(), getAdminPropertyQueue()]);
      setUser(currentUser); setProperties(queue);
      if (!queue.some((property) => property.id === selectedId)) setSelectedId(queue[0]?.id ?? null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load the property review queue."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadQueue(); }, []);

  async function makeDecision(decision: "APPROVED" | "REJECTED") {
    if (!selectedProperty) return;
    setSaving(true); setError(""); setFeedback("");
    try {
      const propertyName = selectedProperty.name;
      await decideManagedProperty(selectedProperty.id, decision, notes.trim());
      setProperties((current) => current.filter((property) => property.id !== selectedProperty.id));
      setSelectedId(null); setNotes("");
      setFeedback(decision === "APPROVED" ? `${propertyName} is approved and published.` : `Changes requested for ${propertyName}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to record the review decision."); }
    finally { setSaving(false); }
  }

  return <div className="admin-dashboard-page property-management-page">
    <header className="admin-header"><Link to="/admin/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Administrator Console</span></div></Link><div className="admin-header-title">Property approval</div></header>
    <div className="admin-layout">
      <AdminNavigation />
      <main className="admin-content property-management-content">
        <section className="admin-welcome property-management-title"><div><span className="eyebrow">ACCOMMODATION OVERSIGHT</span><h1>Property review queue</h1><p>Review the listing, photos and room inventory before publishing it to students.</p></div><div className="property-review-count">{properties.length}<span>awaiting review</span></div></section>
        {user && <p className="property-reviewer-line">Reviewing as {user.first_name} {user.last_name}</p>}
        {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
        {feedback && <div className="property-alert property-alert-success" role="status">{feedback}</div>}

        {loading ? <div className="property-empty-state">Loading submitted properties…</div> : properties.length === 0 ? <div className="property-empty-state property-admin-empty"><div className="property-empty-icon">✓</div><h2>No properties waiting for review</h2><p>New submissions will appear here with their photos and accommodation inventory.</p><button className="dashboard-secondary-action" onClick={() => void loadQueue()}>Refresh queue</button></div> : <div className="admin-property-review-grid">
          <section className="property-review-list"><div className="property-panel-heading"><div><span className="eyebrow">SUBMISSIONS</span><h2>Awaiting review</h2></div><span>{properties.length}</span></div>
            {properties.map((property) => <button key={property.id} className={`property-review-list-card ${selectedProperty?.id === property.id ? "selected" : ""}`} onClick={() => { setSelectedId(property.id); setNotes(""); }}>
              <strong>{property.name}</strong><span>{property.campus_name} · {property.university_name}</span><small>{property.total_rooms} rooms · {property.total_beds} beds</small><em>{property.landlord_name}</em>
            </button>)}
          </section>
          {selectedProperty && <section className="property-review-detail">
            <div className="property-review-detail-heading"><div><span className="eyebrow">SUBMITTED LISTING</span><h2>{selectedProperty.name}</h2><p>{selectedProperty.property_type.replaceAll("_", " ")} · {selectedProperty.campus_name} · {selectedProperty.university_name}</p></div><span className="property-status-pill property-status-pending">PENDING REVIEW</span></div>
            <div className="property-review-stats"><div><strong>{selectedProperty.total_rooms}</strong><span>Rooms</span></div><div><strong>{selectedProperty.total_beds}</strong><span>Beds</span></div><div><strong>{selectedProperty.available_beds}</strong><span>Available</span></div><div><strong>{selectedProperty.images.length}</strong><span>Photos</span></div></div>
            <div className="property-review-section"><h3>Property information</h3><p><strong>Landlord</strong>{selectedProperty.landlord_name}</p><p><strong>Address</strong>{selectedProperty.address}</p><p><strong>Latitude / Longitude</strong>{selectedProperty.latitude ?? "—"}, {selectedProperty.longitude ?? "—"}</p><p><strong>Distance from campus</strong>{selectedProperty.distance_from_campus_km ? `${selectedProperty.distance_from_campus_km} km` : "—"}{selectedProperty.walking_minutes !== null ? ` · ${selectedProperty.walking_minutes} min walk` : ""}</p><p><strong>Monthly price</strong>R{selectedProperty.monthly_min_price ?? "—"} – R{selectedProperty.monthly_max_price ?? "—"}</p><p className="property-review-description">{selectedProperty.description}</p>
              {selectedProperty.amenities.length > 0 && <div className="property-review-amenities">{selectedProperty.amenities.map((amenity) => <span key={amenity.id}>{amenity.name}</span>)}</div>}
            </div>
            <div className="property-review-section"><h3>Property photos</h3>{selectedProperty.images.length === 0 ? <p>No photos attached.</p> : <div className="property-review-photos">{selectedProperty.images.map((image) => <figure key={image.id}><img src={getMediaUrl(image.image)} alt={image.caption || selectedProperty.name} /><figcaption>{image.caption || image.category.replaceAll("_", " ")}</figcaption></figure>)}</div>}</div>
            <div className="property-review-section"><h3>Accommodation inventory</h3>{selectedProperty.buildings.length === 0 ? <p>No buildings have been added.</p> : selectedProperty.buildings.map((building) => <div key={building.id} className="property-review-building"><strong>{building.name}</strong><span>{building.floors.length} floors planned</span>{building.floors.map((floor) => <div key={floor.id} className="property-review-floor"><b>{floor.name || (floor.floor_number === 0 ? "Ground floor" : `Floor ${floor.floor_number}`)}</b>{floor.rooms.length === 0 ? <small>No rooms</small> : floor.rooms.map((room) => <div key={room.id} className="property-review-room"><span><b>Room {room.room_number}</b> · {room.room_type_name} · {room.capacity} beds · R{room.monthly_price}/month · {room.status}</span><small>{room.beds.length === 0 ? "No beds listed" : room.beds.map((bed) => `Bed ${bed.bed_number}: ${bed.status.toLowerCase()}`).join(" · ")}</small></div>)}</div>)}</div>)}</div>
            <section className="property-decision-panel"><div><span className="eyebrow">REVIEW DECISION</span><h3>Does this listing meet StudentHaven’s requirements?</h3><p>Approval publishes the property for student discovery. Request changes to return it to the landlord’s drafts.</p></div><label>Feedback for the landlord<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Required if you request changes" /></label><div className="property-decision-actions"><button className="dashboard-primary-action" disabled={saving} onClick={() => void makeDecision("APPROVED")}>{saving ? "Saving…" : "Approve and publish"}</button><button className="property-request-changes" disabled={saving || !notes.trim()} onClick={() => void makeDecision("REJECTED")}>{saving ? "Saving…" : "Request changes"}</button></div></section>
          </section>}
        </div>}
      </main>
    </div>
  </div>;
}

export default AdminProperties;
