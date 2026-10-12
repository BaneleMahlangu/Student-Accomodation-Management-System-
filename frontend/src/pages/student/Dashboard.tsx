import { useEffect, useState } from "react";
import {
    ArrowRight,
    BedDouble,
    Bell,
    Bot,
    Building2,
    CalendarDays,
    CircleHelp,
    ClipboardList,
    Clock3,
    GraduationCap,
    Mail,
    MapPin,
    MessageCircle,
    Search,
    ShieldCheck,
    Sparkles,
    UserRound,
    Wrench,
    BookOpen,
    Hash,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ApplicationPeriodNotice, PlatformAnnouncements } from "../../components/PlatformAnnouncements";
import PortalToolbar from "../../components/PortalToolbar";
import useUnreadNotifications from "../../hooks/useUnreadNotifications";

import "../../App.css";

import {
    getCurrentUser,
    getMyApplications,
    getStudentFundingPayment,
    getStudentBooking,
    getStudentDocuments,
} from "../../services/api";

import type {
    CurrentUser,
    Application,
    FundingPayment,
    Booking,
    StudentDocument,
} from "../../services/api";


function formatStatus(status: string) {
    return status
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
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


function Dashboard() {
    const [user, setUser] =
        useState<CurrentUser | null>(null);

    const [applications, setApplications] =
        useState<Application[]>([]);

    const [documents, setDocuments] =
        useState<StudentDocument[]>([]);

    const [funding, setFunding] =
        useState<FundingPayment | null>(null);

    const [booking, setBooking] =
        useState<Booking | null>(null);

    const unreadNotifications = useUnreadNotifications();

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [dataWarning, setDataWarning] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);


    useEffect(() => {
        async function loadDashboard() {
            try {
                setLoading(true);
                setError("");
                setDataWarning("");

                const [
                    currentUser,
                    studentApplications,
                ] = await Promise.all([
                    getCurrentUser(),
                    getMyApplications(),
                ]);

                setUser(currentUser);
                setApplications(studentApplications);

                const sortedApplications =
                    [...studentApplications].sort(
                        (a, b) =>
                            new Date(b.updated_at).getTime() -
                            new Date(a.updated_at).getTime()
                    );

                const activeApplication =
                    studentApplications.find(
                        (application) =>
                            application.status === "APPROVED"
                    ) ||
                    sortedApplications[0] ||
                    null;

                /*
                 * Load the student's documents.
                 */
                if (activeApplication) {
                    try {
                        const studentDocuments =
                            await getStudentDocuments(
                                activeApplication.id
                            );

                        setDocuments(studentDocuments);
                    } catch {
                        setDocuments([]);
                        setDataWarning("Your document status could not be loaded. Refresh before uploading again so you do not send duplicate files.");
                    }
                } else {
                    setDocuments([]);
                }

                /*
                 * Contract, funding and booking only exist
                 * after the application reaches the required stage.
                 */
                if (
                    activeApplication &&
                    activeApplication.status === "APPROVED"
                ) {
                    const results =
                        await Promise.allSettled([
                            getStudentFundingPayment(
                                activeApplication.id
                            ),

                            getStudentBooking(
                                activeApplication.id
                            ),
                        ]);

                    if (
                        results[0].status === "fulfilled"
                    ) {
                        setFunding(
                            results[0].value
                        );
                    } else {
                        setFunding(null);
                    }

                    if (
                        results[1].status === "fulfilled"
                    ) {
                        setBooking(
                            results[1].value
                        );
                    } else {
                        setBooking(null);
                        setDataWarning((current) => [
                            current,
                            "Your room booking status could not be loaded. Refresh before relying on your accommodation details.",
                        ].filter(Boolean).join(" "));
                    }
                } else {
                    setFunding(null);
                    setBooking(null);
                }
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load your dashboard."
                );
            } finally {
                setLoading(false);
            }
        }

        loadDashboard();
    }, [refreshKey]);


    if (loading) {
        return (
            <div className="dashboard-page">
                <div className="dashboard-loading">
                    Loading your StudentHaven dashboard...
                </div>
            </div>
        );
    }


    if (error) {
        return (
            <div className="dashboard-page">
                <div className="dashboard-error">
                    <h2>
                        Unable to load dashboard
                    </h2>

                    <p>{error}</p>

                    <button type="button" className="dashboard-primary-action" onClick={() => setRefreshKey((current) => current + 1)}>
                        Try again
                    </button>
                    <Link to="/account/security">Account security</Link>
                </div>
            </div>
        );
    }


    /*
     * Determine the student's current application.
     */
    const activeApplication =
        applications.find(
            (application) =>
                application.status === "APPROVED"
        ) ||
        [...applications]
            .sort(
                (a, b) =>
                    new Date(b.updated_at).getTime() -
                    new Date(a.updated_at).getTime()
            )[0] ||
        null;


    const profileComplete =
        Boolean(
            user?.student_profile?.profile_completed
        );


    const applicationComplete =
        Boolean(
            activeApplication &&
            [
                "SUBMITTED",
                "UNDER_REVIEW",
                "ADDITIONAL_INFO",
                "APPROVED",
                "DECLINED",
                "WAITING_LIST",
                "WAITLISTED",
            ].includes(
                activeApplication.status
            )
        );


    const approvalComplete =
        activeApplication?.status ===
        "APPROVED";


    const preferencesComplete =
        Boolean(
            activeApplication &&
            activeApplication.funding_method &&
            activeApplication.meal_preference
        );


    const proofOfRegistration =
        documents.find(
            (document) =>
                document.document_type ===
                "PROOF_OF_REGISTRATION"
        );


    const studentIdDocument =
        documents.find(
            (document) =>
                document.document_type ===
                "STUDENT_ID"
        );


    const requiredDocumentsComplete =
        proofOfRegistration?.status === "VERIFIED" &&
        studentIdDocument?.status === "VERIFIED";


    const verifiedDocumentCount =
        documents.filter(
            (document) =>
                document.status === "VERIFIED"
        ).length;

    const nextStep = (() => {
        if (!profileComplete) {
            return {
                title: "Complete your student profile",
                description: "Add your academic and contact details to prepare your accommodation application.",
                action: "Continue profile",
                to: "/student/onboarding",
                icon: <UserRound size={23} aria-hidden="true" />,
            };
        }

        if (!activeApplication) {
            return {
                title: "Find a place to stay",
                description: "Explore student accommodation and find a room that suits your needs.",
                action: "Browse accommodation",
                to: "/accommodation",
                icon: <Search size={23} aria-hidden="true" />,
            };
        }

        if (activeApplication.status === "ADDITIONAL_INFO") {
            return {
                title: "Review your application update",
                description: "There is an update on your application. Open it to see what information is needed.",
                action: "View application",
                to: `/applications/${activeApplication.id}`,
                icon: <ClipboardList size={23} aria-hidden="true" />,
            };
        }

        if (!applicationComplete) {
            return {
                title: "Continue your accommodation application",
                description: preferencesComplete
                    ? "Finish and submit your application to send it for review."
                    : "Complete your accommodation preferences, then submit your application.",
                action: "Continue application",
                to: `/applications/${activeApplication.id}`,
                icon: <ClipboardList size={23} aria-hidden="true" />,
            };
        }

        if (activeApplication.status === "DECLINED") {
            return {
                title: "Review your application decision",
                description: "Read the latest decision and any feedback on your application.",
                action: "View decision",
                to: `/applications/${activeApplication.id}`,
                icon: <ClipboardList size={23} aria-hidden="true" />,
            };
        }

        if (activeApplication.status === "WAITING_LIST" || activeApplication.status === "WAITLISTED") {
            return {
                title: "Check your waiting list",
                description: "View your current position and check for any room offers.",
                action: "View waiting list",
                to: "/student/waiting-list",
                icon: <Clock3 size={23} aria-hidden="true" />,
            };
        }

        if (!requiredDocumentsComplete) {
            return {
                title: "Check your required documents",
                description: "Review your document checklist and upload any outstanding files.",
                action: "View documents",
                to: "/student/documents",
                icon: <ShieldCheck size={23} aria-hidden="true" />,
            };
        }

        if (approvalComplete && booking) {
            const checkInOpen = booking.check_in_eligible;
            return {
                title: checkInOpen ? "Check-in is open" : "Review your accommodation",
                description: checkInOpen
                    ? "Your arrival date has arrived. Open your check-in QR and show it to residence staff."
                    : "Your application is approved. Check your room and move-in details.",
                action: checkInOpen ? "Go to check-in" : "View my room",
                to: `/student/my-room/${activeApplication.id}`,
                icon: <BedDouble size={23} aria-hidden="true" />,
            };
        }

        if (approvalComplete) {
            const firstInstallmentBalance = funding?.rent_schedule[0]
                ? Number(funding.rent_schedule[0].balance)
                : null;

            if (firstInstallmentBalance !== null && firstInstallmentBalance <= 0) {
                return {
                    title: hasDateArrived(activeApplication.expected_sign_in_date)
                        ? "Your check-in date has arrived · room confirmation pending"
                        : "Your room assignment needs confirmation",
                    description: "Your first rent installment is recorded, but your room and bed are not confirmed yet. Contact residence support before travelling.",
                    action: "Contact residence support",
                    to: "/student/messages?new=landlord",
                    icon: <BedDouble size={23} aria-hidden="true" />,
                };
            }

            if (firstInstallmentBalance !== null && firstInstallmentBalance > 0) {
                return {
                    title: hasDateArrived(activeApplication.expected_sign_in_date)
                        ? "Your check-in date has arrived"
                        : "Confirm your room assignment",
                    description: "Pay the first rent installment to reserve your bed. Check-in opens after your room is confirmed; later rent can remain due on its schedule.",
                    action: "Pay first rent installment",
                    to: `/funding/${activeApplication.id}`,
                    icon: <BedDouble size={23} aria-hidden="true" />,
                };
            }

            return {
                title: "Room assignment is being prepared",
                description: "A confirmed room and reserved bed are required before check-in can open. Check your application for the next step.",
                action: "View application",
                to: `/applications/${activeApplication.id}`,
                icon: <ClipboardList size={23} aria-hidden="true" />,
            };
        }

        return {
            title: "Follow your application",
            description: "Check the latest status and updates on your accommodation application.",
            action: "Track application",
            to: `/applications/${activeApplication.id}`,
            icon: <ClipboardList size={23} aria-hidden="true" />,
        };
    })();

    const decisionReceived = Boolean(
        activeApplication &&
        ["APPROVED", "DECLINED", "WAITING_LIST", "WAITLISTED"].includes(activeApplication.status)
    );

    const applicationChecklist = [
        {
            title: "Student profile",
            description: profileComplete
                ? "Your student information is ready."
                : "Add your academic and contact details.",
            complete: profileComplete,
            to: profileComplete ? "/student/profile" : "/student/onboarding",
            icon: <UserRound size={19} aria-hidden="true" />,
        },
        {
            title: "Accommodation application",
            description: !activeApplication
                ? "Choose an available room to get started."
                : activeApplication.status === "DRAFT"
                    ? preferencesComplete
                        ? "Finish and submit your application."
                        : "Complete your preferences and submit."
                    : `${formatStatus(activeApplication.status)} · ${activeApplication.application_number}`,
            complete: applicationComplete,
            to: activeApplication ? `/applications/${activeApplication.id}` : "/accommodation",
            icon: <Building2 size={19} aria-hidden="true" />,
        },
        {
            title: "Required documents",
            description: !applicationComplete
                ? "Available after your application is submitted."
                : requiredDocumentsComplete
                    ? "Proof of Registration and Student ID are verified."
                    : `${verifiedDocumentCount} of 2 required documents verified.`,
            complete: requiredDocumentsComplete,
            to: activeApplication && applicationComplete ? "/student/documents" : null,
            icon: <ShieldCheck size={19} aria-hidden="true" />,
        },
        {
            title: "Application outcome",
            description: !activeApplication
                ? "Your application will be reviewed after submission."
                : activeApplication.status === "ADDITIONAL_INFO"
                    ? "More information was requested. Review your application."
                    : decisionReceived
                        ? `Decision received · ${formatStatus(activeApplication.status)}`
                        : `Waiting for review · ${formatStatus(activeApplication.status)}`,
            complete: decisionReceived,
            to: activeApplication ? `/applications/${activeApplication.id}` : null,
            icon: <ClipboardList size={19} aria-hidden="true" />,
        },
    ];

    const currentChecklistIndex = activeApplication?.status === "ADDITIONAL_INFO"
        ? 3
        : applicationChecklist.findIndex((step) => !step.complete);


    return (
        <div className="dashboard-page student-dashboard">

            <PortalToolbar user={user} unreadNotifications={unreadNotifications} pageTitle="Student dashboard" />

            <main className="dashboard-content">

                <PlatformAnnouncements />
                <ApplicationPeriodNotice />

                {dataWarning && <div className="property-alert property-alert-error" role="status">{dataWarning}<button type="button" onClick={() => setRefreshKey((current) => current + 1)}>Refresh status</button></div>}

                <section className="dashboard-welcome">

                    <span className="eyebrow">
                        STUDENT DASHBOARD
                    </span>

                    <h1>
                        Good day,{" "}
                        {user?.first_name || "Student"}
                    </h1>

                    <p>
                        Here's what's happening with your
                        accommodation journey.
                    </p>

                </section>

                <section className="dashboard-focus-grid" aria-label="Dashboard highlights">
                    <article className="dashboard-next-step">
                        <span className="dashboard-next-step-icon">{nextStep.icon}</span>
                        <div className="dashboard-next-step-copy">
                            <span className="eyebrow">YOUR NEXT STEP</span>
                            <h2>{nextStep.title}</h2>
                            <p>{nextStep.description}</p>
                        </div>
                        <Link to={nextStep.to} className="dashboard-next-step-link">
                            {nextStep.action}
                            <ArrowRight size={18} aria-hidden="true" />
                        </Link>
                    </article>

                    <Link to="/student/notifications" className="dashboard-updates-card">
                        <span className="dashboard-updates-icon"><Bell size={21} aria-hidden="true" /></span>
                        <span className="dashboard-updates-copy">
                            <span className="eyebrow">UPDATES</span>
                            <strong>
                                {unreadNotifications > 0
                                    ? `${unreadNotifications} unread notification${unreadNotifications === 1 ? "" : "s"}`
                                    : "You're all caught up"}
                            </strong>
                            <span>View updates from StudentHaven</span>
                        </span>
                        <ArrowRight className="dashboard-updates-arrow" size={18} aria-hidden="true" />
                    </Link>
                </section>


                {/* =====================================================
                    DASHBOARD SUMMARY
                   ===================================================== */}

                <section className="dashboard-cards">

                    {/* APPLICATION */}

                    <div className="dashboard-card">

                        <div className="dashboard-card-heading">
                            <span className="dashboard-card-icon"><ClipboardList aria-hidden="true" /></span>
                            <span>Application</span>
                        </div>

                        <strong>
                            {activeApplication
                                ? formatStatus(
                                    activeApplication.status
                                )
                                : "Not started"}
                        </strong>

                        <p>
                            {activeApplication
                                ? activeApplication.application_number
                                : "Your accommodation application hasn't started yet."}
                        </p>

                    </div>


                    {/* ACCOMMODATION */}

                    <div className="dashboard-card">

                        <div className="dashboard-card-heading">
                            <span className="dashboard-card-icon"><Building2 aria-hidden="true" /></span>
                            <span>Accommodation</span>
                        </div>

                        <strong>
                            {booking
                                ? booking.room_number
                                : activeApplication?.status ===
                                    "APPROVED"
                                    ? activeApplication.room_number
                                    : "Not selected"}
                        </strong>

                        <p>
                            {booking
                                ? booking.property_name
                                : activeApplication?.status ===
                                    "APPROVED"
                                    ? activeApplication.property_name
                                    : "Find an accommodation that suits your needs."}
                        </p>

                    </div>


                    {/* PROFILE */}

                    <div className="dashboard-card">

                        <div className="dashboard-card-heading">
                            <span className="dashboard-card-icon"><UserRound aria-hidden="true" /></span>
                            <span>Profile</span>
                        </div>

                        <strong>
                            {profileComplete
                                ? "Complete"
                                : "Incomplete"}
                        </strong>

                        <p>
                            {profileComplete
                                ? "Your student profile is complete."
                                : "Keep your student information up to date."}
                        </p>

                    </div>


                    {/* FUNDING */}

                    <div className="dashboard-card">

                        <div className="dashboard-card-heading">
                            <span className="dashboard-card-icon"><GraduationCap aria-hidden="true" /></span>
                            <span>Funding</span>
                        </div>

                        <strong>
                            {funding
                                ? funding.payment_status ===
                                    "SUCCESSFUL"
                                    ? "Paid"
                                    : formatStatus(
                                        funding.payment_status
                                    )
                                : activeApplication?.status ===
                                    "APPROVED"
                                    ? "Pending"
                                    : "Not started"}
                        </strong>

                        <p>
                            {funding
                                ? funding.balance === "0.00"
                                    ? "No outstanding accommodation balance."
                                    : `Outstanding balance: R ${Number(
                                        funding.balance
                                    ).toLocaleString(
                                        "en-ZA",
                                        {
                                            minimumFractionDigits: 2,
                                        }
                                    )} · ${funding.remaining_months} rent ${funding.remaining_months === 1 ? "month" : "months"} remaining`
                                : "Set up your funding or payment information."}
                        </p>

                    </div>


                    {/* DOCUMENTS */}

                    <div className="dashboard-card">

                        <div className="dashboard-card-heading">
                            <span className="dashboard-card-icon"><ShieldCheck aria-hidden="true" /></span>
                            <span>Documents</span>
                        </div>

                        <strong>
                            {requiredDocumentsComplete
                                ? "Complete"
                                : `${verifiedDocumentCount}/2 verified`}
                        </strong>

                        <p>
                            {requiredDocumentsComplete
                                ? "All required documents are verified."
                                : "Proof of Registration and Student ID are required."}
                        </p>

                    </div>

                </section>


                <section className="journey-section dashboard-checklist-section">
                    <div className="dashboard-checklist-heading">
                        <div className="section-heading">
                            <span className="eyebrow">APPLICATION CHECKLIST</span>
                            <h2>Your application progress</h2>
                        </div>
                        <span className="dashboard-checklist-count">
                            {applicationChecklist.filter((step) => step.complete).length} of {applicationChecklist.length} steps complete
                        </span>
                    </div>

                    <div className="dashboard-checklist">
                        {applicationChecklist.map((step, index) => {
                            const isCurrent = !step.complete && index === currentChecklistIndex;
                            const className = `dashboard-checklist-item ${step.complete ? "is-complete" : isCurrent ? "is-current" : "is-upcoming"}`;
                            const content = (
                                <>
                                    <span className="dashboard-checklist-icon">{step.icon}</span>
                                    <span className="dashboard-checklist-copy">
                                        <strong>{step.title}</strong>
                                        <small>{step.description}</small>
                                    </span>
                                    <span className="dashboard-checklist-status">
                                        {step.complete ? "Complete" : isCurrent ? "Next step" : "Coming up"}
                                    </span>
                                    {step.to && <ArrowRight className="dashboard-checklist-arrow" size={17} aria-hidden="true" />}
                                </>
                            );

                            return step.to ? (
                                <Link to={step.to} className={className} key={step.title}>
                                    {content}
                                </Link>
                            ) : (
                                <div className={className} key={step.title}>
                                    {content}
                                </div>
                            );
                        })}
                    </div>
                </section>


                {/* =====================================================
                    PROFILE SUMMARY
                   ===================================================== */}

                <section className="profile-summary">

                    <div>

                        <span className="eyebrow">
                            YOUR INFORMATION
                        </span>

                        <h2>
                            Student profile
                        </h2>

                    </div>


                    <div className="profile-grid">

                        <div>
                            <span className="profile-fact-label">
                                <Hash size={15} aria-hidden="true" />
                                Student number
                            </span>

                            <strong>
                                {user?.student_profile?.student_number ||
                                    "Not provided"}
                            </strong>
                        </div>


                        <div>
                            <span className="profile-fact-label">
                                <Building2 size={15} aria-hidden="true" />
                                University
                            </span>

                            <strong>
                                {user?.student_profile?.university ||
                                    "Not provided"}
                            </strong>
                        </div>


                        <div>
                            <span className="profile-fact-label">
                                <MapPin size={15} aria-hidden="true" />
                                Campus
                            </span>

                            <strong>
                                {user?.student_profile?.campus ||
                                    "Not provided"}
                            </strong>
                        </div>


                        <div>
                            <span className="profile-fact-label">
                                <BookOpen size={15} aria-hidden="true" />
                                Course
                            </span>

                            <strong>
                                {user?.student_profile?.course ||
                                    "Not provided"}
                            </strong>
                        </div>


                        <div>
                            <span className="profile-fact-label">
                                <CalendarDays size={15} aria-hidden="true" />
                                Year of study
                            </span>

                            <strong>
                                {user?.student_profile?.year_of_study
                                    ? `Year ${user.student_profile.year_of_study}`
                                    : "Not provided"}
                            </strong>
                        </div>


                        <div>
                            <span className="profile-fact-label">
                                <Mail size={15} aria-hidden="true" />
                                Email
                            </span>

                            <strong>
                                {user?.email ||
                                    "Not provided"}
                            </strong>
                        </div>

                    </div>

                </section>


                {/* =====================================================
                    NEXT STEPS
                   ===================================================== */}

                <section className="dashboard-actions">

                    <div className="section-heading">

                        <span className="eyebrow">
                            NEXT STEPS
                        </span>

                        <h2>
                            Continue your journey
                        </h2>

                    </div>


                    <div className="action-grid">

                        <Link
                            to="/accommodation"
                            className="dashboard-action"
                        >
                            <span className="dashboard-action-icon"><Search size={21} aria-hidden="true" /></span>

                            <strong>
                                Find Accommodation
                            </strong>

                            <span>
                                Explore verified properties
                                and available rooms.
                            </span>

                        </Link>


                        <Link
                            to="/student/profile"
                            className="dashboard-action"
                        >
                            <span className="dashboard-action-icon"><UserRound size={21} aria-hidden="true" /></span>

                            <strong>
                                {profileComplete
                                    ? "View Profile"
                                    : "Complete Profile"}
                            </strong>

                            <span>
                                {profileComplete
                                    ? "View your student information."
                                    : "Add your personal and academic information."}
                            </span>

                        </Link>


                        <Link
                            to="/student/applications"
                            className="dashboard-action"
                        >
                            <span className="dashboard-action-icon"><ClipboardList size={21} aria-hidden="true" /></span>

                            <strong>
                                My Applications
                            </strong>

                            <span>
                                Track your accommodation
                                applications.
                            </span>

                        </Link>

                        <Link to="/account/security" className="dashboard-action">
                            <span className="dashboard-action-icon"><ShieldCheck size={21} aria-hidden="true" /></span>
                            <strong>Account Security</strong>
                            <span>Manage sign-in verification and review your active devices.</span>
                        </Link>

                        <Link to="/student/funding-programs" className="dashboard-action">
                            <span className="dashboard-action-icon"><GraduationCap size={21} aria-hidden="true" /></span>
                            <strong>Bursaries & Sponsorships</strong>
                            <span>Find funding programmes, apply, and track award decisions.</span>
                        </Link>

                        <Link
                            to="/student/waiting-list"
                            className="dashboard-action"
                        >
                            <span className="dashboard-action-icon"><Clock3 size={21} aria-hidden="true" /></span>
                            <strong>Waiting List</strong>
                            <span>Check your queue position and respond to room offers.</span>
                        </Link>

                        <Link to="/student/complaints" className="dashboard-action">
                            <span className="dashboard-action-icon"><CircleHelp size={21} aria-hidden="true" /></span>
                            <strong>Help & Complaints</strong>
                            <span>Submit a concern and follow staff responses.</span>
                        </Link>

                        <Link to="/student/messages" className="dashboard-action">
                            <span className="dashboard-action-icon"><MessageCircle size={21} aria-hidden="true" /></span>
                            <strong>Messages</strong>
                            <span>Contact StudentHaven support or an accommodation provider.</span>
                        </Link>

                        <Link to="/student/recommendations" className="dashboard-action">
                            <span className="dashboard-action-icon"><Sparkles size={21} aria-hidden="true" /></span>
                            <strong>Accommodation Matches</strong>
                            <span>Rank available properties by your budget, room and campus preferences.</span>
                        </Link>

                        <Link to="/student/assistant" className="dashboard-action">
                            <span className="dashboard-action-icon"><Bot size={21} aria-hidden="true" /></span>
                            <strong>StudentHaven Guide</strong>
                            <span>Get help with common steps or connect with staff.</span>
                        </Link>


                        <Link
                            to="/student/notifications"
                            className="dashboard-action"
                        >
                            <span className="dashboard-action-icon"><Bell size={21} aria-hidden="true" /></span>

                            <strong>
                                Notifications
                            </strong>

                            <span>
                                {unreadNotifications > 0
                                    ? `${unreadNotifications} unread notification${unreadNotifications === 1 ? "" : "s"} waiting for you.`
                                    : "View your latest StudentHaven updates."}
                            </span>

                        </Link>


                        {approvalComplete && booking &&
                            activeApplication && (
                                <Link
                                    to={`/student/my-room/${activeApplication.id}`}
                                    className="dashboard-action"
                                >
                                    <span className="dashboard-action-icon"><BedDouble size={21} aria-hidden="true" /></span>

                                    <strong>
                                        {booking.check_in_eligible ? "Check in now" : "My Room"}
                                    </strong>

                                    <span>
                                        {booking.check_in_eligible
                                            ? "Your arrival date has arrived. Open your QR code and show it to residence staff."
                                            : "View your confirmed accommodation, room and move-in details."}
                                    </span>

                                </Link>
                            )}


                        {approvalComplete &&
                            activeApplication && (
                                <Link
                                    to="/student/maintenance"
                                    className="dashboard-action"
                                >
                                    <span className="dashboard-action-icon"><Wrench size={21} aria-hidden="true" /></span>

                                    <strong>
                                        Maintenance & Support
                                    </strong>

                                    <span>
                                        Report maintenance issues,
                                        track requests and view
                                        resolution updates.
                                    </span>

                                </Link>
                            )}

                    </div>

                </section>

            </main>

            <Link className="student-ai-fab" to="/student/assistant" aria-label="Open the StudentHaven AI guide">
                <Bot size={22} aria-hidden="true" />
                <span>Ask StudentHaven AI</span>
            </Link>

        </div>
    );
}

export default Dashboard;
