import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import "../../App.css";
import ApplicationAppealPanel from "../../components/ApplicationAppealPanel";

import {
    API_BASE_URL,
    getStudentContract,
    getStudentBooking,
    getStudentFundingPayment,
} from "../../services/api";

import type {
    StudentContract,
    Booking,
    FundingPayment,
} from "../../services/api";

interface StatusHistory {
    id: number;
    from_status: string | null;
    to_status: string;
    note: string;
    changed_by_name: string | null;
    created_at: string;
}

interface Application {
    id: number;
    application_number: string;
    student_name: string;

    property: number;
    property_name: string;
    room: number;
    room_number: string;

    status: string;
    current_step: number;

    date_of_birth: string | null;

    emergency_contact_name: string;
    emergency_contact_phone: string;

    academic_year: number | null;
    university: string;
    campus: string;
    course: string;
    year_of_study: number | null;

    expected_sign_in_date: string | null;
    expected_sign_out_date: string | null;

    accessibility_required: boolean;
    accessibility_notes: string;

    meal_preference: string;
    student_notes: string;

    funding_method: string;
    funding_notes: string;

    admin_notes: string;
    decline_reason: string;

    submitted_at: string | null;
    reviewed_at: string | null;

    created_at: string;
    updated_at: string;

    status_history: StatusHistory[];
}

function formatDate(dateValue: string | null) {
    if (!dateValue) {
        return "Not provided";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return dateValue;
    }

    return date.toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

function hasDateArrived(dateValue: string | null) {
    if (!dateValue) return false;
    const now = new Date();
    const today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
    ].join("-");
    return dateValue.slice(0, 10) <= today;
}

