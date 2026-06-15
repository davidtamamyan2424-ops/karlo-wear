import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

interface ImageGalleryProps {
  images: string[];
  alt: string;
  /** Вызывается при чистом тапе (без свайпа) — например, для перехода на страницу товара. */
  onTap?: () => void;
  /** Соотношение сторон контейнера, напр. "4/5" или "3/4". */
  aspect?: string;
  className?: string;
  rounded?: string;
  /** Загружать первое изображение приоритетно. */
  eagerFirst?: boolean;
}

const TAP_THRESHOLD = 8; // px — меньше считается тапом
const SWIPE_THRESHOLD = 0.18; // доля ширины для смены кадра

export default function ImageGallery({
  images,
  alt,
  onTap,
  aspect = "4/5",
  className = "",
  rounded = "rounded-card",
  eagerFirst = false,
}: ImageGalleryProps) {
  const list = images.length > 0 ? images : [""];
  const containerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  const drag = useRef({
    active: false,
    decided: false,
    horizontal: false,
    startX: 0,
    startY: 0,
    pointerId: -1,
    moved: 0,
  });

  // Предзагрузка следующего изображения
  useEffect(() => {
    const next = list[index + 1];
    if (next) {
      const img = new Image();
      img.src = next;
    }
  }, [index, list]);

  const width = () => containerRef.current?.offsetWidth ?? 1;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = {
      active: true,
      decided: false,
      horizontal: false,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      moved: 0,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    d.moved = Math.max(d.moved, Math.abs(dx));

    if (!d.decided) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      d.decided = true;
      d.horizontal = Math.abs(dx) > Math.abs(dy);
      if (d.horizontal) {
        setDragging(true);
        try {
          containerRef.current?.setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      }
    }

    if (d.horizontal) {
      // сопротивление на краях
      let resisted = dx;
      if ((index === 0 && dx > 0) || (index === list.length - 1 && dx < 0)) {
        resisted = dx * 0.35;
      }
      setDragDx(resisted);
    }
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;

    if (d.horizontal) {
      const dx = e.clientX - d.startX;
      const threshold = width() * SWIPE_THRESHOLD;
      let nextIndex = index;
      if (dx <= -threshold) nextIndex = Math.min(index + 1, list.length - 1);
      else if (dx >= threshold) nextIndex = Math.max(index - 1, 0);
      setIndex(nextIndex);
      setDragDx(0);
      setDragging(false);
      try {
        containerRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    } else if (d.moved < TAP_THRESHOLD) {
      onTap?.();
    }
  };

  const goTo = (i: number, e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIndex(i);
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-surface ${rounded} ${className}`}
      style={{ aspectRatio: aspect, touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="flex h-full w-full"
        style={{
          transform: `translateX(calc(${-index * 100}% + ${dragDx}px))`,
          transition: dragging ? "none" : "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {list.map((src, i) => (
          <div key={i} className="h-full w-full shrink-0">
            {src ? (
              <img
                src={src}
                alt={`${alt} — фото ${i + 1}`}
                draggable={false}
                loading={eagerFirst && i === 0 ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full select-none object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted">
                {alt}
              </div>
            )}
          </div>
        ))}
      </div>

      {list.length > 1 && (
        <>
          {/* Счётчик позиции */}
          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {index + 1} / {list.length}
          </div>

          {/* Точки-индикаторы */}
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
            {list.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Фото ${i + 1}`}
                onClick={(e) => goTo(i, e)}
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
