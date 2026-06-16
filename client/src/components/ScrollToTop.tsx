import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Сбрасывает прокрутку при смене маршрута. */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return null;
}