function formatDateTime(dateValue: string | null) {
    if (!dateValue) {
        return "Not available";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return dateValue;
    }

    return date.toLocaleString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatStatus(status: string) {
    return status
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClass(status: string) {
    switch (status) {
        case "SUBMITTED":
            return "application-status submitted";

        case "UNDER_REVIEW":
            return "application-status review";

        case "APPROVED":
            return "application-status approved";

        case "DECLINED":
            return "application-status declined";

        case "WAITLISTED":
            return "application-status waitlisted";

        case "DRAFT":
            return "application-status draft";

        default:
            return "application-status";
    }
}


function ApplicationDetails() {



    const { applicationId } = useParams();

    const [application, setApplication] =
        useState<Application | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [contract, setContract] =
        useState<StudentContract | null>(null);

    const [booking, setBooking] =
        useState<Booking | null>(null);

    const [fundingPayment, setFundingPayment] =
        useState<FundingPayment | null>(null);

    useEffect(() => {
        async function loadApplication() {
            if (!applicationId) {
                setError("Application was not found.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError("");
                setApplication(null);
                setContract(null);
                setBooking(null);
                setFundingPayment(null);

                const response = await fetch(
                    `${API_BASE_URL}/applications/${applicationId}/`,
                    {
                        method: "GET",
                        credentials: "include",
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result?.message ||
                        result?.detail ||
                        "Unable to load application."
                    );
                }

                const applicationData =
                    result.application;

                setApplication(applicationData);


                /*
                 * Only approved applications can move
                 * into the contract and booking stages.
                 */
                if (
                    applicationData.status ===
                    "APPROVED"
                ) {
                    const [
                        contractResult,
                        bookingResult,
                        fundingResult,
                    ] = await Promise.allSettled([
                        getStudentContract(
                            Number(applicationId)
                        ),

                        getStudentBooking(
                            Number(applicationId)
                        ),

                        getStudentFundingPayment(
                            Number(applicationId)
                        ),
                    ]);


                    if (
                        contractResult.status ===
                        "fulfilled"
                    ) {
                        setContract(
                            contractResult.value
                        );
                    }


                    if (
                        bookingResult.status ===
                        "fulfilled"
                    ) {
                        setBooking(
                            bookingResult.value
                        );
                    }


                    if (
                        fundingResult.status ===
                        "fulfilled"
                    ) {
                        setFundingPayment(
                            fundingResult.value
                        );
                    }
                }

            } catch (err) {
                console.error(
                    "Application details error:",
                    err
                );

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load application."
                );
            } finally {
                setLoading(false);
            }
        }

        loadApplication();
    }, [applicationId]);

    if (loading) {
        return (
            <div className="application-details-page">
                <div className="application-details-loading">
                    <div className="application-loading-spinner" />
                    <h2>Loading application</h2>
                    <p>
                        We're retrieving your application details.
                    </p>
                </div>
            </div>
        );
    }

    if (error || !application) {
        return (
            <div className="application-details-page">
                <div className="application-details-error">
                    <div className="application-error-icon">
                        !
                    </div>

                    <span className="application-eyebrow">
                        APPLICATION
                    </span>

                    <h1>Unable to load application</h1>

                    <p>
                        {error ||
                            "The requested application could not be found."}
                    </p>

                    <Link
                        to="/student/dashboard"
                        className="primary-button"
                    >
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const status = application.status;


    /*
     * Real application journey states
     */

    const applicationSubmitted =
        status !== "DRAFT";


    const decisionMade =
        [
            "APPROVED",
            "DECLINED",
            "WAITLISTED",
        ].includes(status);


    const contractSigned =
        contract?.status === "SIGNED";


    const bookingConfirmed =
        booking !== null &&
        [
            "CONFIRMED",
            "ACTIVE",
            "COMPLETED",
            "TRANSFERRED",
        ].includes(
            booking.status
        );


    const checkInCompleted =
        booking !== null &&
        [
            "ACTIVE",
            "COMPLETED",
            "TRANSFERRED",
        ].includes(
            booking.status
        );


    const paymentComplete =
        contractSigned && (
            bookingConfirmed || (
                fundingPayment !== null &&
                Number(fundingPayment.balance) <= 0
            )
        );

    const expectedCheckInDate =
        fundingPayment?.stay_start_date ?? application.expected_sign_in_date;
    const checkInDateReached = hasDateArrived(expectedCheckInDate);
    const firstRentBalance = fundingPayment?.rent_schedule[0]
        ? Number(fundingPayment.rent_schedule[0].balance)
        : null;


    /*
     * Determine the current journey stage.
     */
    let currentProgressStep = 1;

    if (applicationSubmitted && !decisionMade) {
        currentProgressStep = 3;
    } else if (decisionMade && status !== "APPROVED") {
        currentProgressStep = 4;
    } else if (status === "APPROVED" && !contractSigned) {
        currentProgressStep = 5;
    } else if (contractSigned && !paymentComplete) {
        currentProgressStep = 6;
    } else if (paymentComplete && !bookingConfirmed) {
        currentProgressStep = 6;
    } else if (bookingConfirmed && !checkInCompleted) {
        currentProgressStep = 7;
    } else if (checkInCompleted) {
        currentProgressStep = 7;
    }


    const progressSteps = [
        {
            number: 1,
            key: "CREATED",
            title: "Application",
            description: "Application created",
        },
        {
            number: 2,
            key: "SUBMITTED",
            title: "Submitted",
            description: "Application submitted",
        },
        {
            number: 3,
            key: "UNDER_REVIEW",
            title: "Review",
            description: "Admin review",
        },
        {
            number: 4,
            key: "DECISION",
            title: "Decision",
            description: "Approval decision",
        },
        {
            number: 5,
            key: "CONTRACT",
            title: "Sign contract",
            description: "Review and sign the agreement",
        },
        {
            number: 6,
            key: "PAYMENT",
            title: "Payment & room assignment",
            description: paymentComplete && !bookingConfirmed
                ? "Payment complete; room assignment is being prepared"
                : "Review and pay the balance",
        },
        {
            number: 7,
            key: "CHECK_IN",
            title: "Check-in",
            description: bookingConfirmed
                ? booking?.check_in_eligible
                    ? "Check-in is open; present your QR to residence staff"
                    : `Check-in opens on ${formatDate(booking?.start_date ?? null)}`
                : "Available after your room is assigned and your arrival date begins",
        },
    ];

    let nextJourneyAction: {
        title: string;
        description: string;
        label: string;
        to: string;
    } | null = null;

    if (status === "APPROVED") {
        if (bookingConfirmed && !checkInCompleted) {
            nextJourneyAction = booking?.check_in_eligible
                ? {
                    title: "Check-in is open",
                    description: "Your arrival date has arrived. Open your check-in QR and show it with photo ID to residence staff.",
                    label: "Go to check-in",
                    to: `/student/my-room/${application.id}`,
                }
                : {
                    title: "Your room is confirmed",
                    description: "Your check-in QR will be available on your arrival date. You can review your room details now.",
                    label: "View room details",
                    to: `/student/my-room/${application.id}`,
                };
        } else if (!contract) {
            nextJourneyAction = {
                title: "Your contract is being prepared",
                description: "Your application is approved. Check this page again shortly for the contract and payment steps.",
                label: "Return to dashboard",
                to: "/student/dashboard",
            };
        } else if (!contractSigned) {
            nextJourneyAction = {
                title: "Review and sign your contract",
                description: "Read the agreement and residence rules before continuing to payment.",
                label: "Open contract",
                to: `/contracts/${application.id}`,
            };
        } else if (!fundingPayment) {
            nextJourneyAction = {
                title: "Your payment details are being prepared",
                description: "Your signed contract is saved. Check this page again shortly for the total rent, monthly schedule and payment options.",
                label: "Return to dashboard",
                to: "/student/dashboard",
            };
        } else if (firstRentBalance !== null && firstRentBalance <= 0 && !bookingConfirmed) {
            nextJourneyAction = {
                title: checkInDateReached
                    ? "Your check-in date has arrived · room confirmation pending"
                    : "Your first rent is recorded · room confirmation pending",
                description: "Your first rent installment is recorded, but your room and bed are not confirmed yet. Contact residence support before travelling so they can complete your allocation.",
                label: "Contact residence support",
                to: "/student/messages?new=landlord",
            };
        } else if (checkInDateReached && firstRentBalance !== null && firstRentBalance > 0) {
            nextJourneyAction = {
                title: "Your check-in date has arrived",
                description: "Check-in opens after your first rent installment is paid and your room and bed are confirmed. Later rent can remain due on its schedule.",
                label: "Pay first rent installment",
                to: `/funding/${application.id}`,
            };
        } else if (!paymentComplete) {
            nextJourneyAction = {
                title: "Review your balance and payment options",
                description: "Continue to the funding page to see your balance and available checkout options.",
                label: "Open funding and payments",
                to: `/funding/${application.id}`,
            };
        } else if (!bookingConfirmed) {
            nextJourneyAction = {
                title: "Room assignment confirmation pending",
                description: "Your payment is recorded, but a room and bed must be confirmed before check-in can open.",
                label: "Contact residence support",
                to: "/student/messages?new=landlord",
            };
        }
    }

    return (
        <div className="application-details-page">
            <div className="application-details-container">
                <Link
                    to="/student/dashboard"
                    className="application-details-back"
                >
                    ← Back to Dashboard
                </Link>

                <header className="application-details-header">
                    <div>
                        <span className="application-eyebrow">
                            ACCOMMODATION APPLICATION
                        </span>

                        <h1>Application Details</h1>

                        <p>
                            Track the progress of your accommodation
                            application.
                        </p>
                    </div>

                    <div className="application-reference">
                        <span>APPLICATION NUMBER</span>

                        <strong>
                            {application.application_number}
                        </strong>
                    </div>
                </header>

                <section className="application-details-status-card">
                    <div className="application-details-status-main">
                        <span className="application-eyebrow">
                            CURRENT STATUS
                        </span>

                        <div className="application-details-status-row">
                            <span className={getStatusClass(status)}>
                                <span className="status-dot" />
                                {formatStatus(status)}
                            </span>

                            {application.submitted_at && (
                                <span className="application-submitted-date">
                                    Submitted{" "}
                                    {formatDateTime(
                                        application.submitted_at
                                    )}
                                </span>
                            )}
                        </div>

                        <h2>
                            {status === "SUBMITTED" &&
                                "Your application has been submitted successfully."}

                            {status === "UNDER_REVIEW" &&
                                "Your application is currently being reviewed."}

                            {status === "ADDITIONAL_INFO" &&
                                "The landlord needs more information from you."}

                            {status === "APPROVED" &&
                                "Your application has been approved."}

                            {status === "DECLINED" &&
                                "Your application was not approved."}

                            {status === "WAITLISTED" &&
                                "Your application has been placed on the waiting list."}

                            {status === "DRAFT" &&
                                "Your application is still being completed."}

                            {![
                                "SUBMITTED",
                                "UNDER_REVIEW",
                                "ADDITIONAL_INFO",
                                "APPROVED",
                                "DECLINED",
                                "WAITLISTED",
                                "DRAFT",
                            ].includes(status) &&
                                "Your application is being processed."}
                        </h2>

                        <p>
                            {status === "SUBMITTED" &&
                                "The accommodation administration team will review your application and make the final decision."}

                            {status === "UNDER_REVIEW" &&
                                "An administrator is currently checking your application and accommodation request."}

                            {status === "ADDITIONAL_INFO" &&
                                "Review the landlord's request below and provide the information or documents requested."}

                            {status === "APPROVED" &&
                                "Your selected room has been approved. Continue with the next steps shown below."}

                            {status === "DECLINED" &&
                                "Please review the decision information below or contact StudentHaven support if you need assistance."}

                            {status === "WAITLISTED" &&
                                "You will be contacted when suitable accommodation becomes available."}

                            {status === "DRAFT" &&
                                "Return to your application to complete all required information."}
                        </p>
                    </div>

                    <div className="application-details-status-meta">
                        <div>
                            <span>Last updated</span>
                            <strong>
                                {formatDateTime(
                                    application.updated_at
                                )}
                            </strong>
                        </div>

                        <div>
            <span>Application step</span>
                            <strong>
                                {currentProgressStep} of 7
                            </strong>
                        </div>
                    </div>
                </section>

                {status === "ADDITIONAL_INFO" && (application.admin_notes || [...(application.status_history || [])].reverse().find((history) => history.to_status === "ADDITIONAL_INFO")?.note) && (
                    <section className="application-details-decision information-requested" role="status">
                        <div className="decision-icon">i</div>
                        <div>
                            <span>REQUEST FROM YOUR LANDLORD</span>
                            <h2>Additional information requested</h2>
                            <p>{application.admin_notes || [...(application.status_history || [])].reverse().find((history) => history.to_status === "ADDITIONAL_INFO")?.note}</p>
                            <Link to="/student/documents" className="secondary-button">Review or replace documents</Link>
                        </div>
                    </section>
                )}

                <section className="application-details-card">
                    <div className="application-details-card-header">
                        <div>
                            <span className="application-eyebrow">
                                ACCOMMODATION
                            </span>

                            <h2>Selected accommodation</h2>
                        </div>
                    </div>

                    <div className="application-accommodation-grid">
                        <div className="application-accommodation-main">
                            <div className="application-property-icon">
                                SH
                            </div>

                            <div>
                                <span className="application-info-label">
                                    PROPERTY
                                </span>

                                <h3>
                                    {application.property_name}
                                </h3>

                                <p>
                                    Your requested accommodation
                                </p>
                            </div>
                        </div>

                        <div className="application-info-box">
                            <span className="application-info-label">
                                ROOM
                            </span>

                            <strong>
                                Room {application.room_number}
                            </strong>
                        </div>

                        <div className="application-info-box">
                            <span className="application-info-label">
                                APPLICATION TYPE
                            </span>

                            <strong>Accommodation</strong>
                        </div>
                    </div>
                </section>

                <section className="application-details-card">
                    <div className="application-details-card-header">
                        <div>
                            <span className="application-eyebrow">
                                PROGRESS
                            </span>

                            <h2>Application journey</h2>
                        </div>
                    </div>

                    <div className="application-details-timeline">
                        {progressSteps.map((step) => {

                            let stepStatus:
                                | "upcoming"
                                | "current"
                                | "completed" = "upcoming";


                            /*
                             * STEP 1 — Application created
                             */
                            if (step.number === 1) {
                                stepStatus = applicationSubmitted ? "completed" : "current";
                            }


                            /*
                             * STEP 2 — Submitted
                             */
                            if (step.number === 2) {

                                if (applicationSubmitted) {
                                    stepStatus = "completed";
                                }

                            }


                            /*
                             * STEP 3 — Admin review
                             */
                            if (step.number === 3) {

                                if (decisionMade) {
                                    stepStatus = "completed";
                                } else if (applicationSubmitted) {
                                    stepStatus = "current";
                                }

                            }


                            /*
                             * STEP 4 — Decision
                             */
                            if (step.number === 4) {

                                if (decisionMade) {
                                    stepStatus = "completed";
                                }

                            }


                            /* STEP 5 — Review and sign the contract */
                            if (step.number === 5) {

                                if (contractSigned) {
                                    stepStatus = "completed";
                                } else if (status === "APPROVED") {
                                    stepStatus = "current";
                                }

                            }


                            /* STEP 6 — Complete payment and room assignment */
                            if (step.number === 6) {

                                if (bookingConfirmed) {
                                    stepStatus = "completed";
                                } else if (contractSigned) {
                                    stepStatus = "current";
                                }

                            }

                            /* STEP 7 — Check in to the residence */
                            if (step.number === 7) {
                                if (checkInCompleted) {
                                    stepStatus = "completed";
                                } else if (bookingConfirmed) {
                                    stepStatus = "current";
                                }
                            }


                            return (
                                <div
                                    className={`application-timeline-item ${stepStatus}`}
                                    key={step.number}
                                >
                                    <div className="application-timeline-marker">
                                        {stepStatus === "completed"
                                            ? "✓"
                                            : step.number}
                                    </div>

                                    <div className="application-timeline-content">
                                        <strong>{step.title}</strong>

                                        <span>
                                            {step.description}
                                        </span>
                                    </div>

                                    {step.number <
                                        progressSteps.length && (
                                            <div className="application-timeline-line" />
                                        )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {nextJourneyAction && (
                    <section className="application-next-step-card" aria-label="Your next step">
                        <div>
                            <span className="application-eyebrow">YOUR NEXT STEP</span>
                            <h2>{nextJourneyAction.title}</h2>
                            <p>{nextJourneyAction.description}</p>
                        </div>
                        <Link to={nextJourneyAction.to} className="primary-button">
                            {nextJourneyAction.label} →
                        </Link>
                    </section>
                )}

                <section className="application-details-grid">
                    <div className="application-details-card">
                        <div className="application-details-card-header">
                            <div>
                                <span className="application-eyebrow">
                                    STUDENT INFORMATION
                                </span>

                                <h2>Applicant details</h2>
                            </div>
                        </div>

                        <div className="application-information-grid">
                            <div>
                                <span>Full name</span>
                                <strong>
                                    {application.student_name ||
                                        "Not provided"}
                                </strong>
                            </div>

                            <div>
                                <span>University</span>
                                <strong>
                                    {application.university ||
                                        "Not provided"}
                                </strong>
                            </div>

                            <div>
                                <span>Campus</span>
                                <strong>
                                    {application.campus ||
                                        "Not provided"}
                                </strong>
                            </div>

                            <div>
                                <span>Course</span>
                                <strong>
                                    {application.course ||
                                        "Not provided"}
                                </strong>
                            </div>

                            <div>
                                <span>Academic year</span>
                                <strong>
                                    {application.academic_year ||
                                        "Not provided"}
                                </strong>
                            </div>

                            <div>
                                <span>Year of study</span>
                                <strong>
                                    {application.year_of_study
                                        ? `Year ${application.year_of_study}`
                                        : "Not provided"}
                                </strong>
                            </div>
                        </div>
                    </div>

                    <div className="application-details-card">
                        <div className="application-details-card-header">
                            <div>
                                <span className="application-eyebrow">
                                    STAY DETAILS
                                </span>

                                <h2>Accommodation period</h2>
                            </div>
                        </div>

                        <div className="application-information-grid">
                            <div>
                                <span>Expected sign-in</span>
                                <strong>
                                    {formatDate(
                                        application.expected_sign_in_date
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Expected sign-out</span>
                                <strong>
                                    {formatDate(
                                        application.expected_sign_out_date
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Meal preference</span>
                                <strong>
                                    {application.meal_preference ||
                                        "Not provided"}
                                </strong>
                            </div>

                            <div>
                                <span>Accessibility required</span>
                                <strong>
                                    {application.accessibility_required
                                        ? "Yes"
                                        : "No"}
                                </strong>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="application-details-grid">
                    <div className="application-details-card">
                        <div className="application-details-card-header">
                            <div>
                                <span className="application-eyebrow">
                                    FUNDING
                                </span>

                                <h2>Funding method</h2>
                            </div>
                        </div>

                        <div className="application-funding-box">
                            <span className="application-info-label">
                                SELECTED FUNDING
                            </span>

                            <strong>
                                {formatStatus(
                                    application.funding_method
                                )}
                            </strong>

                            {application.funding_notes && (
                                <p>
                                    {application.funding_notes}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="application-details-card">
                        <div className="application-details-card-header">
                            <div>
                                <span className="application-eyebrow">
                                    EMERGENCY CONTACT
                                </span>

                                <h2>Emergency contact</h2>
                            </div>
                        </div>

                        <div className="application-information-grid">
                            <div>
                                <span>Name</span>
                                <strong>
                                    {application.emergency_contact_name ||
                                        "Not provided"}
                                </strong>
                            </div>

                            <div>
                                <span>Phone</span>
                                <strong>
                                    {application.emergency_contact_phone ||
                                        "Not provided"}
                                </strong>
                            </div>
                        </div>
                    </div>
                </section>

                {application.accessibility_notes && (
                    <section className="application-details-card">
                        <div className="application-details-card-header">
                            <div>
                                <span className="application-eyebrow">
                                    ACCESSIBILITY
                                </span>

                                <h2>Accessibility requirements</h2>
                            </div>
                        </div>

                        <p className="application-details-note">
                            {application.accessibility_notes}
                        </p>
                    </section>
                )}

                {application.student_notes && (
                    <section className="application-details-card">
                        <div className="application-details-card-header">
                            <div>
                                <span className="application-eyebrow">
                                    STUDENT NOTES
                                </span>

                                <h2>Additional information</h2>
                            </div>
                        </div>

                        <p className="application-details-note">
                            {application.student_notes}
                        </p>
                    </section>
                )}

                {status === "DECLINED" &&
                    application.decline_reason && (
                        <section className="application-details-decision declined">
                            <div className="decision-icon">!</div>

                            <div>
                                <span>
                                    APPLICATION DECISION
                                </span>

                                <h2>Application declined</h2>

                                <p>
                                    {application.decline_reason}
                                </p>
                            </div>
                        </section>
                    )}

                {status !== "DRAFT" && <ApplicationAppealPanel applicationId={application.id} status={application.status} reviewedAt={application.reviewed_at} />}

                {application.admin_notes && status !== "ADDITIONAL_INFO" && (
                    <section className="application-details-card">
                        <div className="application-details-card-header">
                            <div>
                                <span className="application-eyebrow">
                                    ADMINISTRATION
                                </span>

                                <h2>Review notes</h2>
                            </div>
                        </div>

                        <p className="application-details-note">
                            {application.admin_notes}
                        </p>
                    </section>
                )}

                {application.status_history?.length > 0 && (
                    <section className="application-details-card">
                        <div className="application-details-card-header">
                            <div>
                                <span className="application-eyebrow">
                                    ACTIVITY
                                </span>

                                <h2>Application history</h2>
                            </div>
                        </div>

                        <div className="application-history">
                            {application.status_history.map(
                                (history) => (
                                    <div
                                        className="application-history-item"
                                        key={history.id}
                                    >
                                        <div className="history-marker" />

                                        <div className="history-content">
                                            <div className="history-top">
                                                <strong>
                                                    {formatStatus(
                                                        history.to_status
                                                    )}
                                                </strong>

                                                <span>
                                                    {formatDateTime(
                                                        history.created_at
                                                    )}
                                                </span>
                                            </div>

                                            {history.note && (
                                                <p>{history.note}</p>
                                            )}

                                            {history.changed_by_name && (
                                                <small>
                                                    Updated by{" "}
                                                    {history.changed_by_name}
                                                </small>
                                            )}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </section>
                )}

                <section className="application-details-footer-card">
                    <div>
                        <span className="application-eyebrow">
                            NEED HELP?
                        </span>

                        <h2>
                            Need assistance with your application?
                        </h2>

                        <p>
                            Contact StudentHaven support if you
                            have questions about your accommodation
                            application.
                        </p>
                    </div>

                    <Link
                        to="/student/dashboard"
                        className="secondary-button"
                    >
                        Back to Dashboard
                    </Link>
                </section>
            </div>
        </div>
    );
}

export default ApplicationDetails;
