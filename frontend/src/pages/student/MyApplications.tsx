import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import "../../App.css";

import {
    getMyApplications,
} from "../../services/api";

import type {
    Application,
} from "../../services/api";


function formatStatus(status: string) {
    return status
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) =>
            letter.toUpperCase()
        );
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


function getStatusClass(status: string) {
    switch (status) {
        case "APPROVED":
            return "application-status approved";

        case "UNDER_REVIEW":
            return "application-status review";

        case "SUBMITTED":
            return "application-status submitted";

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


function MyApplications() {
    const [applications, setApplications] =
        useState<Application[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");


    useEffect(() => {
        async function loadApplications() {
            try {
                setLoading(true);
                setError("");

                const result =
                    await getMyApplications();

                setApplications(result);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load your applications."
                );
            } finally {
                setLoading(false);
            }
        }

        loadApplications();
    }, []);


    if (loading) {
        return (
            <div className="page-shell">
                <div className="loading-state">
                    Loading your applications...
                </div>
            </div>
        );
    }


    if (error) {
        return (
            <div className="page-shell">
                <div className="error-state">
                    <h1>
                        Unable to load applications
                    </h1>

                    <p>{error}</p>

                    <Link
                        to="/student/dashboard"
                        className="secondary-button"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }


    return (
        <div className="page-shell">

            <div className="my-applications-page">

                <header className="my-applications-header">

                    <div>
                        <span className="section-eyebrow">
                            STUDENTHAVEN
                        </span>

                        <h1>
                            My Applications
                        </h1>

                        <p>
                            Track your accommodation
                            applications and their progress.
                        </p>
                    </div>

                    <Link
                        to="/accommodation"
                        className="primary-button"
                    >
                        Find Accommodation
                    </Link>

                </header>


                {applications.length === 0 ? (
                    <section className="my-applications-empty">

                        <span className="section-eyebrow">
                            NO APPLICATIONS
                        </span>

                        <h2>
                            You haven't started an
                            accommodation application yet.
                        </h2>

                        <p>
                            Explore available accommodation
                            and select a room to begin.
                        </p>

                        <Link
                            to="/accommodation"
                            className="primary-button"
                        >
                            Find Accommodation
                        </Link>

                    </section>
                ) : (
                    <div className="my-applications-list">

                        {applications.map(
                            (application) => {

                                const approved =
                                    application.status ===
                                    "APPROVED";

                                return (
                                    <article
                                        className="my-application-card"
                                        key={application.id}
                                    >

                                        <div className="my-application-card-top">

                                            <div>

                                                <span className="application-eyebrow">
                                                    APPLICATION
                                                </span>

                                                <h2>
                                                    {
                                                        application.application_number
                                                    }
                                                </h2>

                                            </div>

                                            <span
                                                className={getStatusClass(
                                                    application.status
                                                )}
                                            >
                                                <span className="status-dot" />

                                                {formatStatus(
                                                    application.status
                                                )}
                                            </span>

                                        </div>


                                        <div className="my-application-details">

                                            <div>
                                                <span>
                                                    Property
                                                </span>

                                                <strong>
                                                    {
                                                        application.property_name
                                                    }
                                                </strong>
                                            </div>


                                            <div>
                                                <span>
                                                    Room
                                                </span>

                                                <strong>
                                                    {
                                                        application.room_number
                                                    }
                                                </strong>
                                            </div>


                                            <div>
                                                <span>
                                                    Sign-in
                                                </span>

                                                <strong>
                                                    {formatDate(
                                                        application.expected_sign_in_date
                                                    )}
                                                </strong>
                                            </div>


                                            <div>
                                                <span>
                                                    Last updated
                                                </span>

                                                <strong>
                                                    {formatDate(
                                                        application.updated_at
                                                    )}
                                                </strong>
                                            </div>

                                        </div>


                                        <div className="my-application-actions">

                                            <Link
                                                to={`/applications/${application.id}`}
                                                className="primary-button"
                                            >
                                                View Application
                                            </Link>


                                            {approved && (
                                                <>
                                                    <Link
                                                        to={`/contracts/${application.id}`}
                                                        className="secondary-button"
                                                    >
                                                        Contract
                                                    </Link>

                                                    <Link
                                                        to={`/funding/${application.id}`}
                                                        className="secondary-button"
                                                    >
                                                        Funding
                                                    </Link>

                                                </>
                                            )}

                                        </div>

                                    </article>
                                );
                            }
                        )}

                    </div>
                )}


                <div className="my-applications-footer">

                    <Link
                        to="/student/dashboard"
                        className="secondary-button"
                    >
                        ← Back to Dashboard
                    </Link>

                </div>

            </div>

        </div>
    );
}

export default MyApplications;
