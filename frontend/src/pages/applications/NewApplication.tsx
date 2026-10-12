import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  API_BASE_URL,
  getCurrentUser,
  getMyApplications,
  getProperty,
  getStudentDocuments,
  updateStudentProfile,
} from "../../services/api";
import type {
  Property,
  Room,
  DocumentType,
  StudentDocument,
  StudentProfileUpdatePayload,
} from "../../services/api";
import { ApplicationPeriodNotice, PlatformAnnouncements } from "../../components/PlatformAnnouncements";
import { getRoomGalleryImages } from "../../data/accommodationImages";
import { getSouthAfricanIdBirthDate } from "../../utils/southAfricanId";

type FormData = {
  national_id: string;
  date_of_birth: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;

  academic_year: string;
  university: string;
  campus: string;
  course: string;
  year_of_study: string;

  expected_sign_in_date: string;
  expected_sign_out_date: string;
  meal_preference: string;
  accessibility_required: boolean;
  accessibility_notes: string;
  student_notes: string;

  funding_method: string;
  funding_notes: string;
};

const initialForm: FormData = {
  national_id: "",
  date_of_birth: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",

  academic_year: "",
  university: "",
  campus: "",
  course: "",
  year_of_study: "",

  expected_sign_in_date: "",
  expected_sign_out_date: "",
  meal_preference: "",
  accessibility_required: false,
  accessibility_notes: "",
  student_notes: "",

  funding_method: "",
  funding_notes: "",
};

const steps = [
  {
    number: 1,
    title: "Personal Information",
    description: "Tell us about yourself.",
  },
  {
    number: 2,
    title: "Emergency Contact",
    description: "Provide someone we can contact in an emergency.",
  },
  {
    number: 3,
    title: "Academic Information",
    description: "Tell us about your studies.",
  },
  {
    number: 4,
    title: "Accommodation Preferences",
    description: "Tell us about your intended stay and requirements.",
  },
  {
    number: 5,
    title: "Funding & Financial Information",
    description: "Tell us how you intend to fund your accommodation.",
  },
  {
    number: 6,
    title: "Review & Submit",
    description: "Review your application before submitting.",
  },
];

const REQUIRED_DOCUMENT_TYPES: DocumentType[] = [
  "PROOF_OF_REGISTRATION",
  "STUDENT_ID",
];

