import { Link } from "react-router-dom";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

export default function LegalConsentCheckbox({ checked, onChange, error }: Props) {
  return (
    <div className="space-y-1">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-ink accent-ink"
        />
        <span className="text-sm leading-snug text-ink">
          Я ознакомлен(а) с{" "}
          <Link to="/offer" className="font-medium underline underline-offset-2">
            Публичной офертой
          </Link>
          ,{" "}
          <Link to="/privacy" className="font-medium underline underline-offset-2">
            Политикой конфиденциальности
          </Link>{" "}
          и даю согласие на{" "}
          <Link
            to="/personal-data-consent"
            className="font-medium underline underline-offset-2"
          >
            обработку персональных данных
          </Link>
          .
        </span>
      </label>
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </div>
  );
}
