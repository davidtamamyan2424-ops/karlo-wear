import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ru } from "../i18n/ru";
import { isCompleteRuPhone, normalizeRuPhone } from "../lib/phone";
import { useCart } from "../cart/CartContext";
import { createOrder } from "../api/endpoints";
import { getTelegramUser, hapticSelection } from "../telegram/webapp";
import { ApiError } from "../api/client";
import PhoneInput from "../components/PhoneInput";
import LegalConsentCheckbox from "../components/LegalConsentCheckbox";
import CartPriceSummary from "../components/CartPriceSummary";
import { CartPromoBlocks } from "../components/CartPromoBlocks";
import {
  DELIVERY_METHODS,
  DELIVERY_METHOD_LABELS,
  type DeliveryMethod,
} from "../constants";
import { calcDeliveryFee } from "../lib/delivery";

export default function CheckoutPage() {
  const { items, pricing, clear } = useCart();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+7");
  const [telegram, setTelegram] = useState("");
  const [telegramReadOnly, setTelegramReadOnly] = useState(false);
  const [city, setCity] = useState("");
  const [comment, setComment] = useState("");

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | "">("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryAck, setDeliveryAck] = useState(false);
  const [legalConsent, setLegalConsent] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const deliveryFee = useMemo(
    () => (deliveryMethod ? calcDeliveryFee(deliveryMethod, pricing) : undefined),
    [deliveryMethod, pricing],
  );

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

  const needsAddress =
    deliveryMethod === "MOSCOW" || deliveryMethod === "MOSCOW_REGION";

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = ru.validation.nameRequired;
    if (!isCompleteRuPhone(phone)) next.phone = ru.validation.phoneRequired;
    const username = telegram.trim().replace(/^@/, "");
    if (!username) next.telegram = ru.validation.telegramRequired;
    if (!city.trim()) next.city = ru.validation.cityRequired;
    if (!deliveryMethod) {
      next.deliveryMethod = ru.validation.deliveryMethodRequired;
    } else if (needsAddress && !deliveryAddress.trim()) {
      next.deliveryAddress = ru.validation.deliveryAddressRequired;
    }
    if (!deliveryAck) next.deliveryAck = ru.validation.deliveryNotConfirmed;
    if (!legalConsent) next.legal = ru.validation.legalNotConfirmed;
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

      const order = await createOrder({
        customerName: name.trim(),
        phone: normalizedPhone,
        city: city.trim(),
        comment: comment.trim() || null,
        telegramUser: username,
        telegramId: tgUser?.id ?? null,
        deliveryMethod,
        deliveryAddress: needsAddress ? deliveryAddress.trim() : null,
        deliveryComment: null,
        deliveryConfirmed: deliveryAck,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
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

  const deliveryPriceLabel = (method: DeliveryMethod): string => {
    if (method === "PICKUP") return d.optionPrices.PICKUP;
    if (method === "OTHER_REGIONS") return d.optionPrices.OTHER_REGIONS;
    const fee = calcDeliveryFee(method, pricing);
    if (fee === 0) return ru.cart.deliveryFree;
    return d.optionPrices[method];
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in space-y-4 pb-28">
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

      <section className="space-y-3 rounded-card bg-surface p-4">
        <h2 className="text-base font-semibold text-ink">{d.title}</h2>
        <p className="text-sm text-muted">{d.method}</p>

        <div className="space-y-2">
          {DELIVERY_METHODS.map((method) => {
            const active = deliveryMethod === method;
            return (
              <button
                key={method}
                type="button"
                onClick={() => {
                  hapticSelection();
                  setDeliveryMethod(method);
                  setErrors((prev) => ({
                    ...prev,
                    deliveryMethod: "",
                    deliveryAddress: "",
                  }));
                }}
                className={[
                  "press w-full rounded-button px-4 py-3 text-left transition",
                  active
                    ? "bg-ink text-white shadow-soft"
                    : "bg-paper text-ink ring-1 ring-inset ring-line",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold">{DELIVERY_METHOD_LABELS[method]}</span>
                  <span className={`shrink-0 text-sm font-medium ${active ? "text-white/90" : "text-muted"}`}>
                    {deliveryPriceLabel(method)}
                  </span>
                </div>
                <p className={`mt-1 text-sm leading-relaxed ${active ? "text-white/75" : "text-muted"}`}>
                  {d.optionDescriptions[method]}
                </p>
              </button>
            );
          })}
        </div>
        {errors.deliveryMethod && (
          <span className="block text-xs text-red-600">{errors.deliveryMethod}</span>
        )}

        {needsAddress && (
          <label className="block pt-1">
            <span className="mb-1.5 block text-sm font-medium text-ink">{d.address}</span>
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder={d.addressPlaceholder}
              className={inputClass}
            />
            {errors.deliveryAddress && (
              <span className="mt-1 block text-xs text-red-600">{errors.deliveryAddress}</span>
            )}
          </label>
        )}
      </section>

      <section className="space-y-3 rounded-card bg-paper p-4 ring-1 ring-inset ring-line">
        <h2 className="text-sm font-semibold text-ink">{d.noticeTitle}</h2>
        <ul className="space-y-1.5 text-sm text-muted">
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
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-ink accent-ink"
          />
          <span className="text-sm font-medium text-ink">{d.acknowledge}</span>
        </label>
        {errors.deliveryAck && (
          <span className="block text-xs text-red-600">{errors.deliveryAck}</span>
        )}
      </section>

      <section className="rounded-card bg-surface p-4">
        <LegalConsentCheckbox
          checked={legalConsent}
          onChange={(checked) => {
            setLegalConsent(checked);
            if (checked) setErrors((prev) => ({ ...prev, legal: "" }));
          }}
          error={errors.legal}
        />
      </section>

      <CartPromoBlocks pricing={pricing} />

      <CartPriceSummary
        pricing={pricing}
        deliveryFee={deliveryFee}
        showGrandTotal={Boolean(deliveryMethod)}
      />

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <button
          type="submit"
          disabled={submitting || !legalConsent}
          className="press mx-auto block w-full max-w-2xl rounded-button bg-ink py-3.5 text-[15px] font-semibold text-white shadow-soft disabled:opacity-60"
        >
          {submitting ? ru.checkout.submitting : ru.checkout.submit}
        </button>
      </div>
    </form>
  );
}
