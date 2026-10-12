import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { getPropertyReviewFeed, submitPropertyReview } from "../services/api";
import type { PropertyReviewFeed } from "../services/api";

export default function PropertyReviews({ propertyId }: { propertyId: number }) {
  const [feed, setFeed] = useState<PropertyReviewFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setLoading(true);
    try {
      setFeed(await getPropertyReviewFeed(propertyId));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load resident reviews.");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedBooking = Number(bookingId || feed?.eligible_bookings[0]?.id);
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!selectedBooking) return;
    if (rating < 1) {
      setError("Choose a rating from 1 to 5 stars.");
      return;
    }
    if (!cleanTitle || !cleanBody) {
      setError("Add a title and describe your stay before submitting.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await submitPropertyReview(propertyId, { booking_id: selectedBooking, rating, title: cleanTitle, body: cleanBody });
      setTitle("");
      setBody("");
      setBookingId("");
      setNotice("Your review is live on the property page and reviews page.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit your review.");
    } finally {
      setBusy(false);
    }
  }

  const eligibleBookings = feed?.eligible_bookings ?? [];
  const myReviews = feed?.my_reviews ?? [];
  const reviews = feed?.reviews ?? [];

  return (
    <section className="property-info-section property-review-section" aria-labelledby="property-reviews-heading">
      <div className="property-review-header">
        <div><span className="eyebrow">VERIFIED RESIDENT FEEDBACK</span><h2 id="property-reviews-heading">Resident reviews</h2><Link to={`/accommodation/${propertyId}/reviews`}>See all reviews for this residence</Link></div>
        <strong>{feed?.average_rating ? `★ ${feed.average_rating} / 5` : "No resident rating"}<small>{feed?.review_count ?? 0} review{feed?.review_count === 1 ? "" : "s"}</small></strong>
      </div>

      {notice && <div className="property-alert property-alert-success" role="status">{notice}</div>}
      {error && <div className="property-alert property-alert-error" role="alert">{error}<button type="button" onClick={() => void load(true)}>Retry</button></div>}

      {reviews.length > 0 ? (
        <div className="property-review-list" aria-label="Resident reviews">
          {reviews.map((review) => (
            <article key={review.id}>
              <div><strong>{review.title}</strong><span aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div>
              <small>{review.reviewer} · {new Date(review.created_at).toLocaleDateString("en-ZA")}</small>
              <p>{review.body}</p>
            </article>
          ))}
        </div>
      ) : loading ? <p className="property-review-empty" role="status">Loading resident reviews…</p> : !error && <p className="property-review-empty">No resident reviews yet. Verified residents can rate this accommodation during or after their stay.</p>}

      {myReviews.map((review) => (
        <article className="property-review-own" key={review.id}>
          <strong>Your review · {review.rating}/5 · LIVE</strong>
          <p>{review.title}</p>
          <p>{review.body}</p>
        </article>
      ))}

      {eligibleBookings.length > 0 ? (
        <form className="property-review-form" onSubmit={(event) => void submit(event)}>
          <div className="property-review-form-heading">
            <span className="eyebrow">SHARE YOUR EXPERIENCE</span>
            <h3>Rate your accommodation</h3>
            <p>Current residents can rate their stay at any time after check-in. Former residents can also review a completed stay. Your review appears as soon as you submit it.</p>
          </div>
          <label>Your residence stay
            <select required value={bookingId || String(eligibleBookings[0].id)} onChange={(event) => setBookingId(event.target.value)}>
              {eligibleBookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.booking_number} · {booking.status === "ACTIVE" ? "Current stay" : booking.checked_out_at ? `Checked out ${new Date(booking.checked_out_at).toLocaleDateString("en-ZA")}` : "Completed stay"}</option>)}
            </select>
          </label>
          <fieldset className="property-review-rating">
            <legend>Your rating</legend>
            <div role="group" aria-label="Rate your accommodation">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" aria-pressed={rating === value} aria-label={`${value} star${value === 1 ? "" : "s"}`} onClick={() => setRating(value)}>
                  {value <= rating ? "★" : "☆"}
                </button>
              ))}
              <span>{rating > 0 ? `${rating} out of 5` : "Select 1 to 5 stars"}</span>
            </div>
          </fieldset>
          <label>Review title
            <input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Summarise your experience" />
          </label>
          <label>Tell other students about your stay
            <textarea required maxLength={2500} rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder="What worked well? What should a future resident know?" />
          </label>
          <div className="property-review-form-footer"><small>{body.length}/2,500 characters</small><button className="primary-button" disabled={busy || rating < 1 || !title.trim() || !body.trim()}>{busy ? "Submitting…" : "Submit resident review"}</button></div>
        </form>
      ) : feed && !feed.viewer_is_student && myReviews.length === 0 ? (
        <div className="property-review-guidance"><strong>Stayed here?</strong><p>Sign in with the student account used for your residence booking to rate the accommodation during your stay or after checkout.</p><Link to="/login" className="secondary-button">Sign in to review</Link></div>
      ) : feed && myReviews.length === 0 ? (
        <div className="property-review-guidance"><strong>Reviews are for verified residents</strong><p>After your check-in is recorded, you can rate the accommodation and leave a comment at any time during your stay or after checkout.</p></div>
      ) : null}

    </section>
  );
}
