import {
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import "../../App.css";
import AuthPageShell from "../../components/AuthPageShell";
import { getPostLoginPath } from "../../utils/navigation";

import {
  getCurrentUser,
  loginUser,
} from "../../services/api";




function MailIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M21 8.25V18a1.75 1.75 0 0 1-1.75 1.75h-14A1.75 1.75 0 0 1 3.5 18V8.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="M4.25 6.25h15.5a1.25 1.25 0 0 1 .78 2.23l-7.5 5.9a1.65 1.65 0 0 1-2.06 0l-7.5-5.9a1.25 1.25 0 0 1 .78-2.23Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function LockIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="10"
        width="16"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}


function EyeIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2.5 12s3.3-5.5 9.5-5.5S21.5 12 21.5 12 18.2 17.5 12 17.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      <circle
        cx="12"
        cy="12"
        r="2.7"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}


function EyeOffIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="M10.6 6.72A9.8 9.8 0 0 1 12 6.5c6.2 0 9.5 5.5 9.5 5.5a17 17 0 0 1-3.05 3.45M6.74 8.05C4.3 9.5 2.5 12 2.5 12S5.8 17.5 12 17.5c1 0 1.91-.16 2.73-.43"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function ShieldIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 3.5 19 6v5.25c0 4.32-2.73 7.76-7 9.25-4.27-1.49-7-4.93-7-9.25V6l7-2.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function Login() {

  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [rememberMe, setRememberMe] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [requiresVerification, setRequiresVerification] =
    useState(false);

  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);

  const [twoFactorCode, setTwoFactorCode] = useState("");

  const [twoFactorNotice, setTwoFactorNotice] = useState("");


  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {

    event.preventDefault();

    setError("");
    setRequiresVerification(false);

    setLoading(true);

    try {

      const result =
        await loginUser({
          email,
          password,
          ...(requiresTwoFactor && twoFactorCode ? { two_factor_code: twoFactorCode } : {}),
        });

      if (result.requires_two_factor) {
        setRequiresTwoFactor(true);
        setTwoFactorNotice(result.message || "Enter the security code sent to your email.");
        setTwoFactorCode("");
        return;
      }

      setRequiresTwoFactor(false);


      if (
        result.user.role ===
        "STUDENT"
      ) {
        let destination = getPostLoginPath(location.state, result.user.role) || "/student/dashboard";
        try {
          const currentUser = await getCurrentUser();
          if (currentUser.student_profile?.profile_completed !== true) {
            destination = "/student/onboarding";
          }
        } catch {
          // A profile lookup failure should not block an authenticated user from the dashboard.
        }
        navigate(destination, { replace: true });

      } else if (
        result.user.role ===
        "LANDLORD"
      ) {

        navigate(getPostLoginPath(location.state, result.user.role) || "/landlord/dashboard", { replace: true });

      } else if (
        result.user.role ===
        "ADMINISTRATOR"
      ) {

        navigate(getPostLoginPath(location.state, result.user.role) || "/admin/dashboard", { replace: true });

      } else {

        navigate("/", { replace: true });

      }

    } catch (err) {

      const message = err instanceof Error ? err.message : "Unable to sign in.";
      setError(message);
      setRequiresVerification(message.toLowerCase().includes("verify your email"));
      if (message.toLowerCase().includes("sign-in code") || message.toLowerCase().includes("security code")) {
        setRequiresTwoFactor(true);
      }

    } finally {

      setLoading(false);

    }
  };


  return (
    <AuthPageShell
      panelTitle="Welcome back."
      panelDescription="Sign in to pick up where you left off and continue your accommodation journey."
    >

        <div className="auth-card login-card">

          <div className="auth-header">

            <span className="eyebrow">
              WELCOME BACK
            </span>

            <h1>
              Sign in to StudentHaven
            </h1>

            <p>
              Manage your accommodation journey
              from one secure place.
            </p>

          </div>


          {error && (

            <div
              className="form-message error-message"
              role="alert"
            >
              {error}
            </div>

          )}

          {requiresVerification && email && (
            <p className="login-verification-link">
              <Link to={`/verify-email?email=${encodeURIComponent(email)}`}>
                Enter your verification code or request a new one
              </Link>
            </p>
          )}


          <form
            className="auth-form"
            onSubmit={handleSubmit}
          >

            <label>

              <span className="auth-field-label">
                Email address
              </span>

              <span className="auth-input-wrapper">

                <span className="auth-input-icon">
                  <MailIcon />
                </span>

                <input
                  type="email"
                  placeholder="student@example.com"
                  value={email}
                  autoComplete="email"
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  required
                />

              </span>

            </label>

            {requiresTwoFactor && (
              <div className="login-two-factor-block">
                <p role="status">{twoFactorNotice || "Enter the six-digit sign-in code sent to your email."}</p>
                <label>
                  <span className="auth-field-label">Email security code</span>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" />
                </label>
              </div>
            )}


            <label>

              <span className="auth-field-label">
                Password
              </span>

              <span className="auth-input-wrapper">

                <span className="auth-input-icon">
                  <LockIcon />
                </span>

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter your password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  onClick={() =>
                    setShowPassword(
                      (previous) =>
                        !previous
                    )
                  }
                >

                  {showPassword
                    ? <EyeOffIcon />
                    : <EyeIcon />}

                </button>

              </span>

            </label>


            <div className="auth-options">

              <label className="remember-option">

                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) =>
                    setRememberMe(
                      event.target.checked
                    )
                  }
                />

                <span>
                  Remember me
                </span>

              </label>


              <Link to="/forgot-password">
                Forgot password?
              </Link>

            </div>


            <button
              type="submit"
              className="auth-primary-button"
              disabled={loading}
            >

              {loading
                ? "Signing in..."
                : requiresTwoFactor
                  ? twoFactorCode
                    ? "Verify and sign in"
                    : "Send sign-in code"
                  : "Sign In"}

            </button>

          </form>


          <div className="auth-security-note">

            <ShieldIcon />

            <span>
              Your StudentHaven account is protected
              with secure authentication.
            </span>

          </div>


          <div className="auth-divider">
            <span>OR</span>
          </div>


          <p className="auth-footer">

            Don't have an account?{" "}

            <Link to="/register">
              Create an account
            </Link>

          </p>


        </div>
    </AuthPageShell>
  );
}

export default Login;
