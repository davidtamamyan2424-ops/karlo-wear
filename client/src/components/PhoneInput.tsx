import { useRef, type ClipboardEvent, type FocusEvent, type KeyboardEvent } from "react";
import { formatRuPhoneDisplay, parseRuPhoneDigits } from "../lib/phone";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  label: string;
}

export default function PhoneInput({
  value,
  onChange,
  placeholder,
  className = "",
  error,
  label,
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const applyFormatted = (raw: string) => {
    onChange(formatRuPhoneDisplay(raw));
  };

  const handleChange = (next: string) => {
    const digits = parseRuPhoneDigits(next);
    if (digits.length <= 1) {
      onChange("+7");
      return;
    }
    applyFormatted(next);
  };

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    if (!value || value === "+7") {
      onChange("+7");
      window.setTimeout(() => {
        const el = e.target;
        el.setSelectionRange(el.value.length, el.value.length);
      }, 0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Backspace") return;
    const digits = parseRuPhoneDigits(value);
    if (digits.length <= 1) {
      e.preventDefault();
      onChange("+7");
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    applyFormatted(pasted);
  };

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        ref={inputRef}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        className={className}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
