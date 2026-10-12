import {
  ArrowUpRight,
  BookOpen,
  Building2,
  FileText,
  GraduationCap,
  HeartHandshake,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

const WHATSAPP_URL = "https://wa.me/27100234634";

export default function SiteFooter() {
  return (
    <footer className="site-footer" id="site-footer">
      <div className="site-footer-main">
        <section className="site-footer-brand" aria-label="StudentHaven contact information">
          <Link to="/" className="site-footer-logo">
            <img src="/SH-logo.jpg" alt="" />
            <span>StudentHaven</span>
          </Link>
          <p className="site-footer-tagline">
            South Africa&apos;s student accommodation marketplace — connecting students, landlords and suppliers.
          </p>
          <ul className="site-footer-contact">
            <li><MapPin size={17} aria-hidden="true" /><span>Johannesburg, South Africa</span></li>
            <li><Mail size={17} aria-hidden="true" /><a href="mailto:support@studenthaven.co.za">support@studenthaven.co.za</a></li>
            <li><Phone size={17} aria-hidden="true" /><a href="tel:+27100234634">+27 10 023 4634</a></li>
            <li><MessageCircle size={17} aria-hidden="true" /><a href={WHATSAPP_URL} target="_blank" rel="noreferrer">Chat with us on WhatsApp</a></li>
          </ul>
        </section>

        <nav className="site-footer-column" aria-label="For students">
          <h2><GraduationCap size={17} aria-hidden="true" />For Students</h2>
          <Link to="/accommodation"><Search size={15} aria-hidden="true" />Browse Properties</Link>
          <Link to="/reviews"><ShieldCheck size={15} aria-hidden="true" />Resident Reviews</Link>
          <Link to="/accommodation"><ShieldCheck size={15} aria-hidden="true" />NSFAS Accommodation</Link>
          <a href={`${WHATSAPP_URL}?text=I%27m%20looking%20for%20student%20suppliers`} target="_blank" rel="noreferrer"><HeartHandshake size={15} aria-hidden="true" />Find Suppliers</a>
        </nav>

        <nav className="site-footer-column" aria-label="Earn with us">
          <h2><Building2 size={17} aria-hidden="true" />Earn With Us</h2>
          <Link to="/register/landlord"><Building2 size={15} aria-hidden="true" />List Your Property</Link>
          <a href={`mailto:support@studenthaven.co.za?subject=${encodeURIComponent("Become a StudentHaven supplier")}`}><HeartHandshake size={15} aria-hidden="true" />Become a Supplier</a>
          <a href={`mailto:support@studenthaven.co.za?subject=${encodeURIComponent("StudentHaven ambassador programme")}`}><UsersRound size={15} aria-hidden="true" />Become an Ambassador</a>
        </nav>

        <nav className="site-footer-column" aria-label="Company">
          <h2><UsersRound size={17} aria-hidden="true" />Company</h2>
          <Link to="/about"><ArrowUpRight size={15} aria-hidden="true" />About Us</Link>
          <Link to="/safety"><ShieldCheck size={15} aria-hidden="true" />Safety Tips</Link>
          <Link to="/legal"><FileText size={15} aria-hidden="true" />Legal &amp; Policies</Link>
          <Link to="/help/how-to-use"><BookOpen size={15} aria-hidden="true" />How to use the System</Link>
        </nav>
      </div>

      <div className="site-footer-bottom">
        <p className="site-footer-motto"><span>Search. Find. Stay.</span><HeartHandshake size={17} aria-hidden="true" /></p>
        <a className="site-footer-whatsapp" href={WHATSAPP_URL} target="_blank" rel="noreferrer" aria-label="Chat with StudentHaven on WhatsApp">
          <MessageCircle size={19} aria-hidden="true" />
        </a>
        <p className="site-footer-copyright">© 2026 StudentHaven (Pty) Ltd · South Africa&apos;s student accommodation marketplace</p>
        <div className="site-footer-legal" aria-label="Legal information">
          <Link to="/legal#privacy">Privacy</Link>
          <span aria-hidden="true">·</span>
          <Link to="/legal#terms">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
