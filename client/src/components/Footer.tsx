import { Link } from "react-router-dom";
import { ru } from "../i18n/ru";
import { LEGAL } from "../constants/legal";

export default function Footer() {
  return (
    <footer className="border-t border-line/70 bg-paper px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">{LEGAL.brand}</p>
        <nav className="flex flex-col gap-2 text-sm">
          <Link to="/offer" className="press text-muted transition hover:text-ink">
            {ru.legal.offerLink}
          </Link>
          <Link to="/privacy" className="press text-muted transition hover:text-ink">
            {ru.legal.privacyLink}
          </Link>
          <Link
            to="/personal-data-consent"
            className="press text-muted transition hover:text-ink"
          >
            {ru.legal.consentLink}
          </Link>
        </nav>
        <p className="text-xs text-muted">© {new Date().getFullYear()} {LEGAL.brand}</p>
      </div>
    </footer>
  );
}
