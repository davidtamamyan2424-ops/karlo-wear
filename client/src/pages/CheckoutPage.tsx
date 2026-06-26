import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ru } from "../i18n/ru";
import { isCompleteRuPhone, normalizeRuPhone } from "../lib/phone";
import { useCart } from "../cart/CartContext";
import { createOrder } from "../api/endpoints";
import { getTelegramUser } from "../telegram/webapp";
import { ApiError } from "../api/client";
import PhoneInput from "../components/PhoneInput";
import LegalConsentCheckbox from "../components/LegalConsentCheckbox";
import CartPriceSummary from "../components/CartPriceSummary";
import DeliveryMethodPicker from "../components/DeliveryMethodPicker";
import PickupPointSection from "../components/PickupPointSection";
import { CartPromoBlocks } from "../components/CartPromoBlocks";
import { calcDeliveryFee } from "../lib/delivery";
import type { PickupPointType } from "../constants";

export default function CheckoutPage() {
  const { items, pricing, deliveryMethod, setDeliveryMethod, clear } = useCart();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+7");
  const [telegram, setTelegram] = useState("");
  const [telegramReadOnly, setTelegramReadOnly] = useState(false);
  const [deliveryCity, setDeliveryCity] = useState("");
  const [comment, setComment] = useState("");

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [pickupPointType, setPickupPointType] = useState<PickupPointType | "">("");
  const [customDeliveryMethod, setCustomDeliveryMethod] = useState("");
  const [deliveryAck, setDeliveryAck] = useState(false);
  const [legalConsent, setLegalConsent] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const deliveryFee = useMemo(
    () => calcDeliveryFee(deliveryMethod, pricing),
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

  const needsCourierAddress =
    deliveryMethod === "MOSCOW" || deliveryMethod === "MOSCOW_REGION";

  const resetPickupFields = () => {
    setPickupPointType("");
    setDeliveryAddress("");
    setCustomDeliveryMethod("");
  };

  const needsDeliveryCity = deliveryMethod !== "PICKUP";

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const v = ru.validation;

    if (!name.trim()) next.name = v.nameRequired;
    if (!isCompleteRuPhone(phone)) next.phone = v.phoneRequired;
    const username = telegram.trim().replace(/^@/, "");
    if (!username) next.telegram = v.telegramRequired;
    if (needsDeliveryCity && !deliveryCity.trim()) {
      next.deliveryCity = v.cityRequired;
    }

    if (needsCourierAddress && !deliveryAddress.trim()) {
      next.deliveryAddress = v.deliveryAddressRequired;
    }

    if (deliveryMethod === "PICKUP_POINT") {
      if (!pickupPointType) {
        next.pickupPointType = v.pickupPointTypeRequired;
      } else if (pickupPointType === "WILDBERRIES" && !deliveryAddress.trim()) {
        next.deliveryAddress = v.wildberriesAddressRequired;
      } else if (pickupPointType === "OZON" && !deliveryAddress.trim()) {
        next.deliveryAddress = v.ozonAddressRequired;
      } else if (pickupPointType === "CUSTOM") {
        if (!customDeliveryMethod.trim()) {
          next.customDeliveryMethod = v.customDeliveryMethodRequired;
        }
        if (!deliveryAddress.trim()) {
          next.deliveryAddress = v.customDeliveryAddressRequired;
        }
      }
    }

    if (!deliveryAck) next.deliveryAck = v.deliveryNotConfirmed;
    if (!legalConsent) next.legal = v.legalNotConfirmed;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    const normalizedPhone = normalizeRuPhone(phone);
    const username = telegram.trim().replace(/^@/, "");
    if (!normalizedPhone || !username) return;

    setSubmitting(true);
    try {
      const tgUser = getTelegramUser();

      const order = await createOrder({
        customerName: name.trim(),
        phone: normalizedPhone,
        city: needsDeliveryCity ? deliveryCity.trim() : "",
        comment: comment.trim() || null,
        telegramUser: username,
        telegramId: tgUser?.id ?? null,
        deliveryMethod,
        deliveryAddress:
          needsCourierAddress || deliveryMethod === "PICKUP_POINT"
            ? deliveryAddress.trim()
            : null,
        pickupPointType:
          deliveryMethod === "PICKUP_POINT" && pickupPointType
            ? pickupPointType
            : undefined,
        customDeliveryMethod:
          deliveryMethod === "PICKUP_POINT" && pickupPointType === "CUSTOM"
            ? customDeliveryMethod.trim()
            : null,
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

      <DeliveryMethodPicker
        value={deliveryMethod}
        onChange={(method) => {
          setDeliveryMethod(method);
          resetPickupFields();
          setErrors((prev) => ({
            ...prev,
            deliveryAddress: "",
            pickupPointType: "",
            customDeliveryMethod: "",
            deliveryCity: "",
          }));
        }}
        pricing={pricing}
      />

      {needsDeliveryCity && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">{d.deliveryCity}</span>
          <input
            type="text"
            value={deliveryCity}
            onChange={(e) => setDeliveryCity(e.target.value)}
            placeholder={d.deliveryCityPlaceholder}
            className={inputClass}
          />
          {errors.deliveryCity && (
            <span className="mt-1 block text-xs text-red-600">{errors.deliveryCity}</span>
          )}
        </label>
      )}

      {needsCourierAddress && (
        <label className="block">
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

      {deliveryMethod === "PICKUP_POINT" && (
        <PickupPointSection
          value={pickupPointType}
          onChange={(type) => {
            setPickupPointType(type);
            setDeliveryAddress("");
            setCustomDeliveryMethod("");
            setErrors((prev) => ({
              ...prev,
              pickupPointType: "",
              deliveryAddress: "",
              customDeliveryMethod: "",
            }));
          }}
          address={deliveryAddress}
          onAddressChange={setDeliveryAddress}
          customMethod={customDeliveryMethod}
          onCustomMethodChange={setCustomDeliveryMethod}
          errors={errors}
          inputClass={inputClass}
        />
      )}

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

      <CartPriceSummary pricing={pricing} deliveryFee={deliveryFee} />

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
