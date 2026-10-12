import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { ACCOMMODATION_IMAGE_LIBRARY } from "../data/accommodationImages";

const slides = ACCOMMODATION_IMAGE_LIBRARY.slice(0, 8);

export default function AccommodationSlideshow() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (paused || reduceMotion.matches) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setActiveIndex((current) => (current + 1) % slides.length);
      }
    }, 6500);
    return () => window.clearInterval(timer);
  }, [paused]);

  const current = slides[activeIndex];
  return (
    <section className="accommodation-slideshow" role="region" aria-roledescription="carousel" aria-label="Student accommodation photographs">
      <div className="accommodation-slideshow-images" aria-live="off">
        {slides.map((slide, index) => (
          <img
            key={slide.url}
            src={slide.url}
            alt=""
            aria-hidden="true"
            className={index === activeIndex ? "accommodation-slide is-active" : "accommodation-slide"}
            loading={index === 0 ? "eager" : "lazy"}
          />
        ))}
      </div>
      <div className="accommodation-slideshow-shade" />
      <div className="accommodation-slideshow-caption">
        <span>{current.category} · StudentHaven residences</span>
        <strong>{current.caption}</strong>
      </div>
      <div className="accommodation-slideshow-controls">
        <span aria-label={`Photograph ${activeIndex + 1} of ${slides.length}`}>{activeIndex + 1} / {slides.length}</span>
        <button
          type="button"
          onClick={() => setActiveIndex((index) => (index - 1 + slides.length) % slides.length)}
          aria-label="Previous photograph"
          title="Previous photograph"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? "Play slideshow" : "Pause slideshow"}
          aria-pressed={paused}
          title={paused ? "Play slideshow" : "Pause slideshow"}
        >
          {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => setActiveIndex((index) => (index + 1) % slides.length)}
          aria-label="Next photograph"
          title="Next photograph"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {slides.map((slide, index) => (
          <button
            key={slide.url}
            type="button"
            className="accommodation-slide-dot"
            aria-label={`Show photograph ${index + 1}: ${slide.caption}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>
    </section>
  );
}
