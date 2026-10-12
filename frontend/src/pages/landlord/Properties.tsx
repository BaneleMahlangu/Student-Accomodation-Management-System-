import LandlordNavigation from "../../components/LandlordNavigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import "../../App.css";
import {
  createManagedBed,
  createManagedBuilding,
  createManagedFloor,
  createManagedProperty,
  createManagedRoom,
  deleteManagedPropertyImage,
  getAccommodationManagementOptions,
  getCurrentUser,
  getMediaUrl,
  getLandlordProperties,
  submitManagedProperty,
  updateManagedProperty,
  updateManagedStructure,
  uploadManagedPropertyImage,
} from "../../services/api";
import type {
  AccommodationManagementOptions,
  CurrentUser,
  ManagedBed,
  ManagedBuilding,
  ManagedFloor,
  ManagedProperty,
  ManagedRoom,
  PropertyManagementPayload,
} from "../../services/api";
import { formatRoomBedAvailability } from "../../utils/roomBedAvailability";

const emptyProperty: PropertyManagementPayload = {
  name: "",
  property_type: "STUDENT_RESIDENCE",
  description: "",
  virtual_tour_url: "",
  address: "",
  latitude: null,
  longitude: null,
  campus: 0,
  distance_from_campus_km: "",
  walking_minutes: null,
  monthly_min_price: "",
  monthly_max_price: "",
  amenities: [],
};

const roomStatusOptions = ["AVAILABLE", "MAINTENANCE", "BLOCKED", "CLEANING", "UNAVAILABLE"];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function campusDistance(latitude: number | null, longitude: number | null, campus: AccommodationManagementOptions["campuses"][number] | undefined) {
  if (latitude === null || longitude === null || !campus?.latitude || !campus.longitude) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = radians(latitude);
  const lat2 = radians(Number(campus.latitude));
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(Number(campus.longitude) - longitude);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const distance = 6371.0088 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return { distance: distance.toFixed(2), walkingMinutes: Math.max(1, Math.round(distance * 12.5)) };
}

function StatusPill({ status }: { status: string }) {
  const label = status.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  const title = status === "OCCUPIED"
    ? "All beds in this room are occupied."
    : status === "RESERVED"
      ? "All beds in this room are reserved."
      : undefined;
  return <span title={title} className={`property-status-pill property-status-${status.toLowerCase()}`}>{label}</span>;
}

function AddBuildingForm({ onCreate }: { onCreate: (payload: { name: string; description: string; number_of_floors: number }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [numberOfFloors, setNumberOfFloors] = useState(1);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onCreate({ name, description, number_of_floors: numberOfFloors });
      setName(""); setDescription(""); setNumberOfFloors(1);
    } finally { setSaving(false); }
  }
  return <form className="property-inline-form property-inline-form-building" onSubmit={submit}>
    <strong>Add a building</strong>
    <input required aria-label="Building name" placeholder="Building name" value={name} onChange={(e) => setName(e.target.value)} />
    <input aria-label="Building description" placeholder="Optional description" value={description} onChange={(e) => setDescription(e.target.value)} />
    <label>Floors planned <input type="number" min={1} value={numberOfFloors} onChange={(e) => setNumberOfFloors(Number(e.target.value))} /></label>
    <button className="dashboard-primary-action" disabled={saving || !name.trim()}>{saving ? "Adding…" : "Add building"}</button>
  </form>;
}

function AddFloorForm({ onCreate }: { onCreate: (payload: { floor_number: number; name: string }) => Promise<void> }) {
  const [floorNumber, setFloorNumber] = useState(0);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try { await onCreate({ floor_number: floorNumber, name }); setFloorNumber(0); setName(""); }
    finally { setSaving(false); }
  }
  return <form className="property-inline-form" onSubmit={submit}>
    <strong>Add a floor</strong>
    <label>Floor number <input type="number" value={floorNumber} onChange={(e) => setFloorNumber(Number(e.target.value))} /></label>
    <input aria-label="Floor name" placeholder="Optional label (e.g. Ground floor)" value={name} onChange={(e) => setName(e.target.value)} />
    <button className="dashboard-secondary-action" disabled={saving}>{saving ? "Adding…" : "Add floor"}</button>
  </form>;
}

