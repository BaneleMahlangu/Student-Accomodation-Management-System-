import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminNavigation from "../../components/AdminNavigation";
import { getAdminPropertyReviews } from "../../services/api";
import type { PropertyReview } from "../../services/api";
import "../../App.css";

export default function AdminPropertyReviews() {
  const [reviews, setReviews] = useState<PropertyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    setLoading(true);
    try {
      setReviews(await getAdminPropertyReviews());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load property reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="admin-dashboard-page admin-operations-page">
      <header className="admin-header">
        <Link to="/admin/dashboard" className="dashboard-brand">
          <img src="/SH-logo.jpg" alt="StudentHaven" />
          <div><strong>StudentHaven</strong><span>Administrator Console</span></div>
        </Link>
        <div className="admin-header-title">Resident reviews</div>
      </header>
      <div className="admin-layout">
        <AdminNavigation />
        <main className="admin-content">
          <section className="admin-welcome">
            <div><span className="eyebrow">LISTING TRUST</span><h1>Resident reviews</h1><p>Reviews from verified residents are published automatically. This page lists submissions for reference.</p></div>
          </section>
          {error && <div className="property-alert property-alert-error" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}
          {loading ? <div className="property-empty-state" role="status">Loading reviews…</div> : error ? null : reviews.length === 0 ? <div className="property-empty-state"><h2>No reviews found</h2><p>Resident reviews will appear here after submission.</p></div> : (
            <div className="refund-request-list">
              {reviews.map((review) => (
                <article className="refund-request-card" key={review.id}>
                  <div className="refund-card-heading">
                    <div><span className="eyebrow">{new Date(review.created_at).toLocaleString("en-ZA")}</span><h2>{review.property_name}</h2></div>
                    <strong>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</strong>
                  </div>
                  <p><strong>{review.title}</strong></p>
                  <p>{review.body}</p>
                  <p>Booking #{review.booking} · {review.student_name} ({review.student_email})</p>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
