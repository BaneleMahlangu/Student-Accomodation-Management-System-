import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Building2,
  ClipboardCheck,
  GraduationCap,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import AccommodationSlideshow from "../components/AccommodationSlideshow";
import "../App.css";

function Welcome() {
  return (
    <div className="app welcome-page">
      <header className="welcome-nav">
        <Link to="/" className="welcome-brand">
          <img src="/SH-logo.jpg" alt="" />
          <span><strong>StudentHaven</strong><small>Find your place. Build your future.</small></span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/accommodation">Browse stays</Link>
          <Link to="/reviews">Resident reviews</Link>
          <Link to="/login">Sign in</Link>
          <Link className="welcome-nav-cta" to="/register">Create account <ArrowRight size={16} aria-hidden="true" /></Link>
        </nav>
      </header>

      <main>
        <section className="welcome-hero">
          <div className="welcome-hero-copy">
            <span className="welcome-kicker"><Sparkles size={15} aria-hidden="true" />A simpler way to find student accommodation</span>
            <h1>Find your place <span>to thrive.</span></h1>
            <p>Discover a residence that fits your campus, budget and day-to-day life. Compare rooms, apply online and manage your stay in one place.</p>
            <div className="welcome-hero-actions">
              <Link className="welcome-primary-button" to="/accommodation">Explore accommodation <ArrowRight size={18} aria-hidden="true" /></Link>
              <Link className="welcome-secondary-button" to="/register">Join StudentHaven</Link>
            </div>
            <div className="welcome-assurance-row">
              <span><BadgeCheck size={18} aria-hidden="true" />Reviewed listings</span>
              <span><MapPin size={18} aria-hidden="true" />Near your campus</span>
            </div>
          </div>

          <div className="welcome-hero-visual">
            <AccommodationSlideshow />
            <div className="welcome-image-note"><span className="welcome-image-icon"><BedDouble size={20} aria-hidden="true" /></span><span><strong>Make room for what matters</strong><small>Find a stay that feels right for you.</small></span></div>
          </div>
          <div className="welcome-orbit welcome-orbit-one" aria-hidden="true" />
          <div className="welcome-orbit welcome-orbit-two" aria-hidden="true" />
        </section>

        <section className="welcome-intro" id="how-it-works">
          <div className="welcome-section-heading">
            <span className="welcome-section-kicker">YOUR STUDENT ACCOMMODATION JOURNEY</span>
            <h2>One place to find a home<br />and make it yours.</h2>
            <p>StudentHaven brings the important steps together, from your first search to move-in and support during your stay.</p>
          </div>
          <div className="welcome-benefit-grid">
            <article className="welcome-benefit-card"><span><Search size={21} aria-hidden="true" /></span><small>01 · DISCOVER</small><h3>Explore your options</h3><p>Browse student residences and compare location, room details, facilities and monthly costs.</p><Link to="/accommodation">Browse properties <ArrowRight size={15} aria-hidden="true" /></Link></article>
            <article className="welcome-benefit-card"><span><ClipboardCheck size={21} aria-hidden="true" /></span><small>02 · APPLY</small><h3>Apply in one place</h3><p>Submit an accommodation application, share the required details and follow its progress.</p><Link to="/register">Create a student account <ArrowRight size={15} aria-hidden="true" /></Link></article>
            <article className="welcome-benefit-card"><span><ShieldCheck size={21} aria-hidden="true" /></span><small>03 · SETTLE IN</small><h3>Stay connected</h3><p>Keep your accommodation details, messages and support requests close at hand.</p><Link to="/login">Open your portal <ArrowRight size={15} aria-hidden="true" /></Link></article>
          </div>
        </section>

        <section className="welcome-safety" id="safety">
          <div className="welcome-safety-heading">
            <span>SEARCH WITH CONFIDENCE</span>
            <h2>A few steps for a safer search.</h2>
            <p>Take time to review the details and keep your accommodation journey in your StudentHaven account.</p>
          </div>
          <div className="welcome-safety-grid">
            <article><BadgeCheck size={21} aria-hidden="true" /><div><h3>Read the listing details</h3><p>Check the property, campus, room, monthly cost and facilities before applying.</p></div></article>
            <article><ClipboardCheck size={21} aria-hidden="true" /><div><h3>Review your documents</h3><p>Read application requirements and contract terms carefully before you agree.</p></div></article>
            <article><ShieldCheck size={21} aria-hidden="true" /><div><h3>Use your secure portal</h3><p>Keep messages and service requests in StudentHaven, and never share your password.</p></div></article>
          </div>
        </section>

        <section className="welcome-community" id="welcome-support">
          <div className="welcome-community-icon"><GraduationCap size={25} aria-hidden="true" /></div>
          <div><span>MADE FOR STUDENT LIFE</span><h2>A better start to living away from home.</h2><p>See accommodation information clearly, connect with providers, and reach StudentHaven support when you need help.</p></div>
          <Link to="/accommodation">Find your next stay <ArrowRight size={17} aria-hidden="true" /></Link>
          <div className="welcome-community-watermark" aria-hidden="true"><Building2 size={92} /></div>
        </section>
      </main>
    </div>
  );
}

export default Welcome;
