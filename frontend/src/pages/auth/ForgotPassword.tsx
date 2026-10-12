import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { confirmPasswordReset, requestPasswordReset } from "../../services/api";
import "../../App.css";
import AuthPageShell from "../../components/AuthPageShell";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [requested, setRequested] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const result = await requestPasswordReset(email);
      setMessage(result.message);
      setRequested(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request a reset code.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password !== passwordConfirm) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const result = await confirmPasswordReset({
        email,
        code,
        new_password: password,
        password_confirm: passwordConfirm,
      });
      setMessage(result.message);
      setComplete(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reset the password.");
    } finally {
      setLoading(false);
    }
  }

  return <AuthPageShell panelTitle="A secure way back into your account." panelDescription="We’ll help you reset your password and get back to your StudentHaven journey."><main className="auth-card account-code-card">
    <header className="auth-header"><span className="eyebrow">ACCOUNT RECOVERY</span><h1>{complete ? "Password updated" : "Reset your password"}</h1><p>{complete ? "Your account is ready to use with the new password." : "We’ll email a one-time code so you can set a new password securely."}</p></header>
    {error && <div className="form-message error-message" role="alert">{error}</div>}
    {message && <div className="form-message success-message" role="status">{message}</div>}
    {complete ? <Link className="auth-primary-button account-code-button" to="/login">Continue to sign in</Link> : !requested ? <form className="auth-form" onSubmit={(event) => void requestCode(event)}>
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <button className="auth-primary-button" type="submit" disabled={loading}>{loading ? "Requesting code…" : "Email me a reset code"}</button>
    </form> : <form className="auth-form" onSubmit={(event) => void resetPassword(event)}>
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Reset code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required /></label>
      <label>New password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} required /></label>
      <button className="auth-primary-button" type="submit" disabled={loading}>{loading ? "Updating password…" : "Update password"}</button>
    </form>}
    {!complete && requested && <button className="account-code-resend" onClick={() => { setRequested(false); setMessage(""); }}>Use another email address</button>}
    <p className="auth-footer"><Link to="/login">Back to sign in</Link></p>
  </main></AuthPageShell>;
}

export default ForgotPassword;
