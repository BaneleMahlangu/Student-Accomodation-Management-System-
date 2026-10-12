import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, BedDouble, Building2, Heart, MapPin, Scale, ShieldCheck, Star } from "lucide-react";
import DashboardLink from "../../components/DashboardLink";

import "../../App.css";

import {
  getProperties,
  getStudentFavoriteProperties,
  setStudentFavoriteProperty,
} from "../../services/api";

import type { Property } from "../../services/api";
import { getFallbackPropertyImages, getPrimaryPropertyImage } from "../../data/accommodationImages";


function Discovery() {

  const location = useLocation();

  const [properties, setProperties] =
    useState<Property[]>([]);

  const [search, setSearch] = useState("");

  const [sort, setSort] =
    useState("recommended");

  const [propertyType, setPropertyType] =
    useState("");

  const [maxPrice, setMaxPrice] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [actionMessage, setActionMessage] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  function formatPropertyType(value: string) {
    return value
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatMonthlyPrice(property: Property) {
    if (!property.monthly_min_price) return "Price on request";
    const minimum = Number(property.monthly_min_price);
    const maximum = Number(property.monthly_max_price || property.monthly_min_price);
    const format = (amount: number) => `R${amount.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
    return maximum > minimum ? `${format(minimum)}–${format(maximum)}` : `From ${format(minimum)}`;
  }

  const loadProperties = async () => {

    setLoading(true);
    setError("");

    try {

      const result = await getProperties(
        search,
        sort,
        propertyType,
        maxPrice
      );

      setProperties(
        result.properties
      );

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load accommodation."
      );

    } finally {

      setLoading(false);

    }
  };


  useEffect(() => {
    loadProperties();
  }, [sort, propertyType, maxPrice]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("studenthaven.compare-property-ids") || "[]");
      if (Array.isArray(stored)) setCompareIds(stored.filter((id): id is number => Number.isInteger(id)).slice(0, 3));
    } catch {
      localStorage.removeItem("studenthaven.compare-property-ids");
    }
    getStudentFavoriteProperties().then((items) => setFavoriteIds(items.map((item) => item.id))).catch(() => setFavoriteIds([]));
  }, []);

  async function toggleFavorite(propertyId: number) {
    const nextIsFavorite = !favoriteIds.includes(propertyId);
    setActionMessage("");
    setNeedsLogin(false);
    try {
      await setStudentFavoriteProperty(propertyId, nextIsFavorite);
      setFavoriteIds((current) => nextIsFavorite ? [...new Set([...current, propertyId])] : current.filter((id) => id !== propertyId));
    } catch (caught) {
      setActionMessage(caught instanceof Error ? caught.message : "Sign in as a student to save properties.");
      setNeedsLogin(true);
    }
  }

  function toggleCompare(propertyId: number) {
    setActionMessage("");
    setNeedsLogin(false);
    const next = compareIds.includes(propertyId) ? compareIds.filter((id) => id !== propertyId) : compareIds.length < 3 ? [...compareIds, propertyId] : null;
    if (!next) {
      setActionMessage("You can compare up to three properties at a time.");
      return;
    }
    setCompareIds(next);
    localStorage.setItem("studenthaven.compare-property-ids", JSON.stringify(next));
  }


  const handleSearch = (
    event: React.FormEvent<HTMLFormElement>
  ) => {

    event.preventDefault();

    loadProperties();
  };


  return (

    <div className="accommodation-page">

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
              Find accommodation
            </span>
          </div>

        </Link>

        <nav className="discovery-quick-links" aria-label="Accommodation tools">
          <Link to="/accommodation/map">Map</Link>
          <Link to="/accommodation/favorites">Saved <span>{favoriteIds.length}</span></Link>
          <Link to="/accommodation/compare">Compare <span>{compareIds.length}/3</span></Link>
        </nav>

        <DashboardLink className="dashboard-logout" />

      </header>


      <main className="accommodation-content">

        <section className="accommodation-hero">

          <div>

            <span className="eyebrow">
              FIND YOUR PLACE
            </span>

            <h1>
              Find accommodation
              <br />
              that feels like home.
            </h1>

            <p>
              Explore verified student accommodation
              near your university and find a room
              that fits your needs and budget.
            </p>

          </div>

        </section>


        <section className="search-panel">

          <form
            onSubmit={handleSearch}
            className="accommodation-search"
          >

            <input
              type="text"
              placeholder="Search residence, university or campus..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            <button
              type="submit"
              className="primary-button"
            >
              Search
            </button>

          </form>


          <div className="accommodation-filters">

            <select
              value={propertyType}
              onChange={(event) =>
                setPropertyType(
                  event.target.value
                )
              }
            >

              <option value="">
                All accommodation
              </option>

              <option value="STUDENT_RESIDENCE">
                Student Residence
              </option>

              <option value="APARTMENT">
                Apartments
              </option>

              <option value="HOUSE">
                Shared Houses
              </option>

              <option value="STUDIO">
                Studios
              </option>

              <option value="UNIVERSITY_RESIDENCE">
                University Residence
              </option>

            </select>


            <select
              value={maxPrice}
              onChange={(event) =>
                setMaxPrice(
                  event.target.value
                )
              }
            >

              <option value="">
                Any budget
              </option>

              <option value="3000">
                Up to R3,000
              </option>

              <option value="4000">
                Up to R4,000
              </option>

              <option value="5000">
                Up to R5,000
              </option>

              <option value="6000">
                Up to R6,000
              </option>

              <option value="7000">
                Up to R7,000
              </option>

            </select>


            <select
              value={sort}
              onChange={(event) =>
                setSort(
                  event.target.value
                )
              }
            >

              <option value="recommended">
                Recommended
              </option>

              <option value="price_low">
                Lowest price
              </option>

              <option value="price_high">
                Highest price
              </option>

              <option value="rating">
                Highest rated
              </option>

              <option value="closest">
                Closest to campus
              </option>

            </select>

          </div>

        </section>


        <section className="property-results">

          <div className="results-heading">

            <div>

              <span className="eyebrow">
                VERIFIED ACCOMMODATION
              </span>

              <h2>
                {loading
                  ? "Finding your options..."
                  : `${properties.length} properties available`}
              </h2>

            </div>

          </div>


          {error && (
            <div className="form-message error-message">
              {error}
            </div>
          )}

          {actionMessage && <div className="discovery-action-message" role="status">{actionMessage} {needsLogin && <Link to="/login" state={{ from: location }}>Sign in</Link>}</div>}


          {loading && (

            <div className="property-grid">

              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    className="property-skeleton"
                    key={item}
                  />
                )
              )}

            </div>

          )}


          {!loading &&
            !error &&
            properties.length === 0 && (

              <div className="empty-accommodation">

                <h3>
                  No accommodation found
                </h3>

                <p>
                  Try changing your search
                  or filters.
                </p>

              </div>

            )}


          {!loading &&
            !error &&
            properties.length > 0 && (

              <div className="property-grid">

                {properties.map((property) => {
                  const availableRoomTypes = Array.from(new Set(
                    property.rooms
                      .filter((room) => room.status === "AVAILABLE")
                      .map((room) => room.room_type)
                      .filter(Boolean),
                  )).slice(0, 2);
                  const rating = property.rating === null ? 0 : Number(property.rating);
                  const visibleAmenities = property.amenities.slice(0, 3);
                  const extraAmenities = Math.max(0, property.amenities.length - visibleAmenities.length);

                  return (

                    <article
                      className="property-card"
                      key={property.id}
                    >

                      <div className="property-image">

                        <img
                          src={getPrimaryPropertyImage(property)}
                          alt={`${property.name} accommodation`}
                          loading="lazy"
                          onError={(event) => {
                            const fallback = getFallbackPropertyImages(property.id, 1)[0]?.url;
                            if (fallback && event.currentTarget.src !== fallback) {
                              event.currentTarget.src = fallback;
                            }
                          }}
                        />

                        <div className="property-image-overlay">
                          <span className="property-verified-tag">
                            <ShieldCheck size={14} aria-hidden="true" /> Verified listing
                          </span>
                          <span className="property-type-tag">
                            {formatPropertyType(property.property_type)}
                          </span>
                        </div>

                      </div>


                      <div className="property-card-content">

                        <div className="property-title-row">

                          <div>

                            <h3>
                              {property.name}
                            </h3>
                            <p className="property-campus">
                              <MapPin size={14} aria-hidden="true" />
                              <span>{property.campus}, {property.university}</span>
                            </p>

                          </div>

                          <Link to={`/accommodation/${property.id}/reviews`} className="property-rating" aria-label={rating > 0 ? `Rated ${rating.toFixed(1)} out of 5 from ${property.review_count} resident reviews. View reviews.` : `No resident ratings yet. View all ${property.review_count} reviews.`}>
                            {rating > 0
                              ? <><Star size={15} aria-hidden="true" /> {rating.toFixed(1)} <small>({property.review_count})</small></>
                              : <>New <small>({property.review_count})</small></>}
                          </Link>

                        </div>


                        <div className="property-location">
                          <MapPin size={15} aria-hidden="true" />
                          <span>{property.distance_from_campus_km
                            ? `${property.distance_from_campus_km} km · ${property.walking_minutes ?? "—"} min walk to campus`
                            : "Campus distance not listed"}</span>
                        </div>


                        <div className="property-price">

                          <strong>{formatMonthlyPrice(property)}</strong>
                          {property.monthly_min_price && <span>/month</span>}

                        </div>


                        <div className="property-meta">

                          <span>
                            <Building2 size={16} aria-hidden="true" />
                            <strong>{property.available_rooms}</strong>
                            <small>rooms</small>
                          </span>

                          <span>
                            <BedDouble size={16} aria-hidden="true" />
                            <strong>{property.available_beds}</strong>
                            <small>beds</small>
                          </span>

                        </div>

                        {availableRoomTypes.length > 0 && (
                          <div className="property-room-types" aria-label="Available room types">
                            <span>ROOM TYPES</span>
                            {availableRoomTypes.map((roomType) => <small key={roomType}>{roomType}</small>)}
                          </div>
                        )}


                        <div className="property-amenities">

                          {visibleAmenities.map((amenity) => (
                            <span key={amenity.id}>{amenity.name}</span>
                          ))}
                          {extraAmenities > 0 && <span className="property-amenities-more">+{extraAmenities}</span>}

                        </div>


                        <div className="discovery-card-actions">
                          <Link to={`/accommodation/${property.id}`} className="property-view-button">View residence <ArrowRight size={16} aria-hidden="true" /></Link>
                          <button type="button" className={favoriteIds.includes(property.id) ? "is-saved" : ""} aria-label={favoriteIds.includes(property.id) ? `Remove ${property.name} from saved properties` : `Save ${property.name}`} aria-pressed={favoriteIds.includes(property.id)} onClick={() => void toggleFavorite(property.id)}><Heart size={16} aria-hidden="true" />{favoriteIds.includes(property.id) ? "Saved" : "Save"}</button>
                          <button type="button" className={compareIds.includes(property.id) ? "is-comparing" : ""} aria-label={compareIds.includes(property.id) ? `Remove ${property.name} from comparison` : `Compare ${property.name}`} aria-pressed={compareIds.includes(property.id)} onClick={() => toggleCompare(property.id)}><Scale size={16} aria-hidden="true" />{compareIds.includes(property.id) ? "Added" : "Compare"}</button>
                        </div>

                      </div>

                    </article>

                  );
                })}

              </div>

            )}

        </section>

      </main>

    </div>
  );
}


export default Discovery;
