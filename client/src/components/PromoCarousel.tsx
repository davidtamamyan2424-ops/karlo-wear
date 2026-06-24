import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useImageCarousel } from "../lib/imageCarousel";
import { ru } from "../i18n/ru";

const AUTO_INTERVAL_MS = 5000;

export default function PromoCarousel() {
  const slides = ru.promo.slides;
  const paused = useRef(false);
  const {
    containerRef,
    trackRef,
    index,
    goTo,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
  } = useImageCarousel({
    slideCount: slides.length,
    enabled: slides.length > 1,
  });

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      if (paused.current) return;
      goTo((index + 1) % slides.length);
    }, AUTO_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [index, goTo, slides.length]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    paused.current = true;
    onPointerDown(e.clientX, e.clientY, e.pointerId);
    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const handlePointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    onPointerEnd(e.clientX);
    paused.current = false;
    try {
      containerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  return (
    <section
      className="mb-6 overflow-hidden rounded-card bg-ink text-white shadow-card"
      aria-label={ru.promo.title}
      onPointerEnter={() => {
        paused.current = true;
      }}
      onPointerLeave={() => {
        paused.current = false;
      }}
    >
      <div
        ref={containerRef}
        className="relative touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={(e) => onPointerMove(e.clientX, e.clientY)}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          ref={trackRef}
          className="flex will-change-transform"
          style={{ width: `${slides.length * 100}%` }}
        >
          {slides.map((slide, i) => (
            <article
              key={slide.title}
              className="flex w-full shrink-0 flex-col justify-center px-5 py-6"
              style={{ width: `${100 / slides.length}%` }}
              aria-hidden={i !== index}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                {ru.promo.badge}
              </p>
              <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight">
                {slide.title}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/75">
                {slide.subtitle}
              </p>
            </article>
          ))}
        </div>

        {slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.title}
                type="button"
                aria-label={`${ru.promo.goToSlide} ${i + 1}`}
                onClick={() => goTo(i)}
                className={[
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-5 bg-white" : "w-1.5 bg-white/35",
                ].join(" ")}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
