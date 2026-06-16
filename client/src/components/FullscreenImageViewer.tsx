import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ru } from "../i18n/ru";
import {
  useImageCarousel,
} from "../lib/imageCarousel";

interface Props {
  images: string[];
  initialIndex: number;
  alt: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 280;
const DISMISS_THRESHOLD = 110;
const CLOSE_ANIM_MS = 280;

type GestureMode = "none" | "horizontal" | "dismiss";

function pointerDistance(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number },
): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function useScrollLock() {
  useEffect(() => {
    const scrollY = window.scrollY;
    const { style } = document.body;
    const prev = {
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      overflow: style.overflow,
      width: style.width,
    };

    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.left = "0";
    style.right = "0";
    style.width = "100%";
    style.overflow = "hidden";

    return () => {
      style.position = prev.position;
      style.top = prev.top;
      style.left = prev.left;
      style.right = prev.right;
      style.overflow = prev.overflow;
      style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, []);
}

export default function FullscreenImageViewer({ images, initialIndex, alt, onClose }: Props) {
  const hasMultiple = images.length > 1;

  const carousel = useImageCarousel({
    slideCount: images.length,
    initialIndex,
    enabled: hasMultiple,
  });

  const { index, containerRef, trackRef, goTo, isDragging } = carousel;

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dismissDy, setDismissDy] = useState(0);
  const [dismissAnimating, setDismissAnimating] = useState(false);

  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef({ active: false, startDist: 0, startScale: 1 });
  const panRef = useRef({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
  const modeRef = useRef<GestureMode>("none");
  const dismissStartRef = useRef({ startY: 0 });
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const closingRef = useRef(false);
  const scaleRef = useRef(1);

  useScrollLock();

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const resetZoom = useCallback(() => {
    setScale(1);
    scaleRef.current = 1;
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetZoom();
    setDismissDy(0);
    setDismissAnimating(false);
  }, [index, resetZoom]);

  const closeAnimated = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setDismissAnimating(true);
    setDismissDy(window.innerHeight * 0.55);
    window.setTimeout(onClose, CLOSE_ANIM_MS);
  }, [onClose]);

  const toggleDoubleTapZoom = (clientX: number, clientY: number) => {
    if (scaleRef.current > 1) {
      resetZoom();
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      setScale(2);
      scaleRef.current = 2;
      return;
    }
    const cx = clientX - rect.left - rect.width / 2;
    const cy = clientY - rect.top - rect.height / 2;
    setScale(2);
    scaleRef.current = 2;
    setPan({ x: -cx * 0.5, y: -cy * 0.5 });
  };

  const resetMode = () => {
    modeRef.current = "none";
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (closingRef.current) return;

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      pinchRef.current = {
        active: true,
        startDist: pointerDistance(
          { clientX: pts[0].x, clientY: pts[0].y },
          { clientX: pts[1].x, clientY: pts[1].y },
        ),
        startScale: scaleRef.current,
      };
      carousel.cancelGesture();
      panRef.current.active = false;
      resetMode();
      return;
    }

    if (pointersRef.current.size !== 1) return;

    if (scaleRef.current > 1) {
      panRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
      carousel.cancelGesture();
      resetMode();
      return;
    }

    resetMode();
    setDismissAnimating(false);
    dismissStartRef.current.startY = e.clientY;
    carousel.onPointerDown(e.clientX, e.clientY, e.pointerId);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (closingRef.current) return;
    if (!pointersRef.current.has(e.pointerId)) return;

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchRef.current.active) {
      const pts = [...pointersRef.current.values()];
      const dist = pointerDistance(
        { clientX: pts[0].x, clientY: pts[0].y },
        { clientX: pts[1].x, clientY: pts[1].y },
      );
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, (dist / pinchRef.current.startDist) * pinchRef.current.startScale),
      );
      setScale(next);
      scaleRef.current = next;
      if (next <= 1) setPan({ x: 0, y: 0 });
      return;
    }

    if (pointersRef.current.size !== 1) return;

    if (panRef.current.active && scaleRef.current > 1) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setPan({
        x: panRef.current.startPanX + dx,
        y: panRef.current.startPanY + dy,
      });
      return;
    }

    if (scaleRef.current > 1) return;

    if (modeRef.current === "horizontal") {
      carousel.onPointerMove(e.clientX, e.clientY);
      return;
    }

    if (modeRef.current === "dismiss") {
      setDismissDy(Math.max(0, e.clientY - dismissStartRef.current.startY));
      return;
    }

    const axis = carousel.onPointerMove(e.clientX, e.clientY);

    if (axis === "horizontal") {
      modeRef.current = "horizontal";
      return;
    }

    if (axis === "vertical") {
      const dy = e.clientY - dismissStartRef.current.startY;
      if (dy > 0) {
        carousel.cancelGesture();
        modeRef.current = "dismiss";
        setDismissDy(Math.max(0, dy));
      }
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    pointersRef.current.delete(e.pointerId);

    if (pinchRef.current.active && pointersRef.current.size < 2) {
      pinchRef.current.active = false;
      if (scaleRef.current < 1.05) resetZoom();
    }

    if (panRef.current.active && pointersRef.current.size === 0) {
      panRef.current.active = false;
    }

    if (pointersRef.current.size > 0) return;

    const mode = modeRef.current;

    if (mode === "horizontal" && scaleRef.current <= 1) {
      carousel.onPointerEnd(e.clientX);
    } else if (mode === "dismiss") {
      const dy = e.clientY - dismissStartRef.current.startY;
      if (dy >= DISMISS_THRESHOLD) {
        closeAnimated();
      } else {
        setDismissAnimating(true);
        setDismissDy(0);
        window.setTimeout(() => setDismissAnimating(false), CLOSE_ANIM_MS);
      }
    } else if (scaleRef.current <= 1) {
      const g = carousel.getGesture();
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        const now = Date.now();
        const last = lastTapRef.current;
        const near =
          Math.abs(e.clientX - last.x) < 24 && Math.abs(e.clientY - last.y) < 24;
        if (near && now - last.time < DOUBLE_TAP_MS) {
          toggleDoubleTapZoom(e.clientX, e.clientY);
          lastTapRef.current = { time: 0, x: 0, y: 0 };
        } else {
          lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
        }
      }
      carousel.cancelGesture();
    }

    resetMode();

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const onContentClick = (ev: ReactMouseEvent) => {
    const target = ev.target as HTMLElement;
    if (target.closest("img") || target.closest("button")) return;
    if (window.matchMedia("(pointer: fine)").matches) onClose();
  };

  const onDoubleClick = (ev: ReactMouseEvent) => {
    toggleDoubleTapZoom(ev.clientX, ev.clientY);
  };

  const backdropOpacity = Math.max(0.15, 1 - dismissDy / 420);
  const contentScale = Math.max(0.88, 1 - dismissDy / 900);
  const src = images[index];

  const contentTransition =
    dismissAnimating || (!isDragging && dismissDy === 0)
      ? "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease"
      : "none";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      style={{
        backgroundColor: `rgba(0,0,0,${backdropOpacity})`,
        transition: dismissAnimating ? "background-color 0.28s ease" : "none",
      }}
    >
      <button
        type="button"
        onClick={(ev) => {
          ev.stopPropagation();
          onClose();
        }}
        aria-label={ru.common.close}
        className="press fixed right-4 top-[max(env(safe-area-inset-top),12px)] z-[60] flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {hasMultiple && (
        <div className="pointer-events-none absolute inset-x-0 top-[max(env(safe-area-inset-top),16px)] z-[55] flex justify-center">
          <span className="rounded-full bg-black/40 px-3 py-1 text-sm font-medium text-white/85 backdrop-blur-sm">
            {index + 1} / {images.length}
          </span>
        </div>
      )}

      <div
        className="relative mt-14 min-h-0 flex-1 touch-none"
        style={{
          transform: scale <= 1 ? `translateY(${dismissDy}px) scale(${contentScale})` : undefined,
          opacity: scale <= 1 ? Math.max(0.35, 1 - dismissDy / 500) : 1,
          transition: scale <= 1 ? contentTransition : "none",
        }}
        onClick={onContentClick}
      >
        <div
          ref={containerRef}
          className="h-full w-full"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {scale <= 1 && hasMultiple ? (
            <div
              ref={trackRef}
              className="flex h-full w-full will-change-transform"
              style={{
                transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {images.map((image, i) => (
                <div key={i} className="flex h-full w-full shrink-0 items-center justify-center px-2">
                  <img
                    src={image}
                    alt={`${alt} — фото ${i + 1}`}
                    draggable={false}
                    className="max-h-full max-w-full select-none object-contain"
                    onDoubleClick={i === index ? onDoubleClick : undefined}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center px-2">
              <img
                src={src}
                alt={`${alt} — фото ${index + 1}`}
                draggable={false}
                className="max-h-full max-w-full select-none object-contain will-change-transform"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                  transition: panRef.current.active || pinchRef.current.active ? "none" : "transform 0.2s ease-out",
                }}
                onDoubleClick={onDoubleClick}
              />
            </div>
          )}
        </div>
      </div>

      {hasMultiple && scale <= 1 && (
        <div className="flex shrink-0 items-center justify-center gap-2 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Фото ${i + 1}`}
              onClick={() => goTo(i)}
              className={[
                "h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-5 bg-white" : "w-1.5 bg-white/45",
              ].join(" ")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
