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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const blockSelect = (e: Event) => e.preventDefault();
    el.addEventListener("selectstart", blockSelect);
    return () => el.removeEventListener("selectstart", blockSelect);
  }, [containerRef]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
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
      className="mb-6 overflow-hidden rounded-card border border-[#ebe4da] bg-gradient-to-br from-[#fdfbf7] via-card to-[#f3ede4] shadow-card"
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
        className="relative select-none touch-pan-y"
        style={{ touchAction: "pan-y pinch-zoom", userSelect: "none", WebkitUserSelect: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={(e) => onPointerMove(e.clientX, e.clientY)}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDragStart={(e) => e.preventDefault()}
      >
        <div ref={trackRef} className="flex w-full will-change-transform">
          {slides.map((slide, i) => (
            <article
              key={slide.title}
              className="flex min-h-[132px] w-full shrink-0 select-none flex-col justify-center px-5 py-6 pb-8"
              style={{ userSelect: "none", WebkitUserSelect: "none" }}
              aria-hidden={i !== index}
            >
              <p className="select-none text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
                {ru.promo.badge}
              </p>
              <h2 className="mt-2 select-none text-[20px] font-semibold leading-tight tracking-tight text-ink">
                {slide.title}
              </h2>
              <p className="mt-2 max-w-sm select-none text-sm leading-relaxed text-muted">
                {slide.subtitle}
              </p>
            </article>
          ))}
        </div>

        {slides.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.title}
                type="button"
                aria-label={`${ru.promo.goToSlide} ${i + 1}`}
                onClick={() => goTo(i)}
                onPointerDown={(e) => e.stopPropagation()}
                className={[
                  "pointer-events-auto h-1.5 rounded-full transition-all",
                  i === index ? "w-5 bg-ink/80" : "w-1.5 bg-[#d8d0c6]",
                ].join(" ")}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
