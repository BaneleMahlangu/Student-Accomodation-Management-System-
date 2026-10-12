import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resendEmailVerification, verifyEmailAddress } from "../../services/api";
import "../../App.css";
import AuthPageShell from "../../components/AuthPageShell";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const delivery = searchParams.get("delivery");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState(
    delivery === "sent" && initialEmail
      ? `We sent a six-digit verification code to ${initialEmail}. Codes remain usable for 15 minutes after they are sent.`
      : "",
  );
  const [error, setError] = useState(
    delivery === "failed"
      ? "Your account was created, but the verification email could not be sent. Request a new code below. If it still does not arrive, contact StudentHaven support."
      : "",
  );
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const result = await verifyEmailAddress(email, code);
      setMessage(result.message);
      setVerified(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify this email.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const result = await resendEmailVerification(email);
      setMessage(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request another code.");
    } finally {
      setLoading(false);
    }
  }

  return <AuthPageShell panelTitle="One quick check, then you’re in." panelDescription="Verify your email address to finish setting up your StudentHaven account."><main className="auth-card account-code-card">
    <header className="auth-header"><span className="eyebrow">EMAIL VERIFICATION · STEP 2 OF 2</span><h1>Verify your email</h1><p>Enter a six-digit code sent to this address to activate your account. Each code is valid for 15 minutes after it is sent, so a delayed earlier email can still be used. If it doesn’t arrive, check your spam folder or request another code.</p></header>
    {error && <div className="form-message error-message" role="alert">{error}</div>}
    {message && <div className="form-message success-message" role="status">{message}</div>}
    {verified ? <Link className="auth-primary-button account-code-button" to="/login">Continue to sign in</Link> : <>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setMessage(""); setError(""); }} required /></label>
        <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required /></label>
        <button className="auth-primary-button" type="submit" disabled={loading}>{loading ? "Checking code…" : "Verify email"}</button>
      </form>
      <button className="account-code-resend" onClick={() => void resend()} disabled={loading || !email}>Resend verification code</button>
    </>}
    <p className="auth-footer">Already verified? <Link to="/login">Sign in</Link></p>
  </main></AuthPageShell>;
}

export default VerifyEmail;
