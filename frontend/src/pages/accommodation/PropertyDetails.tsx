import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DashboardLink from "../../components/DashboardLink";
import {
  Accessibility,
  Armchair,
  BatteryCharging,
  BookOpen,
  Bus,
  Camera,
  Car,
  Check,
  CookingPot,
  Dumbbell,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Tv,
  Trees,
  Utensils,
  UserRoundCog,
  WashingMachine,
  Waves,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import "../../App.css";
import PropertyReviews from "../../components/PropertyReviews";
import { cleanAccommodationCaption, getFallbackPropertyImages, getRoomGalleryImages, isTemporaryPexelsCaption } from "../../data/accommodationImages";
import { formatRoomBedAvailability } from "../../utils/roomBedAvailability";

import {
  getMediaUrl,
  getProperty,
} from "../../services/api";

import type { Property } from "../../services/api";

type GalleryTab = "ACCOMMODATION" | "ROOMS" | "FACILITIES";

interface GalleryItem {
  id: string;
  image: string;
  caption: string;
}

const AMENITY_ICONS: Record<string, LucideIcon> = {
  "high-speed wi-fi": Wifi,
  "24/7 security": ShieldCheck,
  cctv: Camera,
  "controlled access": KeyRound,
  laundry: WashingMachine,
  "study area": BookOpen,
  "study rooms": BookOpen,
  "common lounge": Armchair,
  "swimming pool": Waves,
  gym: Dumbbell,
  parking: Car,
  "backup power": BatteryCharging,
  kitchen: CookingPot,
  "dining area": Utensils,
  "tv lounge": Tv,
  transport: Bus,
  "on-site manager": UserRoundCog,
  "cleaning service": Sparkles,
  "wheelchair accessible": Accessibility,
  "outdoor area": Trees,
};

function PropertyDetails() {
  const { id } = useParams();

  const [property, setProperty] =
    useState<Property | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [galleryTab, setGalleryTab] =
    useState<GalleryTab>("ACCOMMODATION");

  const [selectedImage, setSelectedImage] =
    useState<string | null>(null);

  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const galleryLengthRef = useRef(1);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (selectedImageIndex === null) return;
    function handleGalleryKeys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedImageIndex(null);
        setSelectedImage(null);
      } else if (event.key === "ArrowRight") {
        setSelectedImageIndex((current) => current === null ? null : (current + 1) % galleryLengthRef.current);
      } else if (event.key === "ArrowLeft") {
        setSelectedImageIndex((current) => current === null ? null : (current - 1 + galleryLengthRef.current) % galleryLengthRef.current);
      }
    }
    window.addEventListener("keydown", handleGalleryKeys);
    return () => window.removeEventListener("keydown", handleGalleryKeys);
  }, [selectedImageIndex]);

  useEffect(() => {
    async function loadProperty() {
      if (!id) {
        setError("Property not found.");
        setLoading(false);
        return;
      }

      try {
        const result = await getProperty(
          Number(id)
        );

        setProperty(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load property."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProperty();
  }, [id]);

  if (loading) {
    return (
      <div className="property-details-page">
        <div className="property-details-loading">
          Loading property...
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="property-details-page">
        <div className="property-details-error">
          <h2>
            Unable to load property
          </h2>

          <p>
            {error ||
              "The requested property could not be found."}
          </p>

          <Link
            to="/accommodation"
            className="primary-button"
          >
            Back to accommodation
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // ACCOMMODATION IMAGE
  // ---------------------------------------------------------

  const fallbackPropertyImages = getFallbackPropertyImages(property.id);
  const suppliedPropertyImages = property.images.filter((image) => !isTemporaryPexelsCaption(image.caption));
  const propertyImages = suppliedPropertyImages.length > 0
    ? suppliedPropertyImages
    : fallbackPropertyImages.map((image, index) => ({
      id: `fallback-${property.id}-${index}`,
      image: image.url,
      category: index === 0 ? "ACCOMMODATION" : index === 1 ? "ROOM" : image.category === "Study Area" ? "STUDY" : image.category.toUpperCase(),
      caption: image.caption,
      display_order: index,
    }));
  const accommodationImages = propertyImages.filter((image) => image.category === "ACCOMMODATION");
  const accommodationGallery = accommodationImages.length > 0 ? accommodationImages : propertyImages.slice(0, 1);

  // ---------------------------------------------------------
  // FACILITY IMAGES
  // Anything that is not the main accommodation image
  // is treated as a facility image.
  // ---------------------------------------------------------

  const facilityImages =
    propertyImages.filter(
      (image) =>
        image.category !== "ACCOMMODATION" && image.category !== "ROOM"
    );

  // ---------------------------------------------------------
  // ROOM IMAGES
  // Build a gallery from the actual rooms belonging
  // to this property.
  // ---------------------------------------------------------

  const roomGalleryItems: GalleryItem[] = property.rooms.flatMap((room) =>
    getRoomGalleryImages(property.id, room.id, room.images).map((image, index) => ({
      id: `room-${room.id}-${index}`,
      image: image.url,
      caption: image.caption,
    }))
  );
  const roomGallery = roomGalleryItems.filter((image, index, images) =>
    images.findIndex((candidate) => candidate.image === image.image) === index
  );

  // ---------------------------------------------------------
  // CURRENT GALLERY
  // ---------------------------------------------------------

  let galleryItems: GalleryItem[] = [];

  if (
    galleryTab === "ACCOMMODATION" &&
    accommodationGallery.length > 0
  ) {
    galleryItems = accommodationGallery.map((image) => ({
        id: `property-${image.id}`,
        image: image.image,
        caption: cleanAccommodationCaption(image.category, image.caption || `${property.name} accommodation`),
      }));
  }

  if (galleryTab === "ROOMS") {
    galleryItems = roomGallery;
  }

  if (galleryTab === "FACILITIES") {
    galleryItems = facilityImages.map(
      (image) => ({
        id: `facility-${image.id}`,
        image: image.image,
        caption: cleanAccommodationCaption(image.category, image.caption || "Student accommodation facility"),
      })
    );
  }

  galleryLengthRef.current = Math.max(1, galleryItems.length);
  const mainGalleryImage = galleryItems[galleryIndex] ?? galleryItems[0] ?? null;
  const currentLightboxIndex = selectedImageIndex ?? 0;

  return (
    <div className="property-details-page">

      {/* -------------------------------------------------
          HEADER
      ------------------------------------------------- */}

      <header className="accommodation-header">

        <Link
          to="/accommodation"
          className="accommodation-brand"
        >
          <img
            src="/SH-logo.jpg"
            alt="StudentHaven"
          />

          <div>
            <strong>
              StudentHaven
            </strong>

            <span>
              Accommodation
            </span>
          </div>
        </Link>

        <DashboardLink className="dashboard-logout" />

      </header>


      <main className="property-details-content">

        <Link
          to="/accommodation"
          className="back-link"
        >
          ← Back to accommodation
        </Link>


        {/* -------------------------------------------------
            PROPERTY GALLERY
        ------------------------------------------------- */}

        <section className="student-property-gallery">

          {/* CATEGORY TABS */}

          <div className="student-gallery-tabs">

            <button
              type="button"
              className={
                galleryTab === "ACCOMMODATION"
                  ? "student-gallery-tab active"
                  : "student-gallery-tab"
              }
              onClick={() => { setGalleryTab("ACCOMMODATION"); setGalleryIndex(0); }}
            >
              Accommodation
            </button>

            <button
              type="button"
              className={
                galleryTab === "ROOMS"
                  ? "student-gallery-tab active"
                  : "student-gallery-tab"
              }
              onClick={() => { setGalleryTab("ROOMS"); setGalleryIndex(0); }}
            >
              Rooms
            </button>

            <button
              type="button"
              className={
                galleryTab === "FACILITIES"
                  ? "student-gallery-tab active"
                  : "student-gallery-tab"
              }
              onClick={() => { setGalleryTab("FACILITIES"); setGalleryIndex(0); }}
            >
              Facilities
            </button>

          </div>


          {/* MAIN IMAGE */}

          {galleryTab !== "ROOMS" ? (

            <div className="student-gallery-main">

              {mainGalleryImage ? (

                <button
                  type="button"
                  className="student-gallery-image-button"
                  onClick={() => { setSelectedImage(getMediaUrl(mainGalleryImage.image)); setSelectedImageIndex(galleryItems.findIndex((item) => item.id === mainGalleryImage.id)); }}
                >
                  <img
                    src={getMediaUrl(
                      mainGalleryImage.image
                    )}
                    alt={
                      mainGalleryImage.caption
                    }
                    className="student-gallery-main-image"
                  />

                  <span className="student-gallery-overlay">
                    View image
                  </span>
                </button>

              ) : (

                <div className="student-gallery-empty">
                  <strong>
                    No images available
                  </strong>

                  <span>
                    Images for this section
                    are not available yet.
                  </span>
                </div>

              )}

            </div>

          ) : (

            /* ------------------------------------------------
               ROOMS GALLERY
            ------------------------------------------------ */

            <div className="student-room-gallery">

              {property.rooms.length === 0 ? (

                <div className="student-gallery-empty">
                  <strong>
                    No rooms available
                  </strong>

                  <span>
                    This property currently
                    has no room information.
                  </span>
                </div>

              ) : (

                property.rooms.map((room) => {

                  const roomImage = getRoomGalleryImages(property.id, room.id, room.images)[0];

                  return (
                    <article
                      key={room.id}
                      className="student-property-room-card"
                    >

                      <div className="student-property-room-image">

                        {roomImage ? (

                          <button type="button" className="student-room-image-trigger" aria-label={`Open photos for room ${room.room_number}`} onClick={() => {
                            const index = galleryItems.findIndex((item) => item.image === roomImage.url);
                            setSelectedImage(roomImage.url);
                            setSelectedImageIndex(index >= 0 ? index : 0);
                          }}>
                            <img src={roomImage.url} alt={roomImage.caption || `Room ${room.room_number}`} />
                            <span>View room photos</span>
                          </button>

                        ) : (

                          <div className="student-room-image-empty">
                            No image
                          </div>

                        )}

                      </div>


                      <div className="student-property-room-content">

                        <div className="student-property-room-heading">

                          <div>
                            <span className="eyebrow">
                              ROOM
                            </span>

                            <h3>
                              {room.room_number}
                            </h3>
                          </div>

                          <span className="room-status">
                            {room.status}
                          </span>

                        </div>


                        <p className="student-property-room-type">
                          {room.room_type}
                        </p>


                        <div className="student-property-room-details">
                          <span>{formatRoomBedAvailability(room)}</span>

                        </div>


                        <div className="student-property-room-price">

                          R
                          {Number(
                            room.monthly_price
                          ).toLocaleString()}

                          <span>
                            /month
                          </span>

                        </div>


                        <Link
                          to={`/accommodation/${property.id}/rooms/${room.id}`}
                          className="property-view-button"
                        >
                          View room
                        </Link>

                      </div>

                    </article>
                  );
                })

              )}

            </div>

          )}


          {/* -------------------------------------------------
              FACILITY / ACCOMMODATION THUMBNAILS
          ------------------------------------------------- */}

          {galleryTab !== "ROOMS" &&
            galleryItems.length > 0 && (

              <div className="student-gallery-thumbnails">

                {galleryItems.map(
                  (item, index) => (

                    <button
                      key={item.id}
                      type="button"
                      className="student-gallery-thumbnail"
                      aria-label={`Select photo ${index + 1}: ${item.caption}`}
                      aria-pressed={galleryIndex === index}
                      onClick={() => setGalleryIndex(index)}
                    >
                      <img
                        src={getMediaUrl(
                          item.image
                        )}
                        alt={item.caption}
                      />
                    </button>

                  )
                )}

              </div>

            )}

        </section>


        {/* -------------------------------------------------
            PROPERTY HEADER
        ------------------------------------------------- */}

        <section className="property-details-header">

          <div>

            <span className="eyebrow">
              {property.property_type.replace(
                /_/g,
                " "
              )}
            </span>

            <h1>
              {property.name}
            </h1>

            <p className="property-address">
              {property.address}
            </p>

            <div className="property-details-location">

              <span>{property.distance_from_campus_km ? `${property.distance_from_campus_km} km from campus` : "Campus distance not listed"}</span>

              <span>{property.walking_minutes === null ? "Walking time not listed" : `${property.walking_minutes} min walk`}</span>

              <Link to={`/accommodation/${property.id}/reviews`}>
                {property.rating ? `★ ${property.rating} · ${property.review_count} resident review${property.review_count === 1 ? "" : "s"}` : "Not yet rated"}
              </Link>

            </div>

          </div>


          <div className="property-details-price">

            {property.monthly_min_price ? <><span>From</span><strong>R{Number(property.monthly_min_price).toLocaleString()}</strong><small>/month</small></> : <><span>Pricing</span><strong>Contact property</strong></>}

          </div>

        </section>


        {/* -------------------------------------------------
            PROPERTY INFORMATION
        ------------------------------------------------- */}

        <section className="property-details-grid">

          <div className="property-main-column">

            <div className="property-info-section">

              <h2>
                About this residence
              </h2>

              <p>
                {property.description}
              </p>

              {property.virtual_tour_url && <a className="property-virtual-tour-link" href={property.virtual_tour_url} target="_blank" rel="noopener noreferrer">View the virtual tour ↗</a>}

            </div>


            <div className="property-info-section">

              <h2>
                Amenities
              </h2>

              <div className="amenity-grid">

                {property.amenities.map(
                  (amenity) => {
                    const AmenityIcon = AMENITY_ICONS[amenity.name.toLowerCase()] ?? Check;
                    return (
                      <div className="amenity-item" key={amenity.id}>
                        <span className="amenity-icon">
                          <AmenityIcon size={16} strokeWidth={2} aria-hidden="true" />
                        </span>
                        <span>{amenity.name}</span>
                      </div>
                    );
                  }
                )}

              </div>

            </div>


            <div className="property-info-section">

              <h2>
                Availability
              </h2>

              <div className="availability-summary">

                <div>
                  <strong>
                    {property.available_rooms}
                  </strong>

                  <span>
                    Rooms available
                  </span>
                </div>

                <div>
                  <strong>
                    {property.available_beds}
                  </strong>

                  <span>
                    Beds available
                  </span>
                </div>

                <div>
                  <strong>
                    {property.total_rooms}
                  </strong>

                  <span>
                    Total rooms
                  </span>
                </div>

              </div>

            </div>

          </div>


          {/* -------------------------------------------------
              ACTION CARD
          ------------------------------------------------- */}

          <aside className="property-action-card">

            <span className="eyebrow">
              READY TO CONTINUE?
            </span>

            <h2>
              Find your room
            </h2>

            <p>
              Explore available rooms,
              bed capacity and pricing.
            </p>

            <Link
              to={`/accommodation/${property.id}/rooms`}
              className="primary-button"
            >
              View available rooms
            </Link>

            <button
              type="button"
              className="secondary-button"
            >
              Save property
            </button>

          </aside>

        </section>

        <PropertyReviews key={property.id} propertyId={property.id} />

      </main>


      {/* -----------------------------------------------------
          FULLSCREEN IMAGE
      ----------------------------------------------------- */}

      {selectedImage && (

        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Accommodation photo gallery"
          tabIndex={-1}
          onClick={() => { setSelectedImage(null); setSelectedImageIndex(null); }}
        >

          <button
            type="button"
            className="image-lightbox-close"
            onClick={() => { setSelectedImage(null); setSelectedImageIndex(null); }}
            aria-label="Close image"
          >
            ×
          </button>

          <button type="button" className="image-lightbox-arrow image-lightbox-previous" aria-label="Previous photo" onClick={(event) => { event.stopPropagation(); setSelectedImageIndex((current) => current === null ? null : (current - 1 + galleryItems.length) % galleryItems.length); }}>
            ‹
          </button>
          <img
            src={galleryItems[currentLightboxIndex] ? getMediaUrl(galleryItems[currentLightboxIndex].image) : selectedImage}
            alt={property.name}
            onTouchStart={(event) => { touchStartXRef.current = event.touches[0]?.clientX ?? null; }}
            onTouchEnd={(event) => {
              if (touchStartXRef.current === null || galleryItems.length < 2) return;
              const delta = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
              if (Math.abs(delta - touchStartXRef.current) >= 45) {
                const direction = delta < touchStartXRef.current ? 1 : -1;
                setSelectedImageIndex((current) => current === null ? null : (current + direction + galleryItems.length) % galleryItems.length);
              }
              touchStartXRef.current = null;
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          />
          <button type="button" className="image-lightbox-arrow image-lightbox-next" aria-label="Next photo" onClick={(event) => { event.stopPropagation(); setSelectedImageIndex((current) => current === null ? null : (current + 1) % galleryItems.length); }}>
            ›
          </button>
          <span className="image-lightbox-count" aria-live="polite">{currentLightboxIndex + 1} / {galleryItems.length} · {galleryItems[currentLightboxIndex]?.caption ?? property.name}</span>

        </div>

      )}

    </div>
  );
}

export default PropertyDetails;
