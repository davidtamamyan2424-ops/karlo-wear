import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { isIntentionalTap } from "../lib/intentionalTap";
import { useImageCarousel } from "../lib/imageCarousel";

interface ImageGalleryProps {
  images: string[];
  alt: string;
  /** Намеренный тап — например, переход на страницу товара в каталоге. */
  onTap?: () => void;
  /** Намеренный тап по изображению — открытие полноэкранного просмотра. */
  onImageClick?: (index: number) => void;
  /** Соотношение сторон контейнера, напр. "4/5" или "3/4". */
  aspect?: string;
  className?: string;
  rounded?: string;
  /**
   * progressive (по умолчанию): первое сразу, соседнее — preload,
   * остальные — только после свайпа.
   * cover: только первое изображение (каталог).
   */
  loadMode?: "progressive" | "cover";
}

export default function ImageGallery({
  images,
  alt,
  onTap,
  onImageClick,
  aspect = "4/5",
  className = "",
  rounded = "rounded-card",
  loadMode = "progressive",
}: ImageGalleryProps) {
  const list = useMemo(() => {
    if (images.length === 0) return [""];
    if (loadMode === "cover") return [images[0]];
    return images;
  }, [images, loadMode]);

  const hasMultiple = list.length > 1 && loadMode === "progressive";

  const carousel = useImageCarousel({
    slideCount: list.length,
    initialIndex: 0,
    enabled: hasMultiple,
  });

  const { index, containerRef, trackRef, goTo, isDragging } = carousel;

  /** Индексы, для которых разрешена загрузка (src в DOM). */
  const [allowed, setAllowed] = useState<Set<number>>(() => new Set([0]));

  useEffect(() => {
    carousel.resetTo(0);
    setAllowed(new Set([0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сброс при смене набора фото
  }, [list]);

  useEffect(() => {
    if (loadMode !== "progressive") return;
    setAllowed((prev) => {
      const next = new Set(prev);
      next.add(index);
      // Preload только следующего кадра.
      if (index + 1 < list.length) next.add(index + 1);
      return next;
    });
  }, [index, list.length, loadMode]);

  const tapRef = useRef({
    active: false,
    scrolling: false,
    maxDx: 0,
    maxDy: 0,
  });

  const fireTapIfNeeded = () => {
    const t = tapRef.current;
    if (!isIntentionalTap(t.maxDx, t.maxDy, t.scrolling)) return;
    if (onImageClick) onImageClick(carousel.indexRef.current);
    else onTap?.();
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    tapRef.current = { active: true, scrolling: false, maxDx: 0, maxDy: 0 };

    if (hasMultiple) {
      carousel.onPointerDown(e.clientX, e.clientY, e.pointerId);
      const g = carousel.getGesture();
      if (g.active) {
        try {
          containerRef.current?.setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      }
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = tapRef.current;
    if (t.active) {
      const g = carousel.getGesture();
      if (g.active) {
        const dx = Math.abs(e.clientX - g.startX);
        const dy = Math.abs(e.clientY - g.startY);
        t.maxDx = Math.max(t.maxDx, dx);
        t.maxDy = Math.max(t.maxDy, dy);
      }
    }

    if (!hasMultiple) return;

    const axis = carousel.onPointerMove(e.clientX, e.clientY);
    if (axis === "vertical") {
      tapRef.current.scrolling = true;
    }
    if (axis === "horizontal") {
      tapRef.current.scrolling = false;
      if (containerRef.current) {
        containerRef.current.style.touchAction = "none";
      }
    }
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const wasHorizontal = hasMultiple ? carousel.getGesture().horizontal : false;

    if (hasMultiple) {
      carousel.onPointerEnd(e.clientX);
      if (containerRef.current) {
        containerRef.current.style.touchAction = "pan-y pinch-zoom";
      }
      try {
        containerRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }

    if (!wasHorizontal) {
      fireTapIfNeeded();
    }
    tapRef.current = { active: false, scrolling: false, maxDx: 0, maxDy: 0 };
  };

  const onDotClick = (i: number, e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    goTo(i);
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-surface ${rounded} ${className}`}
      style={{ aspectRatio: aspect, touchAction: "pan-y pinch-zoom" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <div
        ref={trackRef}
        className="flex h-full w-full will-change-transform"
        style={{
          transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {list.map((src, i) => {
          const shouldLoad = Boolean(src) && (loadMode === "cover" || allowed.has(i));
          return (
            <div key={i} className="h-full w-full shrink-0 bg-surface">
              {shouldLoad ? (
                <img
                  src={src}
                  alt={`${alt} — фото ${i + 1}`}
                  draggable={false}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={i === 0 ? "high" : "auto"}
                  className="h-full w-full select-none object-cover"
                />
              ) : src ? (
                <div className="h-full w-full animate-pulse bg-surface" aria-hidden />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted">
                  {alt}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasMultiple && (
        <>
          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {index + 1} / {list.length}
          </div>

          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
            {list.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Фото ${i + 1}`}
                onClick={(e) => onDotClick(i, e)}
                onPointerDown={(e) => e.stopPropagation()}
                className={[
                  "h-1.5 rounded-full transition-all duration-300 ease-premium",
                  i === index ? "w-5 bg-white" : "w-1.5 bg-white/55",
                ].join(" ")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