function AddRoomForm({ options, onCreate }: { options: AccommodationManagementOptions; onCreate: (payload: { room_number: string; room_type: number; capacity: number; monthly_price: string; status: string; is_accessible: boolean; description: string }) => Promise<void> }) {
  const firstType = options.room_types[0];
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState(firstType ? String(firstType.id) : "");
  const [capacity, setCapacity] = useState(firstType?.default_capacity ?? 1);
  const [price, setPrice] = useState(firstType?.default_monthly_price ?? "");
  const [accessible, setAccessible] = useState(false);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      await onCreate({ room_number: roomNumber, room_type: Number(roomType), capacity, monthly_price: price, status: "AVAILABLE", is_accessible: accessible, description: "" });
      setRoomNumber(""); setAccessible(false);
    } finally { setSaving(false); }
  }
  return <form className="property-inline-form property-inline-form-room" onSubmit={submit}>
    <strong>Add a room</strong>
    <input required aria-label="Room number" placeholder="Room number" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
    <select aria-label="Room type" required value={roomType} onChange={(e) => {
      setRoomType(e.target.value);
      const selected = options.room_types.find((item) => item.id === Number(e.target.value));
      if (selected) { setCapacity(selected.default_capacity); setPrice(selected.default_monthly_price ?? ""); }
    }}>
      {options.room_types.length === 0 && <option value="">Add room types in the accommodation data first</option>}
      {options.room_types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
    </select>
    <label>Capacity <input required type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} /></label>
    <label>Monthly price (R) <input required type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
    <label className="property-checkbox"><input type="checkbox" checked={accessible} onChange={(e) => setAccessible(e.target.checked)} /> Accessible</label>
    <button className="dashboard-secondary-action" disabled={saving || !roomType}>{saving ? "Adding…" : "Add room"}</button>
  </form>;
}

function AddBedForm({ room, onCreate }: { room: ManagedRoom; onCreate: (payload: { bed_number: string; status: "AVAILABLE" | "BLOCKED" }) => Promise<void> }) {
  const [bedNumber, setBedNumber] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try { await onCreate({ bed_number: bedNumber, status: "AVAILABLE" }); setBedNumber(""); }
    finally { setSaving(false); }
  }
  return <form className="property-add-bed" onSubmit={submit}>
    <input required aria-label={`New bed number for room ${room.room_number}`} placeholder="Bed number" value={bedNumber} onChange={(e) => setBedNumber(e.target.value)} />
    <button className="property-text-button" disabled={saving || room.beds.length >= room.capacity}>{saving ? "Adding…" : "Add bed"}</button>
    {room.beds.length >= room.capacity && <small>Room capacity reached</small>}
  </form>;
}

