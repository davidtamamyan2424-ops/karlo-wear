import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { ru } from "../i18n/ru";

interface Props {
  images: string[];
  initialIndex: number;
  alt: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 280;
const SWIPE_THRESHOLD = 0.15;
const DISMISS_THRESHOLD = 110;
const CLOSE_ANIM_MS = 280;

type GestureMode = "none" | "horizontal" | "dismiss";

function touchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

/** Блокирует прокрутку страницы и восстанавливает позицию при закрытии. */
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
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dismissDy, setDismissDy] = useState(0);
  const [dismissAnimating, setDismissAnimating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef({ active: false, startDist: 0, startScale: 1 });
  const panRef = useRef({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
  const swipeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    decided: false,
    mode: "none" as GestureMode,
  });
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const closingRef = useRef(false);

  useScrollLock();

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetZoom();
    setDragDx(0);
    setDragging(false);
    setDismissDy(0);
    setDismissAnimating(false);
  }, [index, resetZoom]);

  const width = () => containerRef.current?.offsetWidth ?? 1;

  const goTo = (next: number) => {
    if (next < 0 || next >= images.length) return;
    setIndex(next);
  };

  const closeAnimated = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setDismissAnimating(true);
    setDismissDy(window.innerHeight * 0.55);
    window.setTimeout(onClose, CLOSE_ANIM_MS);
  }, [onClose]);

  const toggleDoubleTapZoom = (clientX: number, clientY: number) => {
    if (scale > 1) {
      resetZoom();
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      setScale(2);
      return;
    }
    const cx = clientX - rect.left - rect.width / 2;
    const cy = clientY - rect.top - rect.height / 2;
    setScale(2);
    setPan({ x: -cx * 0.5, y: -cy * 0.5 });
  };

  const resetSwipe = () => {
    swipeRef.current = {
      active: false,
      startX: 0,
      startY: 0,
      decided: false,
      mode: "none",
    };
  };

  const onTouchStart = (e: ReactTouchEvent) => {
    if (closingRef.current) return;

    if (e.touches.length === 2) {
      pinchRef.current = {
        active: true,
        startDist: touchDistance(e.touches[0], e.touches[1]),
        startScale: scale,
      };
      resetSwipe();
      panRef.current.active = false;
      return;
    }

    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    if (scale > 1) {
      panRef.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
      resetSwipe();
      return;
    }

    swipeRef.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      decided: false,
      mode: "none",
    };
    setDismissAnimating(false);
  };

  const onTouchMove = (e: ReactTouchEvent) => {
    if (closingRef.current) return;

    if (e.touches.length === 2 && pinchRef.current.active) {
      const dist = touchDistance(e.touches[0], e.touches[1]);
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, (dist / pinchRef.current.startDist) * pinchRef.current.startScale),
      );
      setScale(next);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return;
    }

    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    if (panRef.current.active && scale > 1) {
      const dx = touch.clientX - panRef.current.startX;
      const dy = touch.clientY - panRef.current.startY;
      setPan({
        x: panRef.current.startPanX + dx,
        y: panRef.current.startPanY + dy,
      });
      return;
    }

    const s = swipeRef.current;
    if (!s.active || scale > 1) return;

    const dx = touch.clientX - s.startX;
    const dy = touch.clientY - s.startY;

    if (!s.decided) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      s.decided = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        s.mode = "horizontal";
        setDragging(true);
      } else if (dy > 0) {
        s.mode = "dismiss";
      } else {
        s.mode = "none";
      }
    }

    if (s.mode === "horizontal") {
      let resisted = dx;
      if ((index === 0 && dx > 0) || (index === images.length - 1 && dx < 0)) {
        resisted = dx * 0.35;
      }
      setDragDx(resisted);
      return;
    }

    if (s.mode === "dismiss") {
      setDismissDy(Math.max(0, dy));
    }
  };

  const onTouchEnd = (e: ReactTouchEvent) => {
    if (pinchRef.current.active && e.touches.length < 2) {
      pinchRef.current.active = false;
      if (scale < 1.05) resetZoom();
    }

    if (panRef.current.active && e.changedTouches.length === 1) {
      panRef.current.active = false;
    }

    const s = swipeRef.current;
    if (s.active && scale <= 1 && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - s.startX;
      const dy = touch.clientY - s.startY;
      const threshold = width() * SWIPE_THRESHOLD;

      if (s.mode === "horizontal") {
        if (dx <= -threshold) goTo(Math.min(index + 1, images.length - 1));
        else if (dx >= threshold) goTo(Math.max(index - 1, 0));
        setDragDx(0);
        setDragging(false);
      } else if (s.mode === "dismiss") {
        if (dy >= DISMISS_THRESHOLD) {
          closeAnimated();
        } else {
          setDismissAnimating(true);
          setDismissDy(0);
          window.setTimeout(() => setDismissAnimating(false), CLOSE_ANIM_MS);
        }
      } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        const now = Date.now();
        const last = lastTapRef.current;
        const near =
          Math.abs(touch.clientX - last.x) < 24 && Math.abs(touch.clientY - last.y) < 24;
        if (near && now - last.time < DOUBLE_TAP_MS) {
          toggleDoubleTapZoom(touch.clientX, touch.clientY);
          lastTapRef.current = { time: 0, x: 0, y: 0 };
        } else {
          lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
        }
      }

      resetSwipe();
    }
  };

  const onContentClick = (e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("img") || target.closest("button")) return;
    if (window.matchMedia("(pointer: fine)").matches) onClose();
  };

  const onDoubleClick = (e: ReactMouseEvent) => {
    toggleDoubleTapZoom(e.clientX, e.clientY);
  };

  const backdropOpacity = Math.max(0.15, 1 - dismissDy / 420);
  const contentScale = Math.max(0.88, 1 - dismissDy / 900);
  const src = images[index];

  const contentTransition =
    dismissAnimating || (!dragging && dismissDy === 0)
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
        onClick={(e) => {
          e.stopPropagation();
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

      {images.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-[max(env(safe-area-inset-top),16px)] z-[55] flex justify-center">
          <span className="rounded-full bg-black/40 px-3 py-1 text-sm font-medium text-white/85 backdrop-blur-sm">
            {index + 1} / {images.length}
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        className="relative mt-14 min-h-0 flex-1 touch-none"
        style={{
          transform: scale <= 1 ? `translateY(${dismissDy}px) scale(${contentScale})` : undefined,
          opacity: scale <= 1 ? Math.max(0.35, 1 - dismissDy / 500) : 1,
          transition: scale <= 1 ? contentTransition : "none",
        }}
        onClick={onContentClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {scale <= 1 && images.length > 1 ? (
          <div
            className="flex h-full w-full"
            style={{
              transform: `translateX(calc(${-index * 100}% + ${dragDx}px))`,
              transition: dragging ? "none" : "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
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
                transition:
                  dragging || panRef.current.active || pinchRef.current.active
                    ? "none"
                    : "transform 0.2s ease-out",
              }}
              onDoubleClick={onDoubleClick}
            />
          </div>
        )}
      </div>

      {images.length > 1 && scale <= 1 && (
        <div
          className="flex shrink-0 items-center justify-center gap-2 pb-[max(env(safe-area-inset-bottom),16px)] pt-3"
        >
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
