import type { ReactNode } from "react";
import { ArrowLeft, Check, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

interface AuthPageShellProps {
  children: ReactNode;
  panelTitle?: string;
  panelDescription?: string;
  wide?: boolean;
}

const trustPoints = [
  "Find and manage student accommodation in one place",
  "Keep applications, messages and documents together",
  "A clear experience for students and housing providers",
];

function AuthPageShell({
  children,
  panelTitle = "Make room for what comes next.",
  panelDescription = "StudentHaven brings your accommodation journey into one calm, easy-to-manage place.",
  wide = false,
}: AuthPageShellProps) {
  return (
    <div className="auth-page">
      <aside className="auth-brand-panel">
        <Link className="auth-panel-brand" to="/" aria-label="StudentHaven home">
          <img src="/SH-logo.jpg" alt="" />
          <span>
            <strong>STUDENTHAVEN</strong>
            <small>Student accommodation, made clearer</small>
          </span>
        </Link>

        <div className="auth-panel-story">
          <span className="auth-panel-eyebrow">YOUR STUDENT HOUSING JOURNEY</span>
          <h2>{panelTitle}</h2>
          <p>{panelDescription}</p>
          <ul>
            {trustPoints.map((point) => (
              <li key={point}>
                <span className="auth-panel-check"><Check size={15} strokeWidth={2.6} /></span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-panel-location">
          <MapPin size={16} aria-hidden="true" /> Johannesburg, South Africa
        </p>
        <span className="auth-panel-orbit auth-panel-orbit-one" aria-hidden="true" />
        <span className="auth-panel-orbit auth-panel-orbit-two" aria-hidden="true" />
      </aside>

      <main className="auth-main">
        <div className="auth-main-top">
          <Link to="/" className="auth-top-back">
            <ArrowLeft size={17} aria-hidden="true" /> Back to StudentHaven
          </Link>
          <span className="auth-secure-label"><span /> SECURE ACCOUNT ACCESS</span>
        </div>
        <div className={`auth-content${wide ? " auth-content--wide" : ""}`}>
          {children}
        </div>
        <p className="auth-main-caption">StudentHaven · Student accommodation in South Africa</p>
      </main>
    </div>
  );
}

export default AuthPageShell;
