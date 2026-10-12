import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Bell, BookOpen, ClipboardList, FileText, House, MessageCircle, ShieldCheck, Wrench } from "lucide-react";
import { Link } from "react-router-dom";

import {
    getNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from "../../services/api";

import type {
    StudentNotification,
} from "../../services/api";

function formatNotificationTime(dateString: string): string {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getNotificationCategory(
    notification: StudentNotification
): string {
    const type = notification.notification_type;

    if (type.startsWith("APPLICATION_") ||
        type === "ADDITIONAL_INFORMATION" ||
        type === "WAITING_LIST" ||
        type === "ADMIN_FEEDBACK" ||
        type === "LANDLORD_FEEDBACK") {
        return "Application";
    }

    if (Number(notification.extra_data?.conversation_id) > 0) {
        return "Messages";
    }

    if (
        type.startsWith("DOCUMENT")
    ) {
        return "Documents";
    }

    if (
        type.startsWith("CONTRACT_") ||
        type.startsWith("PAYMENT_") ||
        type === "FUNDING_UPDATED"
    ) {
        return "Funding & Contracts";
    }

    if (
        type.startsWith("BOOKING_") ||
        type.startsWith("CHECK_") ||
        type === "CHECKED_IN" ||
        type === "CHECKED_OUT"
    ) {
        return "Accommodation";
    }

    if (type.startsWith("MAINTENANCE_")) {
        return "Maintenance";
    }

    return "System";
}

function getNotificationIcon(notification: StudentNotification) {
    const category = getNotificationCategory(notification);

    switch (category) {
        case "Application":
            return <ClipboardList size={19} aria-hidden="true" />;
        case "Documents":
            return <FileText size={19} aria-hidden="true" />;
        case "Funding & Contracts":
            return <BookOpen size={19} aria-hidden="true" />;
        case "Accommodation":
            return <House size={19} aria-hidden="true" />;
        case "Messages":
            return <MessageCircle size={19} aria-hidden="true" />;
        case "Maintenance":
            return <Wrench size={19} aria-hidden="true" />;
        case "Safety":
            return <ShieldCheck size={19} aria-hidden="true" />;
        default:
            return <Bell size={19} aria-hidden="true" />;
    }
}

function getNotificationTarget(
    notification: StudentNotification,
    audience: "student" | "landlord" | "admin",
): string | null {
    const conversationId = Number(notification.extra_data?.conversation_id);
    if (Number.isSafeInteger(conversationId) && conversationId > 0) {
        const base = audience === "admin"
            ? "/admin/messages"
            : audience === "landlord"
                ? "/landlord/messages"
                : "/student/messages";
        return `${base}?conversation=${conversationId}`;
    }

    if (notification.application) {
        if (audience === "admin") return "/admin/applications";
        if (audience === "landlord") {
            if (notification.document && notification.notification_type.startsWith("DOCUMENT")) {
                return `/landlord/applications/${notification.application}/documents#document-${notification.document}`;
            }
            return "/landlord/applications";
        }
        return `/applications/${notification.application}`;
    }

    return null;
}

export default function Notifications({ audience = "student" }: { audience?: "student" | "landlord" | "admin" }) {
    const [notifications, setNotifications] = useState<
        StudentNotification[]
    >([]);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [error, setError] = useState("");
    const [actionError, setActionError] = useState("");

    const [filter, setFilter] = useState<
        "ALL" | "UNREAD"
    >("ALL");

    const loadNotifications = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const result = await getNotifications();

            setNotifications(result.notifications ?? []);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load notifications."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    useEffect(() => {
        let active = true;
        const refreshQuietly = async () => {
            if (document.visibilityState === "hidden") return;
            try {
                const result = await getNotifications();
                if (active) setNotifications(result.notifications ?? []);
            } catch {
                // Preserve the current notification list if a refresh is temporarily unavailable.
            }
        };
        const interval = window.setInterval(() => void refreshQuietly(), 60_000);
        document.addEventListener("visibilitychange", refreshQuietly);
        window.addEventListener("focus", refreshQuietly);
        return () => {
            active = false;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", refreshQuietly);
            window.removeEventListener("focus", refreshQuietly);
        };
    }, []);

    const unreadCount = useMemo(
        () =>
            notifications.filter(
                (notification) => !notification.is_read
            ).length,
        [notifications]
    );

    const filteredNotifications = useMemo(() => {
        if (filter === "UNREAD") {
            return notifications.filter(
                (notification) => !notification.is_read
            );
        }

        return notifications;
    }, [notifications, filter]);

    async function handleMarkRead(
        notification: StudentNotification
    ) {
        if (notification.is_read) {
            return;
        }

        try {
            setActionLoading(true);
            setActionError("");

            const updated =
                await markNotificationRead(notification.id);

            setNotifications((current) =>
                current.map((item) =>
                    item.id === updated.id
                        ? updated
                        : item
                )
            );
        } catch (err) {
            setActionError(
                err instanceof Error
                    ? err.message
                    : "Unable to update notification."
            );
        } finally {
            setActionLoading(false);
        }
    }

    async function handleMarkAllRead() {
        if (unreadCount === 0) {
            return;
        }

        try {
            setActionLoading(true);
            setActionError("");

            await markAllNotificationsRead();

            const now = new Date().toISOString();

            setNotifications((current) =>
                current.map((notification) => ({
                    ...notification,
                    is_read: true,
                    read_at:
                        notification.read_at ?? now,
                }))
            );
        } catch (err) {
            setActionError(
                err instanceof Error
                    ? err.message
                    : "Unable to mark notifications as read."
            );
        } finally {
            setActionLoading(false);
        }
    }

    const isLandlord = audience === "landlord";
    const isAdmin = audience === "admin";
    const dashboardPath = isAdmin ? "/admin/dashboard" : isLandlord ? "/landlord/dashboard" : "/student/dashboard";
    const audienceLabel = isAdmin ? "ADMINISTRATOR CONSOLE" : isLandlord ? "LANDLORD OPERATIONS" : "STUDENTHAVEN";

    return (
        <main className={`student-page notifications-page ${isLandlord ? "landlord-notifications-page" : ""}`}>
            <section className="notifications-header">
                <div>
                    <p className="page-eyebrow">
                        {audienceLabel}
                    </p>

                    <h1>Notifications</h1>

                    <p>
                        Stay updated about your applications,
                        documents, accommodation, funding,
                        maintenance and important StudentHaven
                        activity.
                    </p>
                </div>

                <div className="notifications-summary">
                    <strong>{unreadCount}</strong>
                    <span>Unread</span>
                </div>
                <Link className="dashboard-secondary-action" to={dashboardPath}>Back to dashboard</Link>
            </section>

            <section className="notifications-toolbar">
                <div className="notifications-filters">
                    <button
                        type="button"
                        className={
                            filter === "ALL"
                                ? "notification-filter active"
                                : "notification-filter"
                        }
                        onClick={() => setFilter("ALL")}
                    >
                        All
                    </button>

                    <button
                        type="button"
                        className={
                            filter === "UNREAD"
                                ? "notification-filter active"
                                : "notification-filter"
                        }
                        onClick={() => setFilter("UNREAD")}
                    >
                        Unread
                        {unreadCount > 0 && (
                            <span className="notification-filter-count">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                </div>

                <button
                    type="button"
                    className="notifications-mark-all"
                    onClick={handleMarkAllRead}
                    disabled={
                        unreadCount === 0 ||
                        actionLoading
                    }
                >
                    {actionLoading
                        ? "Updating..."
                        : "Mark all as read"}
                </button>
            </section>

            {error && (
                <div className="notification-state notification-error">
                    <strong>Unable to load notifications</strong>
                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={loadNotifications}
                    >
                        Try again
                    </button>
                </div>
            )}

            {actionError && (
                <div className="notification-action-error">
                    {actionError}
                </div>
            )}

            {loading ? (
                <div className="notification-state">
                    <div className="notification-loading-spinner" />
                    <strong>Loading notifications...</strong>
                    <span>
                        Checking for your latest StudentHaven
                        updates.
                    </span>
                </div>
            ) : !error &&
              filteredNotifications.length === 0 ? (
                <div className="notification-state notification-empty">
                    <div className="notification-empty-icon">
                        <Bell size={24} aria-hidden="true" />
                    </div>

                    <strong>
                        {filter === "UNREAD"
                            ? "You're all caught up"
                            : "No notifications yet"}
                    </strong>

                    <span>
                        {filter === "UNREAD"
                            ? "There are no unread StudentHaven notifications."
                            : "Important updates about your StudentHaven account will appear here."}
                    </span>
                </div>
            ) : (
                <section className="notifications-list">
                    {filteredNotifications.map(
                        (notification) => {
                            const category =
                                getNotificationCategory(
                                    notification
                                );
                            const target = getNotificationTarget(notification, audience);

                            return (
                                <article
                                    key={notification.id}
                                    className={
                                        notification.is_read
                                            ? "notification-card"
                                            : "notification-card unread"
                                    }
                                >
                                    <div className="notification-icon">
                                        {getNotificationIcon(
                                            notification
                                        )}
                                    </div>

                                    <div className="notification-content">
                                        <div className="notification-card-top">
                                            <div>
                                                <span className="notification-category">
                                                    {category}
                                                </span>

                                                <h2>
                                                    {
                                                        notification.title
                                                    }
                                                </h2>
                                            </div>

                                            {!notification.is_read && (
                                                <span className="notification-unread-dot" />
                                            )}
                                        </div>

                                        <p className="notification-message">
                                            {
                                                notification.message
                                            }
                                        </p>

                                        <div className="notification-meta">
                                            <span>
                                                {formatNotificationTime(
                                                    notification.created_at
                                                )}
                                            </span>

                                            {notification.actor_name && (
                                                <>
                                                    <span>
                                                        •
                                                    </span>
                                                    <span>
                                                        Updated by{" "}
                                                        {
                                                            notification.actor_name
                                                        }
                                                    </span>
                                                </>
                                            )}

                                            {notification.application_number && (
                                                <>
                                                    <span>
                                                        •
                                                    </span>
                                                    <span>
                                                        {
                                                            notification.application_number
                                                        }
                                                    </span>
                                                </>
                                            )}

                                            {notification.document_type && (
                                                <>
                                                    <span>
                                                        •
                                                    </span>
                                                    <span>
                                                        {
                                                            notification.document_type
                                                        }
                                                    </span>
                                                </>
                                            )}

                                            {notification.maintenance_reference && (
                                                <>
                                                    <span>
                                                        •
                                                    </span>
                                                    <span>
                                                        {
                                                            notification.maintenance_reference
                                                        }
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        <div className="notification-card-actions">
                                        {!notification.is_read && (
                                            <button
                                                type="button"
                                                className="notification-read-button"
                                                onClick={() =>
                                                    handleMarkRead(
                                                        notification
                                                    )
                                                }
                                                disabled={
                                                    actionLoading
                                                }
                                            >
                                                Mark as read
                                            </button>
                                        )}
                                        {target && (
                                            <Link
                                                className="notification-open-link"
                                                to={target}
                                                onClick={() => void handleMarkRead(notification)}
                                            >
                                                {category === "Messages" ? "Open conversation" : isLandlord && notification.notification_type === "DOCUMENTS_SUBMITTED" ? "Review document" : "View update"}
                                            </Link>
                                        )}
                                        </div>
                                    </div>
                                </article>
                            );
                        }
                    )}
                </section>
            )}
        </main>
    );
}
