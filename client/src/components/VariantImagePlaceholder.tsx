import { ru } from "../i18n/ru";
import { useIntentionalTap } from "../lib/intentionalTap";

interface Props {
  aspect?: string;
  className?: string;
  rounded?: string;
  onTap?: () => void;
}

export default function VariantImagePlaceholder({
  aspect = "4/5",
  className = "",
  rounded = "rounded-card",
  onTap,
}: Props) {
  const p = ru.product.photoPlaceholder;
  const tapHandlers = useIntentionalTap(onTap);

  const content = (
    <>
      <p className="text-center text-[13px] font-medium leading-snug text-ink/75">{p.title}</p>
      <p className="mt-2 max-w-[200px] whitespace-pre-line text-center text-xs leading-relaxed text-muted">{p.subtitle}</p>
    </>
  );

  const baseClass = `flex flex-col items-center justify-center bg-[#F3F3F3] ${rounded} ${className}`;

  if (onTap) {
    return (
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTap();
          }
        }}
        className={`press w-full cursor-pointer ${baseClass}`}
        style={{ aspectRatio: aspect, touchAction: "pan-y" }}
        {...tapHandlers}
      >
        {content}
      </div>
    );
  }

  return (
    <div className={`w-full ${baseClass}`} style={{ aspectRatio: aspect }}>
      {content}
    </div>
  );
}
