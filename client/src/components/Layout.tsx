import { Link, Outlet, useLocation } from "react-router-dom";
import { ru } from "../i18n/ru";
import { useCart } from "../cart/CartContext";
import Footer from "./Footer";

export default function Layout() {
  const { count } = useCart();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3.5">
          <Link
            to="/"
            className="press text-base font-semibold uppercase tracking-[0.18em] text-ink"
          >
            Karlo Wear
          </Link>
          {!isAdmin && (
            <Link
              to="/cart"
              aria-label={ru.nav.cart}
              className="press relative flex h-10 w-10 items-center justify-center rounded-full bg-surface"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {count > 0 && (
                <span
                  key={count}
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 animate-badge-pop items-center justify-center rounded-full bg-ink px-1.5 text-[11px] font-semibold text-white ring-2 ring-paper"
                >
                  {count}
                </span>
              )}
            </Link>
          )}
        </div>
      </header>

      <main
        key={location.pathname}
        className="mx-auto min-h-[calc(100vh-57px)] max-w-2xl animate-fade-in px-4 py-4 pb-28"
      >
        <Outlet />
      </main>

      {!isAdmin && <Footer />}
    </div>
  );
}
