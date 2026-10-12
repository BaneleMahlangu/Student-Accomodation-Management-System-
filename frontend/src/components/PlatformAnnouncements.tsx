import { useEffect, useState } from "react";
import { getApplicationAvailability, getCurrentAnnouncements } from "../services/api";
import type { ApplicationAvailability, PlatformAnnouncement } from "../services/api";

export function PlatformAnnouncements() {
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  useEffect(() => {
    let active = true;
    getCurrentAnnouncements().then((items) => { if (active) setAnnouncements(items); }).catch(() => { if (active) setAnnouncements([]); });
    return () => { active = false; };
  }, []);
  if (announcements.length === 0) return null;
  return <section className="platform-announcements" aria-label="StudentHaven announcements">
    {announcements.map((item) => <article className="platform-announcement" key={item.id}><span className="eyebrow">PLATFORM UPDATE</span><div><strong>{item.title}</strong><p>{item.body}</p></div></article>)}
  </section>;
}

export function ApplicationPeriodNotice() {
  const [availability, setAvailability] = useState<ApplicationAvailability | null>(null);
  useEffect(() => {
    let active = true;
    getApplicationAvailability().then((result) => { if (active) setAvailability(result); }).catch(() => { if (active) setAvailability(null); });
    return () => { active = false; };
  }, []);
  if (!availability || availability.is_open) return null;
  return <aside className="application-period-notice" role="status"><strong>{availability.period_name}</strong><span>{availability.message}</span></aside>;
}
