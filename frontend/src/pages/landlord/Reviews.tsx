import LandlordNavigation from "../../components/LandlordNavigation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLandlordPropertyReviews } from "../../services/api";
import type { LandlordPropertyReviewPage } from "../../services/api";
import "../../App.css";

export default function LandlordReviews() {
  const [feed, setFeed] = useState<LandlordPropertyReviewPage | null>(null);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    getLandlordPropertyReviews(page)
      .then((result) => {
        if (active) {
          setFeed(result);
          setError("");
        }
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load reviews for your properties.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [page, refresh]);

  return (
    <div className="landlord-dashboard-page">
      <header className="landlord-header">
        <Link to="/landlord/dashboard" className="dashboard-brand"><img src="/SH-logo.jpg" alt="StudentHaven" /><div><strong>StudentHaven</strong><span>Landlord Portal</span></div></Link>
        <Link to="/account/security" className="occupancy-security-link">Account Security</Link>
      </header>
      <div className="occupancy-shell">
        <LandlordNavigation variant="occupancy" />
        <main className="occupancy-content">
          <div className="occupancy-heading">
            <div><span className="section-eyebrow">LANDLORD OPERATIONS</span><h1>Reviews and ratings</h1><p>Student feedback for the properties registered to your landlord account. New reviews appear as soon as students submit them.</p></div>
            <button type="button" className="dashboard-secondary-action" onClick={() => setRefresh((current) => current + 1)} disabled={loading}>{loading ? "Refreshing…" : "Refresh reviews"}</button>
          </div>

          <section className="occupancy-summary landlord-review-summary" aria-label="Your property review summary">
            <article><span>Average rating</span><strong>{loading && !feed ? "—" : feed?.average_rating ? `★ ${feed.average_rating} / 5` : "No ratings yet"}</strong></article>
            <article><span>Total reviews</span><strong>{loading && !feed ? "—" : feed?.count ?? 0}</strong></article>
          </section>

          {error && <div className="property-alert property-alert-error" role="alert">{error}<button type="button" onClick={() => setRefresh((current) => current + 1)}>Try again</button></div>}
          {loading && !feed ? <div className="dashboard-loading" role="status">Loading your property reviews…</div> : null}
          {!loading && !error && feed?.reviews.length === 0 && <div className="change-requests-empty"><strong>No student reviews yet</strong><p>Ratings and comments from students who stayed at your properties will appear here.</p></div>}

          {feed && feed.reviews.length > 0 && <div className="all-reviews-list landlord-review-list">
            {feed.reviews.map((review) => (
              <article className="all-reviews-card" key={review.id}>
                <div className="all-reviews-card-heading">
                  <div>
                    <Link to={`/accommodation/${review.property}/reviews`}><strong>{review.property_name || "Your accommodation"}</strong></Link>
                    <small>{review.reviewer || "Verified Student Haven resident"} · {new Date(review.created_at).toLocaleDateString("en-ZA")}</small>
                  </div>
                  <span aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)} <b>{review.rating}/5</b></span>
                </div>
                <h2>{review.title}</h2>
                <p>{review.body}</p>
              </article>
            ))}
          </div>}

          {feed && feed.total_pages > 1 && <nav className="all-reviews-pagination" aria-label="Review pages">
            <button type="button" disabled={!feed.has_previous || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            <span>Page {feed.page} of {feed.total_pages}</span>
            <button type="button" disabled={!feed.has_next || loading} onClick={() => setPage((current) => current + 1)}>Next</button>
          </nav>}
        </main>
      </div>
    </div>
  );
}