function formatDate(date: string) {
  if (!date) return "Not provided";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function NewApplication() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const propertyId = searchParams.get("property");
  const roomId = searchParams.get("room");
  const selectedRoomPath = propertyId && roomId
    ? `/accommodation/${encodeURIComponent(propertyId)}/rooms/${encodeURIComponent(roomId)}`
    : "/accommodation";

  const [property, setProperty] = useState<Property | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const [form, setForm] = useState<FormData>(initialForm);

  const [currentStep, setCurrentStep] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [requiredDocumentsUploaded, setRequiredDocumentsUploaded] = useState(false);
  const [documentsChecked, setDocumentsChecked] = useState(false);

  const [applicationId, setApplicationId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAccommodation() {
      if (!propertyId || !roomId) {
        if (active) {
          setError("No property or room was selected.");
          setLoading(false);
        }
        return;
      }

      try {
        const [user, applications] = await Promise.all([
          getCurrentUser(),
          getMyApplications(),
        ]);

        const selectedPropertyId = Number(propertyId);
        const selectedRoomId = Number(roomId);
        const matchingApplications = applications.filter(
          (application) =>
            application.property === selectedPropertyId &&
            application.room === selectedRoomId,
        );
        const existingDraft = matchingApplications.find(
          (application) => application.status === "DRAFT",
        );
        const activeApplication = matchingApplications.find((application) =>
          [
            "SUBMITTED",
            "UNDER_REVIEW",
            "ADDITIONAL_INFO",
            "APPROVED",
            "WAITING_LIST",
            "WAITLISTED",
          ].includes(application.status),
        );

        if (activeApplication) {
          navigate(`/applications/${activeApplication.id}`, { replace: true });
          return;
        }

        const propertyData = await getProperty(selectedPropertyId);

        if (!active) return;
        setProperty(propertyData);

        const room = propertyData.rooms?.find(
          (item) => Number(item.id) === selectedRoomId
        );

        if (!room) {
          setError("The selected room could not be found.");
          return;
        }

        const profile = user.student_profile;
        const previousApplication = applications.find(
          (application) => application.status !== "DRAFT",
        );
        const profileForm: FormData = {
          ...initialForm,
          national_id: profile?.national_id || "",
          date_of_birth:
            profile?.date_of_birth || previousApplication?.date_of_birth || "",
          emergency_contact_name:
            profile?.emergency_contact_name ||
            previousApplication?.emergency_contact_name ||
            "",
          emergency_contact_phone:
            profile?.emergency_contact_phone ||
            previousApplication?.emergency_contact_phone ||
            "",
          academic_year: String(new Date().getFullYear()),
          university: profile?.university || previousApplication?.university || "",
          campus: profile?.campus || previousApplication?.campus || "",
          course: profile?.course || previousApplication?.course || "",
          year_of_study: String(
            profile?.year_of_study ?? previousApplication?.year_of_study ?? "",
          ),
          accessibility_required:
            profile?.accommodation_preferences?.accessible ??
            previousApplication?.accessibility_required ??
            false,
          accessibility_notes:
            profile?.accessibility_requirements ||
            previousApplication?.accessibility_notes ||
            "",
        };

        if (existingDraft) {
          setApplicationId(existingDraft.id);
          setCurrentStep(
            Math.min(6, Math.max(1, Number(existingDraft.current_step) || 1)),
          );
          setForm({
            ...profileForm,
            date_of_birth: existingDraft.date_of_birth || "",
            emergency_contact_name: existingDraft.emergency_contact_name || "",
            emergency_contact_phone: existingDraft.emergency_contact_phone || "",
            academic_year: String(existingDraft.academic_year || new Date().getFullYear()),
            university: existingDraft.university || profileForm.university,
            campus: existingDraft.campus || profileForm.campus,
            course: existingDraft.course || profileForm.course,
            year_of_study: String(existingDraft.year_of_study || profileForm.year_of_study),
            expected_sign_in_date: existingDraft.expected_sign_in_date || "",
            expected_sign_out_date: existingDraft.expected_sign_out_date || "",
            meal_preference: existingDraft.meal_preference || "",
            accessibility_required: existingDraft.accessibility_required,
            accessibility_notes: existingDraft.accessibility_notes || "",
            student_notes: existingDraft.student_notes || "",
            funding_method:
              existingDraft.funding_method === "NOT_SELECTED"
                ? ""
                : existingDraft.funding_method,
            funding_notes: existingDraft.funding_notes || "",
          });
          setDraftRestored(true);
        } else {
          setForm(profileForm);
        }

        setSelectedRoom(room);
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load your saved application and accommodation.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAccommodation();
    return () => {
      active = false;
    };
  }, [propertyId, roomId, navigate]);

  useEffect(() => {
    if (currentStep !== 6 || applicationId === null) return;

    let active = true;
    setDocumentsChecked(false);
    getStudentDocuments(applicationId)
      .then((documents) => {
        if (!active) return;
        const latestByType = new Map<DocumentType, StudentDocument>();
        [...documents]
          .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime() || b.id - a.id)
          .forEach((document) => {
            if (!latestByType.has(document.document_type)) {
              latestByType.set(document.document_type, document);
            }
          });
        setRequiredDocumentsUploaded(
          REQUIRED_DOCUMENT_TYPES.every((type) => {
            const document = latestByType.get(type);
            return Boolean(document && document.status !== "REJECTED");
          }),
        );
      })
      .catch(() => {
        if (active) setRequiredDocumentsUploaded(false);
      })
      .finally(() => {
        if (active) setDocumentsChecked(true);
      });

    return () => {
      active = false;
    };
  }, [applicationId, currentStep]);

  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const getCSRFToken = async () => {
    const response = await fetch(
      `${API_BASE_URL}/accounts/csrf/`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Unable to initialise secure application submission.");
    }

    const cookies = document.cookie.split(";");

    const csrfCookie = cookies.find((cookie) =>
      cookie.trim().startsWith("csrftoken=")
    );

    if (!csrfCookie) {
      return null;
    }

    return decodeURIComponent(
      csrfCookie.trim().substring("csrftoken=".length)
    );
  };

  const createDraftApplication = async () => {
    if (!propertyId || !roomId) {
      throw new Error("Property and room are required.");
    }

    const csrfToken = await getCSRFToken();

    const response = await fetch(
      `${API_BASE_URL}/applications/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken
            ? { "X-CSRFToken": csrfToken }
            : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          property: Number(propertyId),
          room: Number(roomId),
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.message ||
        result?.detail ||
        "Unable to create the application."
      );
    }

    return result.application;
  };

  const saveApplication = async (
    id: number,
    step: number
  ) => {
    const csrfToken = await getCSRFToken();

    const response = await fetch(
      `${API_BASE_URL}/applications/${id}/`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken
            ? { "X-CSRFToken": csrfToken }
            : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          date_of_birth:
            form.date_of_birth || null,

          emergency_contact_name:
            form.emergency_contact_name,

          emergency_contact_phone:
            form.emergency_contact_phone,

          academic_year:
            form.academic_year,

          university:
            form.university,

          campus:
            form.campus,

          course:
            form.course,

          year_of_study:
            form.year_of_study
              ? Number(form.year_of_study)
              : null,

          expected_sign_in_date:
            form.expected_sign_in_date || null,

          expected_sign_out_date:
            form.expected_sign_out_date || null,

          meal_preference:
            form.meal_preference,

          accessibility_required:
            form.accessibility_required,

          accessibility_notes:
            form.accessibility_notes,

          student_notes:
            form.student_notes,

          funding_method:
            form.funding_method,

          funding_notes:
            form.funding_notes,

          current_step: step,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.message ||
        result?.detail ||
        "Unable to save your application."
      );
    }

    return result.application;
  };

  const syncReusableProfileAnswers = async (step: number) => {
    const profileUpdates: Partial<StudentProfileUpdatePayload> = {};

    if (step === 1) {
      profileUpdates.national_id = form.national_id;
      profileUpdates.date_of_birth = form.date_of_birth;
    } else if (step === 2) {
      profileUpdates.emergency_contact_name = form.emergency_contact_name.trim();
      profileUpdates.emergency_contact_phone = form.emergency_contact_phone.trim();
    } else if (step === 3) {
      profileUpdates.university = form.university.trim();
      profileUpdates.campus = form.campus.trim();
      profileUpdates.course = form.course.trim();
      profileUpdates.year_of_study = form.year_of_study
        ? Number(form.year_of_study)
        : null;
    } else if (step === 4 && form.accessibility_required) {
      profileUpdates.accessibility_requirements = form.accessibility_notes.trim();
    }

    if (Object.keys(profileUpdates).length > 0) {
      await updateStudentProfile(profileUpdates);
    }
  };

  const validateStep = () => {
    setError("");

    if (currentStep === 1) {
      if (!form.date_of_birth) {
        setError("Please enter your date of birth.");
        return false;
      }

      const idBirthDate = getSouthAfricanIdBirthDate(form.national_id);
      if (!idBirthDate) {
        setError("Enter a valid 13-digit South African ID number.");
        return false;
      }
      if (idBirthDate !== form.date_of_birth) {
        setError("Your date of birth must match the date encoded in your ID number.");
        return false;
      }
    }

    if (currentStep === 2) {
      if (!form.emergency_contact_name.trim()) {
        setError("Please enter your emergency contact name.");
        return false;
      }

      if (!form.emergency_contact_phone.trim()) {
        setError("Please enter your emergency contact phone number.");
        return false;
      }
    }

    if (currentStep === 3) {
      if (!form.academic_year) {
        setError("Please enter your academic year.");
        return false;
      }

      if (!form.university.trim()) {
        setError("Please enter your university.");
        return false;
      }

      if (!form.campus.trim()) {
        setError("Please enter your campus.");
        return false;
      }

      if (!form.course.trim()) {
        setError("Please enter your course or programme.");
        return false;
      }

      if (!form.year_of_study) {
        setError("Please select your year of study.");
        return false;
      }
    }

    if (currentStep === 4) {
      if (!form.expected_sign_in_date) {
        setError("Please select your expected sign-in date.");
        return false;
      }

      if (!form.expected_sign_out_date) {
        setError("Please select your expected sign-out date.");
        return false;
      }

      if (
        form.expected_sign_in_date &&
        form.expected_sign_out_date &&
        form.expected_sign_out_date <= form.expected_sign_in_date
      ) {
        setError(
          "Your sign-out date must be after your sign-in date."
        );
        return false;
      }

      if (!form.meal_preference) {
        setError("Please select a meal preference.");
        return false;
      }

      if (
        form.accessibility_required &&
        !form.accessibility_notes.trim()
      ) {
        setError(
          "Please provide details about your accessibility requirements."
        );
        return false;
      }
    }

    if (currentStep === 5) {
      if (!form.funding_method) {
        setError("Please select your funding method.");
        return false;
      }
    }

    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      let id = applicationId;

      if (id === null) {
        const application = await createDraftApplication();

        id = application.id;

        setApplicationId(id);
      }

      if (id === null) {
        throw new Error("Application ID is missing.");
      }

      await saveApplication(id, currentStep + 1);
      await syncReusableProfileAnswers(currentStep);

      if (currentStep < 6) {
        setCurrentStep((previous) => previous + 1);
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save your application."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
  if (!applicationId) {
    setError("Unable to submit your application.");
    return;
  }

  if (!requiredDocumentsUploaded) {
    setError("Upload your proof of registration and student ID before submitting.");
    return;
  }

  setSaving(true);
  setError("");
  setSuccessMessage("");

  try {
    await getCSRFToken();

    const response = await fetch(
      `${API_BASE_URL}/applications/${applicationId}/submit/`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken":
            document.cookie
              .split("; ")
              .find((row) => row.startsWith("csrftoken="))
              ?.split("=")[1] || "",
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.message ||
        result?.detail ||
        "Unable to submit your application."
      );
    }

    setSuccessMessage(
      "Your application has been submitted successfully."
    );

    setTimeout(() => {
      navigate(`/applications/${applicationId}`, { replace: true });
    }, 1200);
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Unable to submit your application."
    );
  } finally {
    setSaving(false);
  }
};

  const handlePrevious = () => {
    setError("");

    if (currentStep > 1) {
      setCurrentStep((previous) => previous - 1);
    }
  };

  const selectedBedCount = useMemo(() => {
    if (!selectedRoom?.beds) {
      return 0;
    }

    return selectedRoom.beds.filter(
      (bed) => bed.status === "AVAILABLE"
    ).length;
  }, [selectedRoom]);

  if (loading) {
    return (
      <div className="application-page">
        <div className="application-container">
          <div className="application-loading">
            <div className="application-spinner" />
            <p>Loading your selected accommodation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && (!property || !selectedRoom)) {
    return (
      <div className="application-page">
        <div className="application-container">
          <div className="application-error-card">
            <div className="application-error-icon">!</div>
            <h2>Unable to start application</h2>
            <p>{error}</p>

            <button
              type="button"
              className="primary-button"
              onClick={() => navigate("/accommodation", { replace: true })}
            >
              Browse accommodation
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedRoomImage = property && selectedRoom
    ? getRoomGalleryImages(property.id, selectedRoom.id, selectedRoom.images)[0]
    : null;

  return (
    <div className="application-page">
      <div className="application-container">

        <PlatformAnnouncements />
        <ApplicationPeriodNotice />

        {/* Header */}
        <div className="application-header">
          <button
            type="button"
            className="back-link"
            onClick={() => navigate(selectedRoomPath, { replace: true })}
          >
            ← Back to selected room
          </button>

          <div className="application-title-row">
            <div>
              <span className="eyebrow">
                STUDENTHAVEN APPLICATION
              </span>

              <h1>Accommodation Application</h1>

              <p>
                Complete your information to apply for your
                selected room.
              </p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="application-progress">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className={`progress-step ${currentStep === step.number
                ? "active"
                : currentStep > step.number
                  ? "completed"
                  : ""
                }`}
            >
              <div className="progress-number">
                {currentStep > step.number ? "✓" : step.number}
              </div>

              <div className="progress-text">
                <strong>{step.title}</strong>
                <span>{step.description}</span>
              </div>

              {index < steps.length - 1 && (
                <div className="progress-line" />
              )}
            </div>
          ))}
        </div>

        {/* Selected Room */}
        {property && selectedRoom && (
          <div className="selected-room-card">
            <div className="selected-room-image">
              {selectedRoomImage ? (
                <img
                  src={selectedRoomImage.url}
                  alt={selectedRoomImage.caption || `Room ${selectedRoom.room_number}`}
                />
              ) : (
                <div className="room-image-placeholder">
                  SH
                </div>
              )}
            </div>

            <div className="selected-room-content">
              <div className="selected-room-label">
                SELECTED ROOM
              </div>

              <h2>{property.name}</h2>

              <h3>
                Room {selectedRoom.room_number}
              </h3>

              <div className="selected-room-details">
                <span>
                  {selectedRoom.room_type}
                </span>

                <span>
                  {selectedRoom.monthly_price
                    ? `R${Number(
                      selectedRoom.monthly_price
                    ).toLocaleString()} / month`
                    : "Monthly rate available"}
                </span>

                <span>
                  {selectedBedCount} available bed
                  {selectedBedCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className="selected-room-status">
              <span className="status-dot" />
              Room selected
            </div>
          </div>
        )}

        {/* Important Notice */}
        <div className="application-notice">
          <div className="notice-icon">i</div>

          <div>
            <strong>Important</strong>

            <p>
              Selecting this room does not confirm your
              accommodation. Your application will be reviewed
              by an administrator before the room can be
              officially approved.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="application-form-card">

          {/* Error */}
          {error && (
            <div className="form-error">
              <strong>Please check the following:</strong>
              <span>{error}</span>
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="form-success">
              <strong>Application submitted</strong>
              <span>{successMessage}</span>
            </div>
          )}
          {draftRestored && !successMessage && (
            <div className="form-success" role="status">
              <strong>Saved draft restored</strong>
              <span>Your previous answers are back. Continue from step {currentStep}.</span>
            </div>
          )}

          {/* STEP 1 */}
          {currentStep === 1 && (
            <section>
              <div className="form-section-heading">
                <span className="section-number">01</span>

                <div>
                  <h2>Personal Information</h2>
                  <p>
                    Tell us about yourself so we can complete
                    your accommodation application.
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label>South African ID Number *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={13}
                    placeholder="13-digit ID number"
                    value={form.national_id}
                    onChange={(event) => updateField("national_id", event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Date of Birth *</label>

                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(event) =>
                      updateField(
                        "date_of_birth",
                        event.target.value
                      )
                    }
                  />
                </div>
              </div>
            </section>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <section>
              <div className="form-section-heading">
                <span className="section-number">02</span>

                <div>
                  <h2>Emergency Contact</h2>
                  <p>
                    Provide someone we can contact if an
                    emergency occurs.
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label>Emergency Contact Name *</label>

                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={form.emergency_contact_name}
                    onChange={(event) =>
                      updateField(
                        "emergency_contact_name",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Emergency Contact Phone *</label>

                  <input
                    type="tel"
                    placeholder="e.g. 071 234 5678"
                    value={form.emergency_contact_phone}
                    onChange={(event) =>
                      updateField(
                        "emergency_contact_phone",
                        event.target.value
                      )
                    }
                  />
                </div>
              </div>
            </section>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <section>
              <div className="form-section-heading">
                <span className="section-number">03</span>

                <div>
                  <h2>Academic Information</h2>
                  <p>
                    Tell us about your current studies.
                  </p>
                </div>
              </div>

              <div className="form-grid">

                <div className="form-field">
                  <label>Academic Year *</label>

                  <select
                    value={form.academic_year}
                    onChange={(event) =>
                      updateField(
                        "academic_year",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select academic year
                    </option>

                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                    <option value="2029">2029</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>University *</label>

                  <input
                    type="text"
                    placeholder="Enter your university"
                    value={form.university}
                    onChange={(event) =>
                      updateField(
                        "university",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Campus *</label>

                  <input
                    type="text"
                    placeholder="Enter your campus"
                    value={form.campus}
                    onChange={(event) =>
                      updateField(
                        "campus",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Course / Programme *</label>

                  <input
                    type="text"
                    placeholder="e.g. Diploma in ICT"
                    value={form.course}
                    onChange={(event) =>
                      updateField(
                        "course",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Year of Study *</label>

                  <select
                    value={form.year_of_study}
                    onChange={(event) =>
                      updateField(
                        "year_of_study",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select year
                    </option>

                    <option value="1">First Year</option>
                    <option value="2">Second Year</option>
                    <option value="3">Third Year</option>
                    <option value="4">Fourth Year</option>
                    <option value="5">Fifth Year</option>
                  </select>
                </div>

              </div>
            </section>
          )}

          {/* STEP 4 */}
          {currentStep === 4 && (
            <section>
              <div className="form-section-heading">
                <span className="section-number">04</span>

                <div>
                  <h2>Accommodation Preferences</h2>

                  <p>
                    Tell us when you intend to stay and about
                    your accommodation requirements.
                  </p>
                </div>
              </div>

              <div className="form-subsection">
                <h3>Residence Period</h3>

                <p>
                  Provide the period you expect to stay in the
                  residence.
                </p>
              </div>

              <div className="form-grid">

                <div className="form-field">
                  <label>Expected Sign-in Date *</label>

                  <input
                    type="date"
                    value={form.expected_sign_in_date}
                    onChange={(event) =>
                      updateField(
                        "expected_sign_in_date",
                        event.target.value
                      )
                    }
                  />

                  <small>
                    The date you expect to move into the
                    residence.
                  </small>
                </div>

                <div className="form-field">
                  <label>Expected Sign-out Date *</label>

                  <input
                    type="date"
                    value={form.expected_sign_out_date}
                    min={form.expected_sign_in_date || undefined}
                    onChange={(event) =>
                      updateField(
                        "expected_sign_out_date",
                        event.target.value
                      )
                    }
                  />

                  <small>
                    The date you expect to leave the
                    residence.
                  </small>
                </div>

              </div>

              <div className="form-subsection">
                <h3>Meal Preference</h3>

                <p>
                  Select the meal option that best suits your
                  needs.
                </p>
              </div>

              <div className="meal-options">

                {[
                  {
                    value: "NO_MEAL_PLAN",
                    label: "No meal plan",
                    description:
                      "I do not require meals.",
                  },
                  {
                    value: "STANDARD",
                    label: "Standard meal plan",
                    description:
                      "I would like the standard meal option.",
                  },
                  {
                    value: "VEGETARIAN",
                    label: "Vegetarian",
                    description:
                      "I require vegetarian meals.",
                  },
                  {
                    value: "HALAL",
                    label: "Halal",
                    description:
                      "I require halal meals.",
                  },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`meal-option ${form.meal_preference === option.value
                      ? "selected"
                      : ""
                      }`}
                  >
                    <input
                      type="radio"
                      name="meal_preference"
                      value={option.value}
                      checked={
                        form.meal_preference ===
                        option.value
                      }
                      onChange={(event) =>
                        updateField(
                          "meal_preference",
                          event.target.value
                        )
                      }
                    />

                    <div>
                      <strong>{option.label}</strong>

                      <span>
                        {option.description}
                      </span>
                    </div>
                  </label>
                ))}

              </div>

              <div className="form-subsection">
                <h3>Accessibility Requirements</h3>

                <p>
                  Let us know if you require accessible
                  accommodation facilities.
                </p>
              </div>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.accessibility_required}
                  onChange={(event) =>
                    updateField(
                      "accessibility_required",
                      event.target.checked
                    )
                  }
                />

                <span>
                  I have accessibility requirements.
                </span>
              </label>

              {form.accessibility_required && (
                <div className="form-field full-width">
                  <label>
                    Accessibility Details *
                  </label>

                  <textarea
                    rows={4}
                    placeholder="Please describe your accessibility requirements..."
                    value={form.accessibility_notes}
                    onChange={(event) =>
                      updateField(
                        "accessibility_notes",
                        event.target.value
                      )
                    }
                  />
                </div>
              )}

              <div className="form-field full-width">
                <label>
                  Additional Accommodation Notes
                </label>

                <textarea
                  rows={4}
                  placeholder="Anything else we should know about your accommodation requirements?"
                  value={form.student_notes}
                  onChange={(event) =>
                    updateField(
                      "student_notes",
                      event.target.value
                    )
                  }
                />
              </div>
            </section>
          )}

          {/* STEP 5 */}
          {currentStep === 5 && (
            <section>
              <div className="form-section-heading">
                <span className="section-number">05</span>

                <div>
                  <h2>Funding & Financial Information</h2>

                  <p>
                    Tell us how you intend to fund your
                    accommodation.
                  </p>
                </div>
              </div>

              <div className="funding-options">

                {[
                  {
                    value: "STUDENT_FUNDING",
                    label: "NSFAS / Student Funding",
                    description:
                      "Accommodation will be funded through NSFAS or another student funding programme.",
                  },
                  {
                    value: "BURSARY",
                    label: "Bursary",
                    description:
                      "Accommodation will be funded through a bursary.",
                  },
                  {
                    value: "SELF_PAY",
                    label: "Self-funded",
                    description:
                      "I will pay for the accommodation myself.",
                  },
                  {
                    value: "SPONSORSHIP",
                    label: "Sponsor",
                    description:
                      "Accommodation will be funded by a sponsor.",
                  },
                  {

                    value: "MIXED",
                    label: "Mixed / Other Funding",
                    description:
                      "My accommodation will be paid through a combination of funding sources.",
                  },



                ].map((option) => (
                  <label
                    key={option.value}
                    className={`funding-option ${form.funding_method === option.value
                      ? "selected"
                      : ""
                      }`}
                  >
                    <input
                      type="radio"
                      name="funding_method"
                      value={option.value}
                      checked={
                        form.funding_method ===
                        option.value
                      }
                      onChange={(event) =>
                        updateField(
                          "funding_method",
                          event.target.value
                        )
                      }
                    />

                    <div>
                      <strong>{option.label}</strong>

                      <span>
                        {option.description}
                      </span>
                    </div>
                  </label>
                ))}

              </div>

              <div className="form-field full-width">
                <label>Funding Notes</label>

                <textarea
                  rows={4}
                  placeholder="Add any relevant funding information..."
                  value={form.funding_notes}
                  onChange={(event) =>
                    updateField(
                      "funding_notes",
                      event.target.value
                    )
                  }
                />
              </div>
            </section>
          )}

          {/* STEP 6 */}
          {currentStep === 6 && (
            <section>
              <div className="form-section-heading">
                <span className="section-number">06</span>

                <div>
                  <h2>Review & Submit</h2>

                  <p>
                    Review your information carefully before
                    submitting your application.
                  </p>
                </div>
              </div>

              {/* Selected accommodation */}
              <div className="review-section">
                <div className="review-heading">
                  <h3>Selected Accommodation</h3>
                </div>

                <div className="review-card">
                  <div>
                    <span>Residence</span>
                    <strong>
                      {property?.name || "Not available"}
                    </strong>
                  </div>

                  <div>
                    <span>Room</span>
                    <strong>
                      {selectedRoom?.room_number || "Not available"}
                    </strong>
                  </div>

                  <div>
                    <span>Room Type</span>
                    <strong>
                      {selectedRoom?.room_type ||
                        "Not specified"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Personal */}
              <div className="review-section">
                <div className="review-heading">
                  <h3>Personal Information</h3>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                  >
                    Edit
                  </button>
                </div>

                <div className="review-card">
                  <div>
                    <span>Date of Birth</span>
                    <strong>
                      {formatDate(form.date_of_birth)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Emergency */}
              <div className="review-section">
                <div className="review-heading">
                  <h3>Emergency Contact</h3>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                  >
                    Edit
                  </button>
                </div>

                <div className="review-card">
                  <div>
                    <span>Name</span>
                    <strong>
                      {form.emergency_contact_name ||
                        "Not provided"}
                    </strong>
                  </div>

                  <div>
                    <span>Phone</span>
                    <strong>
                      {form.emergency_contact_phone ||
                        "Not provided"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Academic */}
              <div className="review-section">
                <div className="review-heading">
                  <h3>Academic Information</h3>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                  >
                    Edit
                  </button>
                </div>

                <div className="review-card">
                  <div>
                    <span>University</span>
                    <strong>
                      {form.university}
                    </strong>
                  </div>

                  <div>
                    <span>Campus</span>
                    <strong>
                      {form.campus}
                    </strong>
                  </div>

                  <div>
                    <span>Course</span>
                    <strong>
                      {form.course}
                    </strong>
                  </div>

                  <div>
                    <span>Year of Study</span>
                    <strong>
                      Year {form.year_of_study}
                    </strong>
                  </div>

                  <div>
                    <span>Academic Year</span>
                    <strong>
                      {form.academic_year}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Accommodation */}
              <div className="review-section">
                <div className="review-heading">
                  <h3>Accommodation Preferences</h3>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                  >
                    Edit
                  </button>
                </div>

                <div className="review-card">
                  <div>
                    <span>Sign-in Date</span>
                    <strong>
                      {formatDate(
                        form.expected_sign_in_date
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Sign-out Date</span>
                    <strong>
                      {formatDate(
                        form.expected_sign_out_date
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Meal Preference</span>
                    <strong>
                      {form.meal_preference ===
                        "NO_MEAL_PLAN" &&
                        "No meal plan"}

                      {form.meal_preference ===
                        "STANDARD" &&
                        "Standard meal plan"}

                      {form.meal_preference ===
                        "VEGETARIAN" &&
                        "Vegetarian"}

                      {form.meal_preference ===
                        "HALAL" &&
                        "Halal"}

                      {!form.meal_preference &&
                        "Not provided"}
                    </strong>
                  </div>

                  <div>
                    <span>Accessibility</span>
                    <strong>
                      {form.accessibility_required
                        ? "Requirements provided"
                        : "No accessibility requirements"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Funding */}
              <div className="review-section">
                <div className="review-heading">
                  <h3>Funding & Financial Information</h3>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(5)}
                  >
                    Edit
                  </button>
                </div>

                <div className="review-card">
                  <div>
                    <span>Funding Method</span>
                    <strong>
                      {form.funding_method ||
                        "Not provided"}
                    </strong>
                  </div>

                  <div>
                    <span>Funding Notes</span>
                    <strong>
                      {form.funding_notes ||
                        "No additional notes"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Approval notice */}
              <div className="final-approval-notice">
                <div className="notice-icon">✓</div>

                <div>
                  <strong>
                    What happens after you submit?
                  </strong>

                  <p>
                    Your application will be submitted for
                    administrative review. Your selected room
                    is not yet confirmed. If your application
                    is approved, you will proceed to the
                    contract, funding/payment and booking
                    stages.
                  </p>
                </div>
              </div>

              <div className="final-approval-notice">
                <div className="notice-icon">DOC</div>
                <div>
                  <strong>Required documents</strong>
                  <p>Upload your proof of registration and student ID before submitting. Documents may be submitted while they await verification.</p>
                  <Link to="/student/documents" className="primary-button">Upload required documents →</Link>
                </div>
              </div>
            </section>
          )}

          {/* Navigation */}
          <div className="application-actions">

            {currentStep > 1 ? (
              <button
                type="button"
                className="secondary-button"
                onClick={handlePrevious}
                disabled={saving}
              >
                ← Previous
              </button>
            ) : (
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate(selectedRoomPath, { replace: true })}
                disabled={saving}
              >
                Cancel
              </button>
            )}

            <div className="action-spacer" />

            {currentStep < 6 ? (
              <button
                type="button"
                className="primary-button"
                onClick={handleNext}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save & Continue →"}
              </button>
            ) : (
              <button
                type="button"
                className="primary-button submit-button"
                onClick={handleSubmit}
                disabled={saving || Boolean(successMessage) || !requiredDocumentsUploaded || !documentsChecked}
              >
                {saving
                  ? "Submitting..."
                  : !documentsChecked
                    ? "Checking required documents..."
                    : !requiredDocumentsUploaded
                    ? "Upload documents to submit"
                    : "Submit Application ✓"}
              </button>
            )}
          </div>
        </div>

        <div className="application-footer">
          <span>
            StudentHaven
          </span>

          <span>
            Find your place. Build your future.
          </span>
        </div>

      </div>
    </div>
  );
}
