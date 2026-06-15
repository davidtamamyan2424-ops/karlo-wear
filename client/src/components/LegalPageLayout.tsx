import { Link } from "react-router-dom";
import { LEGAL } from "../constants/legal";
import { ru } from "../i18n/ru";

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function LegalPageLayout({ title, children }: Props) {
  return (
    <article className="animate-fade-in pb-8">
      <Link
        to="/"
        className="press mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted"
      >
        ← {ru.common.back}
      </Link>

      <header className="mb-6 border-b border-line pb-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">{LEGAL.brand}</p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink">{title}</h1>
      </header>

      <div className="legal-prose space-y-4 text-sm leading-relaxed text-ink/90">{children}</div>

      <footer className="mt-8 rounded-card bg-surface p-4 text-xs text-muted">
        <p className="font-medium text-ink">{LEGAL.seller}</p>
        <p>{LEGAL.sellerStatus}</p>
        <p className="mt-2">{LEGAL.city}</p>
        <p className="mt-2">
          <a href={`mailto:${LEGAL.email}`} className="text-ink underline underline-offset-2">
            {LEGAL.email}
          </a>
        </p>
        <p>
          <a href={`tel:${LEGAL.phoneTel}`} className="text-ink underline underline-offset-2">
            {LEGAL.phone}
          </a>
        </p>
      </footer>
    </article>
  );
}
