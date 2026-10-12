import LandlordNavigation from "../../components/LandlordNavigation";
import { Link } from "react-router-dom";
import CheckInScanner from "../shared/CheckInScanner";
import "../../App.css";

function LandlordCheckIn() {
  return (
    <div className="landlord-dashboard-page landlord-check-in-page">
      <header className="landlord-header">
        <Link to="/landlord/dashboard" className="dashboard-brand">
          <img src="/SH-logo.jpg" alt="StudentHaven" />
          <div><strong>StudentHaven</strong><span>Residence arrival desk</span></div>
        </Link>
        <Link to="/account/security" className="occupancy-security-link">Account security</Link>
      </header>
      <div className="occupancy-shell">
        <LandlordNavigation variant="occupancy" />
        <main className="occupancy-content">
          <div className="occupancy-heading landlord-check-in-heading">
            <div><span className="section-eyebrow">RESIDENCE OPERATIONS</span><h1>Arrival desk</h1><p>Verify a confirmed, fully paid booking and record the real handover when a student arrives at your property.</p></div>
            <div className="checkin-desk-badge"><span aria-hidden="true">●</span> Staff confirmation required</div>
          </div>
          <div className="checkin-steps-strip" aria-label="Check-in steps">
            <div><span>01</span><strong>Scan booking QR</strong></div>
            <div><span>02</span><strong>Verify in person</strong></div>
            <div><span>03</span><strong>Record handover</strong></div>
          </div>
          <CheckInScanner />
        </main>
      </div>
    </div>
  );
}

export default LandlordCheckIn;
