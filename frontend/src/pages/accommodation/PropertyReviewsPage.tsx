import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProperty, getPropertyReviewFeed } from "../../services/api";
import type { Property, PropertyReviewFeed } from "../../services/api";
import "../../App.css";

export default function PropertyReviewsPage() {
  const { id } = useParams();
  const propertyId = Number(id);
  const [property, setProperty] = useState<Property | null>(null);
  const [feed, setFeed] = useState<PropertyReviewFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    if (!Number.isSafeInteger(propertyId) || propertyId < 1) {
      setError("This accommodation could not be found.");
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    Promise.all([getProperty(propertyId), getPropertyReviewFeed(propertyId)])
      .then(([propertyResult, reviewResult]) => {
        if (!active) return;
        setProperty(propertyResult);
        setFeed(reviewResult);
        setError("");
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load accommodation reviews.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [propertyId, refresh]);

  return (
    <main className="all-reviews-page">
      <div className="all-reviews-content">
        <Link to={Number.isSafeInteger(propertyId) ? `/accommodation/${propertyId}` : "/accommodation"} className="all-reviews-back">← Back to accommodation</Link>
        <header className="all-reviews-heading">
          <span className="eyebrow">VERIFIED RESIDENT FEEDBACK</span>
          <h1>{property ? `${property.name} reviews` : "Accommodation reviews"}</h1>
          {property && <p>{property.campus}, {property.university}</p>}
          <p>Reviews and ratings shared by students who stayed at this accommodation.</p>
          {feed && <strong>{feed.review_count > 0 ? `★ ${feed.average_rating} / 5 · ` : "No rating yet · "}{feed.review_count} review{feed.review_count === 1 ? "" : "s"}</strong>}
          {property && <Link to={`/accommodation/${property.id}`} className="property-view-button">View accommodation</Link>}
        </header>

        {error && <div className="property-alert property-alert-error" role="alert">{error}<button type="button" onClick={() => setRefresh((current) => current + 1)}>Retry</button></div>}
        {loading && !feed ? <p className="property-empty-state" role="status">Loading reviews…</p> : null}
        {!loading && !error && feed?.reviews.length === 0 && <p className="property-empty-state">No reviews have been submitted for this accommodation yet.</p>}

        {feed && feed.reviews.length > 0 && <div className="all-reviews-list">
          {feed.reviews.map((review) => (
            <article className="all-reviews-card" key={review.id}>
              <div className="all-reviews-card-heading">
                <div><strong>{review.reviewer || "Verified StudentHaven resident"}</strong><small>{new Date(review.created_at).toLocaleDateString("en-ZA")}</small></div>
                <span aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)} <b>{review.rating}/5</b></span>
              </div>
              <h2>{review.title}</h2>
              <p>{review.body}</p>
            </article>
          ))}
        </div>}

        <p className="all-reviews-footer-link"><Link to="/reviews">See reviews from all accommodations</Link></p>
      </div>
    </main>
  );
}
