import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
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

function touchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

export default function FullscreenImageViewer({ images, initialIndex, alt, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef({ active: false, startDist: 0, startScale: 1 });
  const panRef = useRef({ active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
  const swipeRef = useRef({ active: false, startX: 0, startY: 0, decided: false, horizontal: false });
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetZoom();
    setDragDx(0);
    setDragging(false);
  }, [index, resetZoom]);

  const width = () => containerRef.current?.offsetWidth ?? 1;

  const goTo = (next: number) => {
    if (next < 0 || next >= images.length) return;
    setIndex(next);
  };

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

  const onTouchStart = (e: ReactTouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        active: true,
        startDist: touchDistance(e.touches[0], e.touches[1]),
        startScale: scale,
      };
      swipeRef.current.active = false;
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
      return;
    }

    swipeRef.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      decided: false,
      horizontal: false,
    };
  };

  const onTouchMove = (e: ReactTouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current.active) {
      const dist = touchDistance(e.touches[0], e.touches[1]);
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (dist / pinchRef.current.startDist) * pinchRef.current.startScale));
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
      s.horizontal = Math.abs(dx) > Math.abs(dy);
      if (s.horizontal) setDragging(true);
    }

    if (s.horizontal) {
      let resisted = dx;
      if ((index === 0 && dx > 0) || (index === images.length - 1 && dx < 0)) {
        resisted = dx * 0.35;
      }
      setDragDx(resisted);
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

      if (s.horizontal) {
        if (dx <= -threshold) goTo(Math.min(index + 1, images.length - 1));
        else if (dx >= threshold) goTo(Math.max(index - 1, 0));
        setDragDx(0);
        setDragging(false);
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

      swipeRef.current.active = false;
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    toggleDoubleTapZoom(e.clientX, e.clientY);
  };

  const src = images[index];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)]">
        <button
          type="button"
          onClick={onClose}
          className="press rounded-full px-3 py-2 text-sm font-medium text-white/90"
        >
          {ru.product.close}
        </button>
        {images.length > 1 && (
          <span className="text-sm font-medium text-white/70">
            {index + 1} / {images.length}
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden touch-none"
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
              <div key={i} className="flex h-full w-full shrink-0 items-center justify-center p-2">
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
          <div className="flex h-full w-full items-center justify-center p-2">
            <img
              src={src}
              alt={`${alt} — фото ${index + 1}`}
              draggable={false}
              className="max-h-full max-w-full select-none object-contain will-change-transform"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transition: dragging || panRef.current.active || pinchRef.current.active ? "none" : "transform 0.2s ease-out",
              }}
              onDoubleClick={onDoubleClick}
            />
          </div>
        )}
      </div>

      {images.length > 1 && scale <= 1 && (
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
