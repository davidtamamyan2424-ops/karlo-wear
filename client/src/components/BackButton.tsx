import { useNavigate } from "react-router-dom";
import { ru } from "../i18n/ru";

interface Props {
  className?: string;
}

export default function BackButton({ className = "" }: Props) {
  const navigate = useNavigate();

  const handleBack = () => {
    const idx = window.history.state?.idx;
    if (typeof idx === "number" && idx > 0) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={ru.common.back}
      className={`press inline-flex items-center gap-1.5 text-sm font-medium text-ink ${className}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {ru.common.back}
    </button>
  );
}