function BedRow({ bed, onStatus }: { bed: ManagedBed; onStatus: (status: "AVAILABLE" | "BLOCKED") => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  async function change(status: "AVAILABLE" | "BLOCKED") {
    setSaving(true); try { await onStatus(status); } finally { setSaving(false); }
  }
  const locked = bed.status === "RESERVED" || bed.status === "OCCUPIED";
  return <div className="property-bed-row"><span>Bed {bed.bed_number}</span>
    {locked ? <StatusPill status={bed.status} /> : <select aria-label={`Availability for bed ${bed.bed_number}`} value={bed.status} disabled={saving} onChange={(e) => void change(e.target.value as "AVAILABLE" | "BLOCKED")}><option value="AVAILABLE">Available</option><option value="BLOCKED">Blocked</option></select>}
  </div>;
}

function RoomCard({ room, onCreateBed, onStatus, onBedStatus }: {
  room: ManagedRoom;
  onCreateBed: (payload: { bed_number: string; status: "AVAILABLE" | "BLOCKED" }) => Promise<void>;
  onStatus: (status: string) => Promise<void>;
  onBedStatus: (bedId: number, status: "AVAILABLE" | "BLOCKED") => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const locked = room.status === "RESERVED" || room.status === "OCCUPIED";
  async function changeStatus(status: string) { setSaving(true); try { await onStatus(status); } finally { setSaving(false); } }
  return <div className="property-room-card">
    <div className="property-room-heading"><div><strong>Room {room.room_number}</strong><span className="property-room-availability">{room.room_type_name} · R{Number(room.monthly_price).toLocaleString("en-ZA")} / month · {formatRoomBedAvailability(room)}</span></div>
      {locked ? <StatusPill status={room.status} /> : <select aria-label={`Availability for room ${room.room_number}`} value={room.status} disabled={saving} onChange={(e) => void changeStatus(e.target.value)}>{roomStatusOptions.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>}
    </div>
    <div className="property-room-beds">{room.beds.map((bed) => <BedRow key={bed.id} bed={bed} onStatus={(status) => onBedStatus(bed.id, status)} />)}
      {room.beds.length === 0 && <span className="property-muted">No beds added yet.</span>}
    </div>
    <AddBedForm room={room} onCreate={onCreateBed} />
    {room.beds.length < room.capacity && <small className="property-capacity-hint">Add {room.capacity - room.beds.length} more bed{room.capacity - room.beds.length === 1 ? "" : "s"} to match this room’s capacity.</small>}
    <span className="property-room-access">{room.is_accessible ? "Accessible room" : "Standard access"}</span>
  </div>;
}

function FloorSection({ floor, options, run }: { floor: ManagedFloor; options: AccommodationManagementOptions; run: (message: string, action: () => Promise<void>) => Promise<void> }) {
  return <section className="property-floor">
    <div className="property-floor-heading"><h4>{floor.name || (floor.floor_number === 0 ? "Ground floor" : `Floor ${floor.floor_number}`)}</h4><span>{floor.rooms.length} rooms</span></div>
    <div className="property-rooms-list">{floor.rooms.map((room) => <RoomCard key={room.id} room={room}
      onCreateBed={(payload) => run("Bed added.", () => createManagedBed(room.id, payload))}
      onStatus={(status) => run("Availability updated.", () => updateManagedStructure("room", room.id, { status }))}
      onBedStatus={(bedId, status) => run("Availability updated.", () => updateManagedStructure("bed", bedId, { status }))} />)}</div>
    {options.room_types.length === 0 ? <p className="property-inline-note">Room types are not set up yet. Ask an administrator to add room types before you add rooms.</p> :
      <AddRoomForm options={options} onCreate={(payload) => run("Room added.", () => createManagedRoom(floor.id, payload))} />}
  </section>;
}

function BuildingSection({ building, options, run }: { building: ManagedBuilding; options: AccommodationManagementOptions; run: (message: string, action: () => Promise<void>) => Promise<void> }) {
  return <section className="property-building">
    <div className="property-building-heading"><div><h3>{building.name}</h3><p>{building.description || `${building.number_of_floors} floors planned`}</p></div><span>{building.floors.length} floors</span></div>
    {building.floors.map((floor) => <FloorSection key={floor.id} floor={floor} options={options} run={run} />)}
    <AddFloorForm onCreate={(payload) => run("Floor added.", () => createManagedFloor(building.id, payload))} />
  </section>;
}

function Properties() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [options, setOptions] = useState<AccommodationManagementOptions | null>(null);
  const [properties, setProperties] = useState<ManagedProperty[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<PropertyManagementPayload>(emptyProperty);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageCategory, setImageCategory] = useState("EXTERIOR");
  const [imageCaption, setImageCaption] = useState("");
  const [imageSaving, setImageSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedProperty = useMemo(() => properties.find((item) => item.id === selectedId) ?? null, [properties, selectedId]);
  const currentCampus = options?.campuses.find((campus) => campus.id === form.campus);
  const calculatedDistance = campusDistance(form.latitude, form.longitude, currentCampus);

  async function loadPage() {
    setLoading(true); setError("");
    try {
      const [currentUser, catalog, landlordProperties] = await Promise.all([
        getCurrentUser(), getAccommodationManagementOptions(), getLandlordProperties(),
      ]);
      setUser(currentUser); setOptions(catalog); setProperties(landlordProperties);
      if (selectedId && landlordProperties.some((item) => item.id === selectedId)) {
        const item = landlordProperties.find((entry) => entry.id === selectedId)!;
        setForm({ name: item.name, property_type: item.property_type, description: item.description, virtual_tour_url: item.virtual_tour_url ?? "", address: item.address, latitude: item.latitude === null ? null : Number(item.latitude), longitude: item.longitude === null ? null : Number(item.longitude), campus: item.campus, distance_from_campus_km: item.distance_from_campus_km ?? "", walking_minutes: item.walking_minutes, monthly_min_price: item.monthly_min_price ?? "", monthly_max_price: item.monthly_max_price ?? "", amenities: item.amenities.map((amenity) => amenity.id) });
      }
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadPage(); }, []);

  function openProperty(property: ManagedProperty) {
    setSelectedId(property.id); setCreating(false); setFeedback("");
    setForm({ name: property.name, property_type: property.property_type, description: property.description, virtual_tour_url: property.virtual_tour_url ?? "", address: property.address, latitude: property.latitude === null ? null : Number(property.latitude), longitude: property.longitude === null ? null : Number(property.longitude), campus: property.campus, distance_from_campus_km: property.distance_from_campus_km ?? "", walking_minutes: property.walking_minutes, monthly_min_price: property.monthly_min_price ?? "", monthly_max_price: property.monthly_max_price ?? "", amenities: property.amenities.map((amenity) => amenity.id) });
  }

  function startNewProperty() {
    setSelectedId(null); setCreating(true); setFeedback("");
    setForm({ ...emptyProperty, campus: options?.campuses[0]?.id ?? 0 });
  }

  function updateCoordinates(field: "latitude" | "longitude", value: number | null) {
    const latitude = field === "latitude" ? value : form.latitude;
    const longitude = field === "longitude" ? value : form.longitude;
    const metrics = campusDistance(latitude, longitude, currentCampus);
    setForm((current) => ({
      ...current,
      [field]: value,
      distance_from_campus_km: metrics?.distance ?? "",
      walking_minutes: metrics?.walkingMinutes ?? null,
    }));
  }

  function updateCampus(campusId: number) {
    const campus = options?.campuses.find((item) => item.id === campusId);
    const metrics = campusDistance(form.latitude, form.longitude, campus);
    setForm((current) => ({
      ...current,
      campus: campusId,
      distance_from_campus_km: metrics?.distance ?? "",
      walking_minutes: metrics?.walkingMinutes ?? null,
    }));
  }

  async function saveProperty(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setFeedback("");
    try {
      const saved = selectedProperty ? await updateManagedProperty(selectedProperty.id, form) : await createManagedProperty(form);
      const updated = await getLandlordProperties();
      setProperties(updated); setSelectedId(saved.id); setCreating(false);
      const item = updated.find((property) => property.id === saved.id) ?? saved;
      openProperty(item); setFeedback("Property details saved.");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setSaving(false); }
  }

  async function run(message: string, action: () => Promise<void>) {
    setError(""); setFeedback("");
    try { await action(); await loadPage(); setFeedback(message); }
    catch (caught) { setError(errorMessage(caught)); }
  }

  async function uploadImage(event: FormEvent) {
    event.preventDefault();
    if (!selectedProperty || !imageFile) return;
    setImageSaving(true); setError(""); setFeedback("");
    try {
      await uploadManagedPropertyImage(selectedProperty.id, imageFile, { category: imageCategory, caption: imageCaption, is_primary: selectedProperty.images.length === 0 });
      setImageFile(null); setImageCaption("");
      const picker = document.getElementById("property-image-upload") as HTMLInputElement | null;
      if (picker) picker.value = "";
      await loadPage(); setFeedback("Property photo uploaded.");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setImageSaving(false); }
  }

  async function submitForReview() {
    if (!selectedProperty) return;
    setSubmitting(true); setError(""); setFeedback("");
    try { await submitManagedProperty(selectedProperty.id); await loadPage(); setFeedback("Property submitted for administrator review."); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setSubmitting(false); }
  }

  const verificationStatus = user?.landlord_profile?.verification_status ?? "PENDING";

  return <div className="landlord-dashboard-page property-management-page">
    <header className="landlord-header">
      <Link to="/landlord/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Landlord Portal</span></div></Link>
      <div className="landlord-header-user"><span>{user ? `${user.first_name} ${user.last_name}` : "Landlord"}</span><StatusPill status={verificationStatus} /></div>
    </header>
    <div className="landlord-layout">
      <LandlordNavigation />
      <main className="landlord-content property-management-content">
        <section className="landlord-welcome property-management-title"><div><span className="eyebrow">PROPERTY MANAGEMENT</span><h1>Your properties</h1><p>Build and maintain each listing from the property down to its beds.</p></div><button className="dashboard-primary-action" onClick={startNewProperty}>＋ Add property</button></section>
        {verificationStatus !== "VERIFIED" && <div className="landlord-verification-banner"><div><strong>Landlord verification is {verificationStatus.toLowerCase()}</strong><p>You can save property drafts now. StudentHaven must verify your landlord profile before you submit a property for review.</p></div><Link to="/landlord/profile">View profile</Link></div>}
        {error && <div className="property-alert property-alert-error" role="alert"><strong>We couldn’t complete that action.</strong><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}
        {feedback && <div className="property-alert property-alert-success" role="status">{feedback}</div>}

        <div className="property-management-grid">
          <section className="property-list-panel"><div className="property-panel-heading"><div><span className="eyebrow">PORTFOLIO</span><h2>Listings</h2></div><span>{properties.length} total</span></div>
            {loading ? <div className="property-empty-state">Loading your properties…</div> : properties.length === 0 ? <div className="property-empty-state"><div className="property-empty-icon">⌂</div><h3>No properties yet</h3><p>Add your first property, then build its buildings, floors, rooms and beds.</p><button className="dashboard-primary-action" onClick={startNewProperty}>Add your first property</button></div> :
              <div className="property-list">{properties.map((property) => <button key={property.id} className={`property-list-card ${selectedId === property.id ? "selected" : ""}`} onClick={() => openProperty(property)}>
                <div className="property-list-card-top"><strong>{property.name}</strong><StatusPill status={property.status} /></div><span>{property.campus_name} · {property.university_name}</span><small>{property.total_rooms} rooms · {property.total_beds} beds · {property.available_beds} available</small>{property.status === "REJECTED" && <small className="property-rejection-note">Changes requested: {property.verification_notes}</small>}
              </button>)}</div>}
          </section>

          {(creating || selectedProperty) && options && <section className="property-editor-panel">
            <div className="property-panel-heading"><div><span className="eyebrow">{creating ? "NEW LISTING" : `PROPERTY ${selectedProperty?.id}`}</span><h2>{creating ? "Property details" : selectedProperty?.name}</h2></div>{!creating && selectedProperty && <StatusPill status={selectedProperty.status} />}</div>
            <form className="property-editor-form" onSubmit={saveProperty}>
              <label>Property name<input required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Campus View Residence" /></label>
              <div className="property-form-row"><label>Property type<select value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}>{options.property_types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label>Nearest campus<select required value={form.campus || ""} onChange={(e) => updateCampus(Number(e.target.value))}><option value="" disabled>Select a campus</option>{options.campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name} · {campus.university}</option>)}</select></label></div>
              <label>Street address<textarea required rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
              <div className="property-form-row"><label>Latitude<input type="number" min="-90" max="90" step="0.0000001" value={form.latitude ?? ""} onChange={(e) => updateCoordinates("latitude", e.target.value ? Number(e.target.value) : null)} /></label><label>Longitude<input type="number" min="-180" max="180" step="0.0000001" value={form.longitude ?? ""} onChange={(e) => updateCoordinates("longitude", e.target.value ? Number(e.target.value) : null)} /></label></div>
              <small className="property-inline-note">Enter the property’s map pin. Campus distance and walking time update from the coordinates; use an approximate pin only if the exact location is unavailable.</small>
              <label>Property description<textarea required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the accommodation and who it is suitable for." /></label>
              <label>Virtual tour link (optional)<input type="url" inputMode="url" placeholder="https://…" value={form.virtual_tour_url} onChange={(e) => setForm({ ...form, virtual_tour_url: e.target.value })} /><small className="property-inline-note">Use a public HTTPS video or 360° tour link that students can open.</small></label>
              <div className="property-form-row"><label>Distance from campus (km)<input type="number" min="0" step="0.01" value={calculatedDistance?.distance ?? form.distance_from_campus_km} readOnly={Boolean(calculatedDistance)} onChange={(e) => setForm({ ...form, distance_from_campus_km: e.target.value })} /></label><label>Walking time (minutes)<input type="number" min="0" value={form.walking_minutes ?? ""} readOnly={Boolean(calculatedDistance)} onChange={(e) => setForm({ ...form, walking_minutes: e.target.value ? Number(e.target.value) : null })} /></label></div>
              <div className="property-form-row"><label>Starting monthly price (R)<input type="number" min="0" step="0.01" value={form.monthly_min_price ?? ""} onChange={(e) => setForm({ ...form, monthly_min_price: e.target.value || null })} /></label><label>Highest monthly price (R)<input type="number" min="0" step="0.01" value={form.monthly_max_price ?? ""} onChange={(e) => setForm({ ...form, monthly_max_price: e.target.value || null })} /></label></div>
              <fieldset className="property-amenity-fieldset"><legend>Amenities</legend><div>{options.amenities.map((amenity) => <label key={amenity.id} className="property-checkbox"><input type="checkbox" checked={form.amenities.includes(amenity.id)} onChange={(e) => setForm({ ...form, amenities: e.target.checked ? [...form.amenities, amenity.id] : form.amenities.filter((id) => id !== amenity.id) })} />{amenity.name}</label>)}</div></fieldset>
              {options.campuses.length === 0 && <p className="property-inline-note">No campus choices are available yet. Add universities and campuses before creating a listing.</p>}
              <button className="dashboard-primary-action" disabled={saving || options.campuses.length === 0}>{saving ? "Saving…" : creating ? "Create property draft" : "Save property details"}</button>
            </form>

            {!creating && selectedProperty && <>
              <section className="property-subsection"><div className="property-subsection-heading"><div><h3>Property photos</h3><p>At least one photo is required before review.</p></div><span>{selectedProperty.images.length} photos</span></div>
                {selectedProperty.images.length > 0 && <div className="property-photo-strip">{selectedProperty.images.map((image) => <div key={image.id} className="property-photo-item"><img src={getMediaUrl(image.image)} alt={image.caption || selectedProperty.name} /><span>{image.is_primary ? "Cover photo" : image.category.toLowerCase()}</span><button aria-label={`Remove ${image.caption || image.category.toLowerCase()} photo`} onClick={() => void run("Photo removed.", () => deleteManagedPropertyImage(selectedProperty.id, image.id))}>×</button></div>)}</div>}
                <form className="property-image-form" onSubmit={uploadImage}><label className="property-file-picker">Choose a photo<input id="property-image-upload" type="file" accept="image/*" required onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} /></label><select aria-label="Photo category" value={imageCategory} onChange={(e) => setImageCategory(e.target.value)}><option value="EXTERIOR">Exterior</option><option value="ROOM">Room</option><option value="KITCHEN">Kitchen</option><option value="LOUNGE">Lounge</option><option value="STUDY">Study area</option><option value="SECURITY">Security</option><option value="OTHER">Other</option></select><input aria-label="Photo caption" placeholder="Caption (optional)" value={imageCaption} onChange={(e) => setImageCaption(e.target.value)} /><button className="dashboard-secondary-action" disabled={imageSaving || !imageFile}>{imageSaving ? "Uploading…" : "Upload photo"}</button></form>
              </section>

              <section className="property-subsection"><div className="property-subsection-heading"><div><h3>Buildings, rooms & beds</h3><p>Room status updates as beds are reserved, occupied, or made available.</p></div><div className="property-inventory-counts"><span>{selectedProperty.total_rooms} rooms</span><span>{selectedProperty.total_beds} beds</span></div></div>
                {selectedProperty.buildings.map((building) => <BuildingSection key={building.id} building={building} options={options} run={run} />)}
                <AddBuildingForm onCreate={(payload) => run("Building added.", () => createManagedBuilding(selectedProperty.id, payload))} />
              </section>

              <section className="property-submit-panel"><div><span className="eyebrow">LISTING REVIEW</span><h3>{selectedProperty.status === "PENDING" ? "Waiting for administrator review" : selectedProperty.status === "APPROVED" ? "This property is published" : "Ready to request approval?"}</h3><p>{selectedProperty.status === "PENDING" ? "You’ll see the result here after an administrator reviews the listing." : selectedProperty.status === "APPROVED" ? "Students can discover this property while it remains approved." : selectedProperty.status === "REJECTED" && selectedProperty.verification_notes ? `Requested changes: ${selectedProperty.verification_notes}` : "Submit when the details, photo and room inventory are complete."}</p>{selectedProperty.status === "APPROVED" && selectedProperty.approved_at && <small>Approved at: {new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(selectedProperty.approved_at))} UTC</small>}</div>
                {selectedProperty.status !== "PENDING" && selectedProperty.status !== "APPROVED" && <button className="dashboard-primary-action" onClick={() => void submitForReview()} disabled={submitting || verificationStatus !== "VERIFIED"}>{submitting ? "Submitting…" : "Submit for approval"}</button>}
                {verificationStatus !== "VERIFIED" && selectedProperty.status !== "APPROVED" && <small>Landlord verification is required to submit.</small>}
              </section>
            </>}
          </section>}
        </div>
        {!loading && !creating && !selectedProperty && properties.length > 0 && <div className="property-select-hint">Choose a listing to edit its details, photos and room inventory.</div>}
      </main>
    </div>
  </div>;
}

export default Properties;
