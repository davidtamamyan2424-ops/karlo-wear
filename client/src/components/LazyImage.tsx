import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  alt: string;
  className?: string;
  /** Загрузить сразу, без ожидания появления в viewport. */
  eager?: boolean;
  /** Отступ вокруг viewport для ранней подгрузки (px или %). */
  rootMargin?: string;
  draggable?: boolean;
  decoding?: "async" | "auto" | "sync";
}

/**
 * Ставит src только когда элемент рядом с viewport (IntersectionObserver).
 * Вне зоны видимости сеть не нагружается.
 */
export default function LazyImage({
  src,
  alt,
  className = "",
  eager = false,
  rootMargin = "200px 0px",
  draggable = false,
  decoding = "async",
}: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const [activeSrc, setActiveSrc] = useState<string | undefined>(eager ? src : undefined);

  useEffect(() => {
    if (eager) {
      setActiveSrc(src);
      return;
    }

    setActiveSrc(undefined);
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setActiveSrc(src);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActiveSrc(src);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [src, eager, rootMargin]);

  return (
    <img
      ref={ref}
      src={activeSrc}
      alt={alt}
      draggable={draggable}
      decoding={decoding}
      loading={eager ? "eager" : "lazy"}
      className={className}
    />
  );
}
