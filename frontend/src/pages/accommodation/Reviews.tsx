import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAllPropertyReviews } from "../../services/api";
import type { PropertyReviewPage } from "../../services/api";
import "../../App.css";

export default function Reviews() {
  const [feed, setFeed] = useState<PropertyReviewPage | null>(null);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    getAllPropertyReviews(page)
      .then((result) => {
        if (active) {
          setFeed(result);
          setError("");
        }
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load resident reviews.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [page, refresh]);

  return (
    <main className="all-reviews-page">
      <div className="all-reviews-content">
        <Link to="/accommodation" className="all-reviews-back">← Browse accommodation</Link>
        <header className="all-reviews-heading">
          <span className="eyebrow">VERIFIED RESIDENT FEEDBACK</span>
          <h1>Resident reviews</h1>
          <p>Read experiences shared by verified current and former residents. New reviews appear as soon as they are submitted.</p>
          {feed && <strong>{feed.count} review{feed.count === 1 ? "" : "s"}</strong>}
        </header>

        {error && <div className="property-alert property-alert-error" role="alert">{error}<button type="button" onClick={() => setRefresh((current) => current + 1)}>Retry</button></div>}
        {loading && !feed ? <p className="property-empty-state" role="status">Loading resident reviews…</p> : null}
        {!loading && !error && feed?.reviews.length === 0 && <p className="property-empty-state">No resident reviews have been submitted yet.</p>}

        {feed && feed.reviews.length > 0 && <div className="all-reviews-list">
          {feed.reviews.map((review) => (
            <article className="all-reviews-card" key={review.id}>
              <div className="all-reviews-card-heading">
                <div>
                  <Link to={`/accommodation/${review.property}`}><strong>{review.property_name || "Student accommodation"}</strong></Link>
                  <small>{review.reviewer || "Verified Student Haven resident"} · {new Date(review.created_at).toLocaleDateString("en-ZA")}</small>
                </div>
                <span aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
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
      </div>
    </main>
  );
}
