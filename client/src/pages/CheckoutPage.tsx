import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ru } from "../i18n/ru";
import { formatPrice } from "../lib/format";
import { isCompleteRuPhone, normalizeRuPhone } from "../lib/phone";
import { useCart } from "../cart/CartContext";
import { createOrder } from "../api/endpoints";
import { getTelegramUser, hapticSelection } from "../telegram/webapp";
import { ApiError } from "../api/client";
import PhoneInput from "../components/PhoneInput";
import {
  DELIVERY_METHODS,
  DELIVERY_METHOD_LABELS,
  type DeliveryMethod,
} from "../constants";

export default function CheckoutPage() {
  const { items, total, clear } = useCart();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+7");
  const [telegram, setTelegram] = useState("");
  const [telegramReadOnly, setTelegramReadOnly] = useState(false);
  const [city, setCity] = useState("");
  const [comment, setComment] = useState("");

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | "">("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupNumber, setPickupNumber] = useState("");
  const [otherText, setOtherText] = useState("");
  const [deliveryAck, setDeliveryAck] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const tgUser = getTelegramUser();
    if (tgUser?.username) {
      setTelegram(`@${tgUser.username}`);
      setTelegramReadOnly(true);
    }
  }, []);

  useEffect(() => {
    if (items.length === 0) navigate("/cart", { replace: true });
  }, [items.length, navigate]);

  const isPickup = deliveryMethod === "WILDBERRIES" || deliveryMethod === "OZON";

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = ru.validation.nameRequired;
    if (!isCompleteRuPhone(phone)) next.phone = ru.validation.phoneRequired;
    const username = telegram.trim().replace(/^@/, "");
    if (!username) next.telegram = ru.validation.telegramRequired;
    if (!city.trim()) next.city = ru.validation.cityRequired;
    if (!deliveryMethod) {
      next.deliveryMethod = ru.validation.deliveryMethodRequired;
    } else if (isPickup) {
      if (!pickupAddress.trim()) next.deliveryAddress = ru.validation.deliveryAddressRequired;
    } else if (deliveryMethod === "OTHER") {
      if (!otherText.trim()) next.deliveryComment = ru.validation.deliveryOtherRequired;
    }
    if (!deliveryAck) next.deliveryAck = ru.validation.deliveryNotConfirmed;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate() || !deliveryMethod) return;

    const normalizedPhone = normalizeRuPhone(phone);
    const username = telegram.trim().replace(/^@/, "");
    if (!normalizedPhone || !username) return;

    setSubmitting(true);
    try {
      const tgUser = getTelegramUser();
      const deliveryAddress = isPickup ? pickupAddress.trim() : null;
      const deliveryComment = isPickup
        ? pickupNumber.trim() || null
        : otherText.trim() || null;

      const order = await createOrder({
        customerName: name.trim(),
        phone: normalizedPhone,
        city: city.trim(),
        comment: comment.trim() || null,
        telegramUser: username,
        telegramId: tgUser?.id ?? null,
        deliveryMethod,
        deliveryAddress,
        deliveryComment,
        deliveryConfirmed: deliveryAck,
        items: items.map((i) => ({
          productId: i.productId,
          sizeLabel: i.size,
          quantity: i.quantity,
        })),
      });
      clear();
      navigate(`/order/${order.id}`, { replace: true });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : ru.checkout.error);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-button bg-surface px-4 py-3 text-sm text-ink outline-none ring-1 ring-inset ring-transparent transition focus:bg-paper focus:ring-ink/20";

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    errorKey?: string,
    type = "text",
    readOnly = false,
  ) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass}${readOnly ? " cursor-default bg-paper text-muted" : ""}`}
      />
      {errorKey && errors[errorKey] && (
        <span className="mt-1 block text-xs text-red-600">{errors[errorKey]}</span>
      )}
    </label>
  );

  const d = ru.checkout.delivery;

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in space-y-4">
      <h1 className="px-1 text-[26px] font-semibold tracking-tight text-ink">
        {ru.checkout.title}
      </h1>

      {field(ru.checkout.name, name, setName, ru.checkout.namePlaceholder, "name")}
      <PhoneInput
        label={ru.checkout.phone}
        value={phone}
        onChange={setPhone}
        placeholder={ru.checkout.phonePlaceholder}
        className={inputClass}
        error={errors.phone}
      />
      {field(
        ru.checkout.telegram,
        telegram,
        setTelegram,
        ru.checkout.telegramPlaceholder,
        "telegram",
        "text",
        telegramReadOnly,
      )}
      {field(ru.checkout.city, city, setCity, ru.checkout.cityPlaceholder, "city")}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">{ru.checkout.comment}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={ru.checkout.commentPlaceholder}
          rows={3}
          className="w-full resize-none rounded-button bg-surface px-4 py-3 text-sm text-ink outline-none ring-1 ring-inset ring-transparent transition focus:bg-paper focus:ring-ink/20"
        />
      </label>

      {/* Доставка */}
      <section className="space-y-3 rounded-card bg-surface p-4">
        <h2 className="text-base font-semibold text-ink">{d.title}</h2>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink">{d.method}</span>
          <div className="grid grid-cols-3 gap-2">
            {DELIVERY_METHODS.map((m) => {
              const active = deliveryMethod === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    hapticSelection();
                    setDeliveryMethod(m);
                    setErrors((prev) => ({
                      ...prev,
                      deliveryMethod: "",
                      deliveryAddress: "",
                      deliveryComment: "",
                    }));
                  }}
                  className={`press rounded-button px-2 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-ink text-white shadow-soft"
                      : "bg-paper text-ink ring-1 ring-inset ring-line"
                  }`}
                >
                  {DELIVERY_METHOD_LABELS[m]}
                </button>
              );
            })}
          </div>
          {errors.deliveryMethod && (
            <span className="mt-1 block text-xs text-red-600">{errors.deliveryMethod}</span>
          )}
        </div>

        {isPickup && (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">{d.pickupAddress}</span>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder={d.pickupAddressPlaceholder}
                className={inputClass}
              />
              {errors.deliveryAddress && (
                <span className="mt-1 block text-xs text-red-600">{errors.deliveryAddress}</span>
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">{d.pickupNumber}</span>
              <input
                type="text"
                value={pickupNumber}
                onChange={(e) => setPickupNumber(e.target.value)}
                placeholder={d.pickupNumberPlaceholder}
                className={inputClass}
              />
            </label>
          </div>
        )}

        {deliveryMethod === "OTHER" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">{d.otherLabel}</span>
            <textarea
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder={d.otherPlaceholder}
              rows={3}
              className="w-full resize-none rounded-button bg-paper px-4 py-3 text-sm text-ink outline-none ring-1 ring-inset ring-line transition focus:ring-ink/20"
            />
            {errors.deliveryComment && (
              <span className="mt-1 block text-xs text-red-600">{errors.deliveryComment}</span>
            )}
          </label>
        )}
      </section>

      {/* Уведомление о доставке */}
      <section className="space-y-3 rounded-card bg-amber-50 p-4 ring-1 ring-inset ring-amber-200">
        <h2 className="text-sm font-semibold text-amber-900">{d.noticeTitle}</h2>
        <ul className="space-y-1.5 text-sm text-amber-900/90">
          {d.noticeLines.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <label className="flex cursor-pointer items-start gap-2.5 pt-1">
          <input
            type="checkbox"
            checked={deliveryAck}
            onChange={(e) => {
              setDeliveryAck(e.target.checked);
              if (e.target.checked) setErrors((prev) => ({ ...prev, deliveryAck: "" }));
            }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400 text-ink accent-ink"
          />
          <span className="text-sm font-medium text-amber-900">{d.acknowledge}</span>
        </label>
        {errors.deliveryAck && (
          <span className="block text-xs text-red-600">{errors.deliveryAck}</span>
        )}
      </section>

      <div className="rounded-card bg-surface p-4">
        <div className="flex justify-between text-base font-semibold text-ink">
          <span>{ru.cart.total}</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <button
          type="submit"
          disabled={submitting}
          className="press mx-auto block w-full max-w-2xl rounded-button bg-ink py-3.5 text-[15px] font-semibold text-white shadow-soft disabled:opacity-60"
        >
          {submitting ? ru.checkout.submitting : ru.checkout.submit}
        </button>
      </div>

      <div className="h-12" />
    </form>
  );
}
