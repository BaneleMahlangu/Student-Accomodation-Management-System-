import { useEffect, useState } from "react";
import { getNotifications } from "../services/api";

const REFRESH_INTERVAL_MS = 60_000;

export default function useUnreadNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function refresh() {
      if (document.visibilityState === "hidden") return;

      try {
        const result = await getNotifications();
        if (active) setUnreadCount(result.unread_count);
      } catch {
        // Keep the most recent count if a temporary refresh fails.
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return unreadCount;
}
