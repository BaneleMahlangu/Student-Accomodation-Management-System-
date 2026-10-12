import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import DashboardLink from "../../components/DashboardLink";

import "../../App.css";

import {
  getProperty,
  joinStudentWaitingList,
} from "../../services/api";
import type { Property } from "../../services/api";
import { getRoomGalleryImages } from "../../data/accommodationImages";
import { formatRoomBedAvailability } from "../../utils/roomBedAvailability";


function Rooms() {
  const { id } = useParams();
  const location = useLocation();

  const [property, setProperty] =
    useState<Property | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [waitingListMessage, setWaitingListMessage] = useState("");
  const [waitingListError, setWaitingListError] = useState("");
  const [joiningWaitingList, setJoiningWaitingList] = useState(false);

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
            : "Unable to load rooms."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProperty();
  }, [id]);

  if (loading) {
    return (
      <div className="property-details-loading">
        Loading available rooms...
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="property-details-error">
        <h2>Unable to load rooms</h2>
        <p>{error}</p>

        <Link
          to="/accommodation"
          className="primary-button"
        >
          Back to accommodation
        </Link>
      </div>
    );
  }

  const availableRooms =
    property.rooms?.filter(
      (room) =>
        room.status === "AVAILABLE" &&
        room.available_beds > 0
    ) || [];
  const unavailableRooms =
    property.rooms?.filter(
      (room) => room.status !== "AVAILABLE" || room.available_beds < 1
    ) || [];

  function unavailableRoomLabel(status: string, availableBeds: number) {
    if (status === "OCCUPIED") return "Occupied";
    if (status === "RESERVED") return "Reserved";
    if (status === "AVAILABLE" && availableBeds < 1) return "No beds available";
    return status.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  }

  async function joinWaitingList() {
    if (!property) return;
    setJoiningWaitingList(true);
    setWaitingListError("");
    setWaitingListMessage("");
    try {
      const result = await joinStudentWaitingList(property.id);
      setWaitingListMessage(result.message);
    } catch (caught) {
      setWaitingListError(caught instanceof Error ? caught.message : "Sign in to join this property's waiting list.");
    } finally {
      setJoiningWaitingList(false);
    }
  }

  return (
    <div className="property-details-page">

      <header className="accommodation-header">

        <Link
          to={`/accommodation/${property.id}`}
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
              Room selection
            </span>
          </div>
        </Link>

        <DashboardLink className="dashboard-logout" />

      </header>


      <main className="property-details-content">

        <Link
          to={`/accommodation/${property.id}`}
          className="back-link"
        >
          ← Back to {property.name}
        </Link>


        <section className="rooms-heading">

          <span className="eyebrow">
            SELECT YOUR ROOM
          </span>

          <h1>
            Available rooms
          </h1>

          <p>
            Choose an available room at{" "}
            <strong>{property.name}</strong>.
          </p>

        </section>


        <section className="room-summary">

          <div>
            <strong>
              {availableRooms.length}
            </strong>

            <span>
              Available rooms
            </span>
          </div>

          <div>
            <strong>
              {property.available_beds}
            </strong>

            <span>
              Available beds
            </span>
          </div>

        </section>


        {availableRooms.length === 0 ? (
          <div className="empty-accommodation">

            <h3>
              No rooms currently available
            </h3>

            <p>
              You can join the waiting list or
              explore another property.
            </p>

            {waitingListError && <p className="waiting-list-inline-error" role="alert">{waitingListError} <Link to="/login" state={{ from: location }}>Sign in</Link></p>}
            {waitingListMessage && <p className="waiting-list-inline-success" role="status">{waitingListMessage} <Link to="/student/waiting-list">View your queue</Link></p>}
            {!waitingListMessage && <button type="button" className="auth-primary-button room-waiting-list-button" onClick={() => void joinWaitingList()} disabled={joiningWaitingList}>{joiningWaitingList ? "Joining…" : "Join this property's waiting list"}</button>}

          </div>
        ) : (

          <div className="room-grid">

            {availableRooms.map((room) => {
              const roomImage = getRoomGalleryImages(property.id, room.id, room.images)[0];

              return (
                <article
                  className="room-card"
                  key={room.id}
                >

                <div className="room-card-image">

                  <img
                    src={roomImage.url}
                    alt={roomImage.caption || `Room ${room.room_number} at ${property.name}`}
                    loading="lazy"
                  />

                </div>


                <div className="room-card-content">

                  <div className="room-title-row">

                    <div>

                      <span className="eyebrow">
                        ROOM
                      </span>

                      <h2>
                        {room.room_number}
                      </h2>

                    </div>

                    <span className="room-status">
                      AVAILABLE
                    </span>

                  </div>


                  <p className="room-type">
                    {room.room_type}
                  </p>


                  <div className="room-details">

                    <span>
                      {formatRoomBedAvailability(room)}
                    </span>

                  </div>


                  <div className="room-price">

                    <strong>
                      R
                      {Number(
                        room.monthly_price
                      ).toLocaleString()}
                    </strong>

                    <span>
                      /month
                    </span>

                  </div>


                  <Link
                    to={`/accommodation/${property.id}/rooms/${room.id}`}
                    className="property-view-button"
                  >
                    Select room
                  </Link>

                </div>

                </article>
              );
            })}

          </div>

        )}

        {unavailableRooms.length > 0 && <section className="unavailable-room-section">
          <div className="unavailable-room-heading">
            <h2>Rooms currently unavailable</h2>
            <p>Occupied and reserved rooms cannot accept new applications.</p>
          </div>
          <div className="room-grid">
            {unavailableRooms.map((room) => {
              const roomImage = getRoomGalleryImages(property.id, room.id, room.images)[0];
              const label = unavailableRoomLabel(room.status, room.available_beds);
              const statusClass = room.status === "AVAILABLE" ? "unavailable" : room.status.toLowerCase();
              return <article className="room-card room-card-unavailable" key={room.id}>
                <div className="room-card-image">
                  <img src={roomImage.url} alt={roomImage.caption || `Room ${room.room_number} at ${property.name}`} loading="lazy" />
                </div>
                <div className="room-card-content">
                  <div className="room-title-row">
                    <div><span className="eyebrow">ROOM</span><h2>{room.room_number}</h2></div>
                    <span className={`room-status room-status-${statusClass}`}>{label}</span>
                  </div>
                  <p className="room-type">{room.room_type}</p>
                  <div className="room-details"><span>{formatRoomBedAvailability(room)}</span></div>
                  <div className="room-price"><strong>R{Number(room.monthly_price).toLocaleString()}</strong><span>/month</span></div>
                  <p className="room-unavailable-note">
                    {room.status === "OCCUPIED"
                      ? "All beds are occupied. This room is not accepting applications."
                      : room.status === "RESERVED"
                        ? "All beds are reserved for confirmed bookings."
                        : "There are no available beds in this room."}
                  </p>
                </div>
              </article>;
            })}
          </div>
        </section>}

      </main>

    </div>
  );
}

export default Rooms;
