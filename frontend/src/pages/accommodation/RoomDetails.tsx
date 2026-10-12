import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import DashboardLink from "../../components/DashboardLink";

import "../../App.css";

import {
  getProperty,
  getRoomFromProperty,
} from "../../services/api";

import type {
  Property,
  Room,
} from "../../services/api";
import { getRoomGalleryImages } from "../../data/accommodationImages";


function RoomDetails() {
  const { id, roomId } = useParams();

  const navigate = useNavigate();

  const [property, setProperty] =
    useState<Property | null>(null);

  const [room, setRoom] =
    useState<Room | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  useEffect(() => {
    async function loadRoom() {
      if (!id || !roomId) {
        setError("Room not found.");
        setLoading(false);
        return;
      }

      try {
        const propertyData =
          await getProperty(Number(id));

        const roomData =
          getRoomFromProperty(
            propertyData,
            Number(roomId)
          );

        setProperty(propertyData);
        setRoom(roomData);

      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load room."
        );
      } finally {
        setLoading(false);
      }
    }

    loadRoom();
  }, [id, roomId]);


  if (loading) {
    return (
      <div className="property-details-loading">
        Loading room...
      </div>
    );
  }


  if (error || !property || !room) {
    return (
      <div className="property-details-error">

        <h2>
          Unable to load room
        </h2>

        <p>
          {error}
        </p>

        <Link
          to={
            id
              ? `/accommodation/${id}/rooms`
              : "/accommodation"
          }
          className="primary-button"
        >
          Back to rooms
        </Link>

      </div>
    );
  }


  if (
    room.status !== "AVAILABLE" ||
    room.available_beds < 1
  ) {
    return (
      <div className="property-details-error">

        <h2>
          {room.status === "OCCUPIED"
            ? "This room is occupied"
            : room.status === "RESERVED"
              ? "This room is reserved"
              : "This room is no longer available"}
        </h2>

        <p>
          {room.status === "OCCUPIED"
            ? "All beds in this room are occupied. Please choose another available room."
            : room.status === "RESERVED"
              ? "All beds in this room are reserved for confirmed bookings. Please choose another available room."
              : "There are no available beds in this room. Please choose another available room."}
        </p>

        <Link
          to={`/accommodation/${property.id}/rooms`}
          className="primary-button"
        >
          View available rooms
        </Link>

      </div>
    );
  }


  const handleSelectRoom = () => {
    navigate(
      `/applications/new?property=${property.id}&room=${room.id}`
    );
  };

  const roomGallery = getRoomGalleryImages(property.id, room.id, room.images);


  return (
    <div className="property-details-page">

      <header className="accommodation-header">

        <Link
          to={`/accommodation/${property.id}/rooms`}
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
          to={`/accommodation/${property.id}/rooms`}
          className="back-link"
        >
          ← Back to available rooms
        </Link>


        <section className="selected-room-layout">

          <div>

            <div className="selected-room-image">

              <div className="room-gallery">
                {roomGallery.map((image, index) => (
                    <img key={`${room.id}-${index}`} src={image.url} alt={image.caption || `Room ${room.room_number}`} loading="lazy" />
                  ))}
              </div>

            </div>


            <div className="room-info-section">

              <span className="eyebrow">
                {room.room_type}
              </span>

              <h1>
                Room {room.room_number}
              </h1>

              <p>
                {room.description ||
                  `Comfortable ${room.room_type.toLowerCase()} at ${property.name}.`}
              </p>

            </div>


            <div className="room-feature-grid">

              <div>
                <strong>
                  {room.capacity}
                </strong>

                <span>
                  {room.capacity === 1
                    ? "Single bed"
                    : `${room.capacity} beds`}
                </span>
              </div>

              <div>
                <strong>
                  {room.available_beds}
                </strong>

                <span>
                  Available beds
                </span>
              </div>

              <div>
                <strong>
                  {room.occupied_beds}
                </strong>

                <span>
                  Occupied beds
                </span>
              </div>

              <div>
                <strong>
                  {room.reserved_beds}
                </strong>

                <span>
                  Reserved beds
                </span>
              </div>

              <div>
                <strong>
                  {room.total_beds}
                </strong>

                <span>
                  Total beds
                </span>
              </div>

              <div>
                <strong>
                  {room.is_accessible
                    ? "Yes"
                    : "No"}
                </strong>

                <span>
                  Accessible
                </span>
              </div>

            </div>

          </div>

          <aside className="room-selection-card">

            <span className="eyebrow">
              ROOM SELECTION
            </span>

            <h2>
              {property.name}
            </h2>

            <p>
              {property.campus}
            </p>

            <div className="selected-room-price">

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


            <div className="selection-status">
              <span>
                ✓
              </span>

              Room currently available
            </div>


            <button
              type="button"
              className="auth-primary-button"
              onClick={handleSelectRoom}
            >
              Select this room
            </button>


            <p className="selection-note">
              Selecting this room does not mean
              your accommodation has been approved.
              An application and administrator
              review are still required.
            </p>

          </aside>

        </section>

      </main>

    </div>
  );
}

export default RoomDetails;
