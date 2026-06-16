import { useCallback, useEffect, useRef, useState } from "react";

/** Доля ширины контейнера — минимальный свайп для смены кадра. */
export const SWIPE_THRESHOLD_RATIO = 0.2;
const AXIS_LOCK_PX = 8;
const HORIZONTAL_BIAS = 1.15;

export type CarouselAxis = "pending" | "horizontal" | "vertical";

export type CarouselGesture = {
  active: boolean;
  pointerId: number;
  decided: boolean;
  horizontal: boolean;
  verticalScroll: boolean;
  startX: number;
  startY: number;
  maxDx: number;
  maxDy: number;
};

export function createCarouselGesture(): CarouselGesture {
  return {
    active: false,
    pointerId: -1,
    decided: false,
    horizontal: false,
    verticalScroll: false,
    startX: 0,
    startY: 0,
    maxDx: 0,
    maxDy: 0,
  };
}

/** Определяет ось жеста; диагональ ждёт более явного направления. */
export function resolveCarouselAxis(g: CarouselGesture): CarouselAxis {
  if (g.maxDx < AXIS_LOCK_PX && g.maxDy < AXIS_LOCK_PX) return "pending";
  if (g.maxDx > g.maxDy * HORIZONTAL_BIAS) return "horizontal";
  if (g.maxDy > g.maxDx * HORIZONTAL_BIAS) return "vertical";
  return "pending";
}

/** Смещение на ровно один кадр по порогу; без прыжков через несколько. */
export function resolveSwipeIndex(
  current: number,
  dx: number,
  width: number,
  count: number,
): number {
  if (count <= 1 || width <= 0) return current;
  const threshold = width * SWIPE_THRESHOLD_RATIO;
  if (dx <= -threshold) return Math.min(current + 1, count - 1);
  if (dx >= threshold) return Math.max(current - 1, 0);
  return current;
}

export function resistedHorizontalOffset(
  dx: number,
  index: number,
  count: number,
): number {
  if (index === 0 && dx > 0) return dx * 0.35;
  if (index === count - 1 && dx < 0) return dx * 0.35;
  return dx;
}

interface UseImageCarouselOptions {
  slideCount: number;
  initialIndex?: number;
  enabled?: boolean;
}

/**
 * Карусель с translate3d через ref (без setState на каждый touchmove).
 * index в state синхронизирован с indexRef для жестов без stale closure.
 */
export function useImageCarousel({
  slideCount,
  initialIndex = 0,
  enabled = true,
}: UseImageCarouselOptions) {
  const [index, setIndex] = useState(initialIndex);
  const [isDragging, setIsDragging] = useState(false);

  const indexRef = useRef(initialIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef(createCarouselGesture());
  const dragDxRef = useRef(0);
  const rafRef = useRef(0);

  const containerWidth = () => containerRef.current?.offsetWidth ?? 1;

  const applyTransform = useCallback((dragOffset: number, animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate
      ? "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)"
      : "none";
    track.style.transform = `translate3d(calc(${-indexRef.current * 100}% + ${dragOffset}px), 0, 0)`;
  }, []);

  const resetTo = useCallback(
    (to = 0) => {
      indexRef.current = to;
      setIndex(to);
      dragDxRef.current = 0;
      setIsDragging(false);
      applyTransform(0, false);
      gestureRef.current = createCarouselGesture();
    },
    [applyTransform],
  );

  useEffect(() => {
    resetTo(initialIndex);
  }, [initialIndex, slideCount, resetTo]);

  useEffect(() => {
    if (!isDragging) {
      applyTransform(0, true);
    }
  }, [index, isDragging, applyTransform]);

  const scheduleTransform = useCallback(
    (dragOffset: number) => {
      dragDxRef.current = dragOffset;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        applyTransform(dragDxRef.current, false);
      });
    },
    [applyTransform],
  );

  const goTo = useCallback(
    (next: number) => {
      if (!enabled || next < 0 || next >= slideCount || next === indexRef.current) return;
      indexRef.current = next;
      setIndex(next);
      dragDxRef.current = 0;
      applyTransform(0, true);
    },
    [applyTransform, enabled, slideCount],
  );

  const onPointerDown = useCallback(
    (clientX: number, clientY: number, pointerId: number) => {
      if (!enabled || slideCount <= 1) return;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      gestureRef.current = {
        active: true,
        pointerId,
        decided: false,
        horizontal: false,
        verticalScroll: false,
        startX: clientX,
        startY: clientY,
        maxDx: 0,
        maxDy: 0,
      };
      dragDxRef.current = 0;
      applyTransform(0, false);
    },
    [applyTransform, enabled, slideCount],
  );

  const onPointerMove = useCallback(
    (clientX: number, clientY: number): CarouselAxis | "idle" => {
      const g = gestureRef.current;
      if (!g.active || !enabled || slideCount <= 1) return "idle";

      const dx = clientX - g.startX;
      const dy = clientY - g.startY;
      g.maxDx = Math.max(g.maxDx, Math.abs(dx));
      g.maxDy = Math.max(g.maxDy, Math.abs(dy));

      if (!g.decided) {
        const axis = resolveCarouselAxis(g);
        if (axis === "pending") return "pending";
        g.decided = true;
        if (axis === "horizontal") {
          g.horizontal = true;
          setIsDragging(true);
        } else {
          g.verticalScroll = true;
          return "vertical";
        }
      }

      if (g.verticalScroll) return "vertical";
      if (!g.horizontal) return "idle";

      scheduleTransform(resistedHorizontalOffset(dx, indexRef.current, slideCount));
      return "horizontal";
    },
    [enabled, scheduleTransform, slideCount],
  );

  const onPointerEnd = useCallback(
    (clientX: number): { index: number; wasHorizontal: boolean } => {
      const g = gestureRef.current;
      const wasHorizontal = g.horizontal;
      if (!g.active) return { index: indexRef.current, wasHorizontal: false };

      const dx = clientX - g.startX;
      const width = containerWidth();
      let next = indexRef.current;

      if (wasHorizontal && enabled && slideCount > 1) {
        next = resolveSwipeIndex(indexRef.current, dx, width, slideCount);
        indexRef.current = next;
        setIndex(next);
      }

      dragDxRef.current = 0;
      setIsDragging(false);
      applyTransform(0, true);
      gestureRef.current = createCarouselGesture();

      return { index: next, wasHorizontal };
    },
    [applyTransform, enabled, slideCount],
  );

  const cancelGesture = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    dragDxRef.current = 0;
    setIsDragging(false);
    applyTransform(0, true);
    gestureRef.current = createCarouselGesture();
  }, [applyTransform]);

  const getGesture = () => gestureRef.current;

  return {
    index,
    indexRef,
    isDragging,
    containerRef,
    trackRef,
    goTo,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    cancelGesture,
    getGesture,
    applyTransform,
    resetTo,
  };
}
