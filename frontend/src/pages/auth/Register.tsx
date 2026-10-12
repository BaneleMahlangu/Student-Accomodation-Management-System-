import { useRef, useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import "../../App.css";
import AuthPageShell from "../../components/AuthPageShell";
import { registerStudent } from "../../services/api";
import type { StudentRegistrationData } from "../../services/api";
import { getSouthAfricanIdBirthDate } from "../../utils/southAfricanId";

type RegistrationField = keyof StudentRegistrationData;


function Register() {
  const navigate = useNavigate();
  const submissionInProgress = useRef(false);

  const [form, setForm] =
    useState<StudentRegistrationData>({
      first_name: "",
      last_name: "",
      email: "",
      mobile: "",
      password: "",
      password_confirm: "",
      student_number: "",
      national_id: "",
      date_of_birth: "",
      university: "",
      campus: "",
      course: "",
      year_of_study: 1,
    });

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegistrationField, string>>>({});

  const renderFieldError = (field: RegistrationField) => fieldErrors[field]
    ? <small className="field-error" role="alert">{fieldErrors[field]}</small>
    : null;


  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>

  ) => {
    const { name, value } = event.target;
    setFieldErrors((previous) => ({ ...previous, [name]: undefined }));
    setError("");

    setForm((previous) => ({
      ...previous,
      [name]:
        name === "year_of_study"
          ? Number(value)
          : value,
    }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setFieldErrors({});
    if (submissionInProgress.current) return;

    if (form.password !== form.password_confirm) {
      setFieldErrors({ password_confirm: "Passwords do not match." });
      return;
    }

    const idBirthDate = getSouthAfricanIdBirthDate(form.national_id);
    if (!idBirthDate) {
      setFieldErrors({ national_id: "Enter a valid 13-digit South African ID number." });
      return;
    }
    if (idBirthDate !== form.date_of_birth) {
      setFieldErrors({ date_of_birth: "This date must match the date encoded in your ID number." });
      return;
    }

    submissionInProgress.current = true;
    setLoading(true);
    let registrationCompleted = false;

    try {
      const result = await registerStudent(form);
      const delivery = result.verification_email_sent === true ? "sent" : "failed";
      registrationCompleted = true;
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}&delivery=${delivery}`, { replace: true });

    } catch (err) {

      const message = err instanceof Error ? err.message : "Something went wrong.";
      try {
        const parsed = JSON.parse(message) as Record<string, unknown>;
        const nextFieldErrors: Partial<Record<RegistrationField, string>> = {};
        const formMessages: string[] = [];
        Object.entries(parsed).forEach(([field, value]) => {
          const messageText = Array.isArray(value) ? value.join(" ") : String(value);
          if (field in form) {
            nextFieldErrors[field as RegistrationField] = messageText;
          } else {
            formMessages.push(messageText);
          }
        });
        if (Object.keys(nextFieldErrors).length > 0) {
          setFieldErrors(nextFieldErrors);
          if (formMessages.length > 0) setError(formMessages.join(" "));
        } else {
          setError(message);
        }
      } catch {
        setError(message);
      }

    } finally {
      if (!registrationCompleted) {
        setLoading(false);
        submissionInProgress.current = false;
      }
    }
  };

  return (
    <AuthPageShell
      panelTitle="A place to begin your next chapter."
      panelDescription="Create your student account to discover housing and manage each step of your accommodation journey."
    >
      <div className="register-card">

        <div className="auth-header">

          <span className="eyebrow">
            CREATE ACCOUNT · STEP 1 OF 2
          </span>

          <h1>
            Join StudentHaven
          </h1>

          <p>
            Create your student account and start
            your accommodation journey.
          </p>

        </div>

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
              {renderFieldError("first_name")}

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
              {renderFieldError("last_name")}

            </label>

          </div>

          <label>
            Student number

            <input
              name="student_number"
              type="text"
              placeholder="e.g. 202600002"
              value={form.student_number}
              onChange={handleChange}
              required
            />
            {renderFieldError("student_number")}

          </label>

          <div className="form-row">
            <label>
              South African ID number
              <input
                name="national_id"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={13}
                placeholder="13-digit ID number"
                value={form.national_id}
                onChange={handleChange}
                required
              />
              {renderFieldError("national_id")}
            </label>

            <label>
              Date of birth
              <input
                name="date_of_birth"
                type="date"
                value={form.date_of_birth}
                onChange={handleChange}
                required
              />
              {renderFieldError("date_of_birth")}
            </label>
          </div>

          <label>
            Email address

            <input
              name="email"
              type="email"
              placeholder="student@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
            {renderFieldError("email")}

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
            {renderFieldError("mobile")}

          </label>

          <label>
            University

            <select
              name="university"
              value={form.university}
              onChange={handleChange}
              required
            >
              <option value="">
                Select university
              </option>

              <option>
                Sol Plaatje University
              </option>

              <option>
                University of the Free State
              </option>

              <option>
                University of Johannesburg
              </option>

            </select>
            {renderFieldError("university")}

          </label>

          <label>
            Campus

            <select
              name="campus"
              value={form.campus}
              onChange={handleChange}
              required
            >

              <option value="">
                Select campus
              </option>

              <option>
                SPU Main Campus
              </option>

              <option>
                UFS Bloemfontein Campus
              </option>

              <option>
                UJ APK Campus
              </option>

            </select>
            {renderFieldError("campus")}

          </label>

          <label>
            Course

            <input
              name="course"
              type="text"
              placeholder="Your course"
              value={form.course}
              onChange={handleChange}
              required
            />
            {renderFieldError("course")}

          </label>

          <label>
            Year of study

            <select
              name="year_of_study"
              value={form.year_of_study}
              onChange={handleChange}
              required
            >
              <option value={1}>Year 1</option>
              <option value={2}>Year 2</option>
              <option value={3}>Year 3</option>
              <option value={4}>Year 4</option>
              <option value={5}>Year 5</option>
            </select>
            {renderFieldError("year_of_study")}

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
              {renderFieldError("password")}

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
              {renderFieldError("password_confirm")}

            </label>

          </div>

          <label className="terms-option">

            <input
              type="checkbox"
              required
            />

            <span>
              I agree to the StudentHaven terms,
              privacy policy and data processing
              requirements.
            </span>

          </label>

          <button
            type="submit"
            className="auth-primary-button"
            disabled={loading}
          >
            {loading
              ? "Creating account..."
              : "Create Student Account"}
          </button>

        </form>

        {error && (
          <div className="form-message error-message" role="alert">
            {error}
          </div>
        )}

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
          to="/"
          className="back-home"
        >
          ← Back to StudentHaven
        </Link>

      </div>

    </AuthPageShell>
  );
}

export default Register;
