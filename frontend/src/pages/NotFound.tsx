import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCurrentUser } from "../services/api";
import type { CurrentUser } from "../services/api";
import { getDashboardPath } from "../utils/navigation";
import "../App.css";

export default function NotFound() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentUser().then((currentUser) => {
      if (active) setUser(currentUser);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const dashboard = user ? getDashboardPath(user.role) : undefined;

  return (
    <main className="not-found-page">
      <section className="not-found-card" aria-labelledby="not-found-title">
        <Link to="/" className="dashboard-brand">
          <img src="/SH-logo.jpg" alt="" />
          <div><strong>StudentHaven</strong><span>Find your place. Build your future.</span></div>
        </Link>
        <span className="section-eyebrow">PAGE NOT FOUND · 404</span>
        <h1 id="not-found-title">We can’t find that page</h1>
        <p>The address may have changed, or the page may no longer be available. Choose a safe place to continue.</p>
        <div className="not-found-actions">
          {dashboard && <Link className="dashboard-primary-action" to={dashboard}>Go to my dashboard</Link>}
          <Link className="dashboard-secondary-action" to="/accommodation">Find accommodation</Link>
          <Link className="dashboard-secondary-action" to="/">StudentHaven home</Link>
        </div>
      </section>
    </main>
  );
}
