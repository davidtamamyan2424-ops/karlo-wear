import { hapticSelection } from "../telegram/webapp";
import { ru } from "../i18n/ru";
import {
  PICKUP_POINT_TYPES,
  PICKUP_POINT_TYPE_LABELS,
  type PickupPointType,
} from "../constants";

interface Props {
  value: PickupPointType | "";
  onChange: (type: PickupPointType) => void;
  address: string;
  onAddressChange: (value: string) => void;
  customMethod: string;
  onCustomMethodChange: (value: string) => void;
  errors: Record<string, string>;
  inputClass: string;
}

function PickupHelperText() {
  const lines = ru.checkout.delivery.pickupHelperLines;
  return (
    <div className="rounded-button bg-paper px-3.5 py-3 text-xs leading-relaxed text-muted ring-1 ring-inset ring-line">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

export default function PickupPointSection({
  value,
  onChange,
  address,
  onAddressChange,
  customMethod,
  onCustomMethodChange,
  errors,
  inputClass,
}: Props) {
  const d = ru.checkout.delivery;

  return (
    <section className="space-y-3 rounded-card bg-paper p-4 ring-1 ring-inset ring-line">
      <h3 className="text-sm font-semibold text-ink">{d.pickupPointTitle}</h3>

      <div className="space-y-2">
        {PICKUP_POINT_TYPES.map((type) => {
          const active = value === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                hapticSelection();
                onChange(type);
              }}
              className={[
                "press w-full rounded-button px-4 py-3 text-left text-sm font-semibold transition",
                active
                  ? "bg-ink text-white shadow-soft"
                  : "bg-surface text-ink ring-1 ring-inset ring-line",
              ].join(" ")}
            >
              {PICKUP_POINT_TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>
      {errors.pickupPointType && (
        <span className="block text-xs text-red-600">{errors.pickupPointType}</span>
      )}

      {value === "WILDBERRIES" && (
        <div className="space-y-3 pt-1">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">{d.wildberriesAddress}</span>
            <textarea
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder={d.wildberriesAddressPlaceholder}
              rows={3}
              className="w-full resize-none rounded-button bg-surface px-4 py-3 text-sm text-ink outline-none ring-1 ring-inset ring-transparent transition focus:bg-paper focus:ring-ink/20"
            />
            {errors.deliveryAddress && (
              <span className="mt-1 block text-xs text-red-600">{errors.deliveryAddress}</span>
            )}
          </label>
          <PickupHelperText />
        </div>
      )}

      {value === "OZON" && (
        <div className="space-y-3 pt-1">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">{d.ozonAddress}</span>
            <textarea
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder={d.ozonAddressPlaceholder}
              rows={3}
              className="w-full resize-none rounded-button bg-surface px-4 py-3 text-sm text-ink outline-none ring-1 ring-inset ring-transparent transition focus:bg-paper focus:ring-ink/20"
            />
            {errors.deliveryAddress && (
              <span className="mt-1 block text-xs text-red-600">{errors.deliveryAddress}</span>
            )}
          </label>
          <PickupHelperText />
        </div>
      )}

      {value === "CUSTOM" && (
        <div className="space-y-3 pt-1">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">{d.customMethod}</span>
            <input
              type="text"
              value={customMethod}
              onChange={(e) => onCustomMethodChange(e.target.value)}
              placeholder={d.customMethodPlaceholder}
              className={inputClass}
            />
            {errors.customDeliveryMethod && (
              <span className="mt-1 block text-xs text-red-600">{errors.customDeliveryMethod}</span>
            )}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">{d.customAddress}</span>
            <textarea
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder={d.customAddressPlaceholder}
              rows={3}
              className="w-full resize-none rounded-button bg-surface px-4 py-3 text-sm text-ink outline-none ring-1 ring-inset ring-transparent transition focus:bg-paper focus:ring-ink/20"
            />
            {errors.deliveryAddress && (
              <span className="mt-1 block text-xs text-red-600">{errors.deliveryAddress}</span>
            )}
          </label>
          <PickupHelperText />
        </div>
      )}
    </section>
  );
}
