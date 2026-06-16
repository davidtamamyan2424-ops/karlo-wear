import { useCallback, useRef, type PointerEvent, type TouchEvent } from "react";

const TAP_THRESHOLD = 10;

type GestureState = {
  active: boolean;
  startX: number;
  startY: number;
  maxDx: number;
  maxDy: number;
  scrolling: boolean;
};

function createGestureState(): GestureState {
  return {
    active: false,
    startX: 0,
    startY: 0,
    maxDx: 0,
    maxDy: 0,
    scrolling: false,
  };
}

/** Returns true when movement looks like vertical page scroll, not an intentional tap. */
export function isScrollGesture(maxDx: number, maxDy: number): boolean {
  if (maxDx < TAP_THRESHOLD && maxDy < TAP_THRESHOLD) return false;
  return maxDy >= maxDx;
}

/** Returns true for a short, mostly stationary touch suitable for tap/click. */
export function isIntentionalTap(maxDx: number, maxDy: number, scrolling: boolean): boolean {
  return !scrolling && maxDx < TAP_THRESHOLD && maxDy < TAP_THRESHOLD;
}

/** Touch/pointer handlers that fire onTap only for deliberate taps, not scrolls. */
export function useIntentionalTap(onTap?: () => void) {
  const gesture = useRef<GestureState>(createGestureState());
  const suppressClick = useRef(false);

  const finish = useCallback(() => {
    const g = gesture.current;
    if (g.active && isIntentionalTap(g.maxDx, g.maxDy, g.scrolling)) {
      onTap?.();
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 400);
    }
    gesture.current = createGestureState();
  }, [onTap]);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1) {
      gesture.current = createGestureState();
      return;
    }
    const touch = e.touches[0];
    gesture.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      maxDx: 0,
      maxDy: 0,
      scrolling: false,
    };
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const g = gesture.current;
    if (!g.active || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - g.startX);
    const dy = Math.abs(touch.clientY - g.startY);
    g.maxDx = Math.max(g.maxDx, dx);
    g.maxDy = Math.max(g.maxDy, dy);
    if (isScrollGesture(g.maxDx, g.maxDy)) {
      g.scrolling = true;
    }
  }, []);

  const onTouchEnd = useCallback(() => finish(), [finish]);
  const onTouchCancel = useCallback(() => {
    gesture.current = createGestureState();
  }, []);

  const onPointerDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    gesture.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      maxDx: 0,
      maxDy: 0,
      scrolling: false,
    };
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const g = gesture.current;
    if (!g.active) return;
    const dx = Math.abs(e.clientX - g.startX);
    const dy = Math.abs(e.clientY - g.startY);
    g.maxDx = Math.max(g.maxDx, dx);
    g.maxDy = Math.max(g.maxDy, dy);
    if (isScrollGesture(g.maxDx, g.maxDy)) {
      g.scrolling = true;
    }
  }, []);

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      finish();
    },
    [finish],
  );

  const onClick = useCallback(() => {
    if (suppressClick.current) return;
    onTap?.();
  }, [onTap]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onClick,
  };
}
