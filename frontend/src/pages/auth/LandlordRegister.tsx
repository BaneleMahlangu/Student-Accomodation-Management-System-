import {
  useRef,
  useState,
} from "react";

import type {
  ChangeEvent,
  FormEvent,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import "../../App.css";
import AuthPageShell from "../../components/AuthPageShell";

import {
  registerLandlord,
} from "../../services/api";

import type {
  LandlordRegistrationData,
} from "../../services/api";


function LandlordRegister() {

  const navigate = useNavigate();
  const submissionInProgress = useRef(false);

  const [form, setForm] =
    useState<LandlordRegistrationData>({
      first_name: "",
      last_name: "",
      email: "",
      mobile: "",
      password: "",
      password_confirm: "",

      business_name: "",
      registration_number: "",
      phone: "",
      address: "",
    });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement |
      HTMLTextAreaElement
    >
  ) => {

    const {
      name,
      value,
    } = event.target;

    setForm(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );
  };


  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {

    event.preventDefault();

    setError("");
    if (submissionInProgress.current) return;

    if (
      form.password !==
      form.password_confirm
    ) {
      setError(
        "Passwords do not match."
      );

      return;
    }

    submissionInProgress.current = true;
    setLoading(true);
    let registrationCompleted = false;

    try {

      const result =
        await registerLandlord(form);
      const delivery = result.verification_email_sent === true ? "sent" : "failed";
      registrationCompleted = true;
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}&delivery=${delivery}`, { replace: true });

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );

    } finally {

      if (!registrationCompleted) {
        setLoading(false);
        submissionInProgress.current = false;
      }

    }
  };


  return (
    <AuthPageShell
      panelTitle="Create better places to live and learn."
      panelDescription="Set up your StudentHaven account and manage your accommodation activity in one place."
    >
      <div className="register-card">


        <div className="auth-header">

          <span className="eyebrow">
            LANDLORD REGISTRATION · STEP 1 OF 2
          </span>

          <h1>
            Manage your accommodation
          </h1>

          <p>
            Create your landlord account and
            submit your profile for verification.
          </p>

        </div>


        {error && (
          <div className="form-message error-message">
            {error}
          </div>
        )}



        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          <div className="form-row">

            <label>
              First name

              <input
                name="first_name"
                type="text"
                placeholder="First name"
                value={form.first_name}
                onChange={handleChange}
                required
              />

            </label>


            <label>
              Last name

              <input
                name="last_name"
                type="text"
                placeholder="Last name"
                value={form.last_name}
                onChange={handleChange}
                required
              />

            </label>

          </div>


          <label>
            Email address

            <input
              name="email"
              type="email"
              placeholder="landlord@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />

          </label>


          <label>
            Mobile number

            <input
              name="mobile"
              type="tel"
              placeholder="0712345678"
              value={form.mobile}
              onChange={handleChange}
              required
            />

          </label>


          <label>
            Business / landlord name

            <input
              name="business_name"
              type="text"
              placeholder="Your business or landlord name"
              value={form.business_name}
              onChange={handleChange}
              required
            />

          </label>


          <label>
            Business registration number
            <span className="field-help">
              Optional if you are registering as an individual landlord.
            </span>

            <input
              name="registration_number"
              type="text"
              placeholder="Registration number"
              value={form.registration_number}
              onChange={handleChange}
            />

          </label>


          <label>
            Business/contact phone

            <input
              name="phone"
              type="tel"
              placeholder="Business contact number"
              value={form.phone}
              onChange={handleChange}
              required
            />

          </label>


          <label>
            Business or residential address

            <textarea
              name="address"
              placeholder="Enter your address"
              value={form.address}
              onChange={handleChange}
              rows={4}
              required
            />

          </label>


          <div className="form-row">

            <label>
              Password

              <input
                name="password"
                type="password"
                placeholder="Create password"
                value={form.password}
                onChange={handleChange}
                required
              />

            </label>


            <label>
              Confirm password

              <input
                name="password_confirm"
                type="password"
                placeholder="Confirm password"
                value={form.password_confirm}
                onChange={handleChange}
                required
              />

            </label>

          </div>


          <label className="terms-option">

            <input
              type="checkbox"
              required
            />

            <span>
              I agree to the StudentHaven terms,
              privacy policy and verification
              requirements.
            </span>

          </label>


          <button
            type="submit"
            className="auth-primary-button"
            disabled={loading}
          >
            {loading
              ? "Creating landlord account..."
              : "Create Landlord Account"}
          </button>

        </form>


        <p className="auth-footer">

          Already have an account?{" "}

          <Link to="/login">
            Sign in
          </Link>

        </p>

        <p className="auth-footer">
          Already started registration?{" "}
          <Link to="/verify-email">Verify your email</Link>
        </p>


        <Link
          to="/register"
          className="back-home"
        >
          ← Choose another role
        </Link>

      </div>

    </AuthPageShell>
  );
}

export default LandlordRegister;
