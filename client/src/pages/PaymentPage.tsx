import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ru } from "../i18n/ru";
import { formatPrice, formatPhone } from "../lib/format";
import {
  DEFAULT_PAYMENT_PHONE,
  DEFAULT_PAYMENT_RECIPIENT,
  ORDER_STATUS_LABELS,
} from "../constants";
import type { Order } from "../types";
import { fetchOrder, uploadPaymentProof } from "../api/endpoints";
import { ApiError } from "../api/client";
import { useToast } from "../components/Toast";
import { hapticImpact, hapticNotify } from "../telegram/webapp";

const ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { show } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const paymentPhoneDisplay = formatPhone(DEFAULT_PAYMENT_PHONE);

  useEffect(() => {
    if (!id) return;
    fetchOrder(id)
      .then((o) => {
        setOrder(o);
        if (o.status === "PAYMENT_REVIEW" || o.paymentProofs.length > 0) setSuccess(true);
      })
      .catch(() => setError(ru.common.error));
  }, [id]);

  if (error) {
    return <p className="py-10 text-center text-sm text-red-600">{error}</p>;
  }
  if (!order) {
    return (
      <div className="animate-fade-in space-y-3">
        <div className="h-7 w-1/2 animate-pulse rounded bg-surface" />
        <div className="h-40 w-full animate-pulse rounded-card bg-surface" />
      </div>
    );
  }

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(DEFAULT_PAYMENT_PHONE);
      hapticImpact("light");
      show(ru.payment.phoneCopied, "success");
    } catch {
      hapticNotify("error");
    }
  };

  const handleFile = async (file: File) => {
    setUploadError(null);
    const okExt = /\.(jpg|jpeg|png|pdf)$/i.test(file.name);
    if (!okExt) {
      setUploadError(ru.payment.invalidFormat);
      hapticNotify("error");
      return;
    }
    setUploading(true);
    try {
      const updated = await uploadPaymentProof(order.id, file);
      setOrder(updated);
      setSuccess(true);
      setShowUpload(false);
      hapticNotify("success");
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : ru.payment.uploadError);
      hapticNotify("error");
    } finally {
      setUploading(false);
    }
  };

  const row = (label: string, value: string, big = false) => (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="text-muted">{label}</span>
      <span className={big ? "text-2xl font-semibold text-ink" : "text-right font-medium text-ink"}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-4">
      <div className="px-1">
        <p className="text-xs uppercase tracking-widest text-muted">{ru.payment.title}</p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink">
          {ru.payment.order} №{order.orderNumber}
        </h1>
      </div>

      <div className="rounded-card bg-surface p-5 text-sm">
        {row(ru.payment.amountDue, formatPrice(order.totalAmount), true)}
        <div className="mt-1 divide-y divide-line border-t border-line pt-1">
          <div className="py-2">
            <span className="text-muted">{ru.payment.bank}</span>
            <p className="mt-0.5 text-base font-semibold text-ink">
              {order.assignedBankName ?? "—"}
            </p>
          </div>
          {row(ru.payment.recipient, DEFAULT_PAYMENT_RECIPIENT)}
          <div className="py-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted">{ru.payment.phoneNumber}</span>
              <span className="text-right font-medium text-ink">{paymentPhoneDisplay}</span>
            </div>
            <button
              type="button"
              onClick={() => void copyPhone()}
              className="press mt-2 w-full rounded-button bg-paper py-2.5 text-sm font-semibold text-ink ring-1 ring-inset ring-line"
            >
              {ru.payment.copyPhone}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-card bg-surface px-4 py-1 text-sm">
        {row(ru.payment.statusLabel, ORDER_STATUS_LABELS[order.status])}
      </div>

      {success ? (
        <div className="flex items-center gap-3 rounded-card bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <svg className="animate-check-pop" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          {ru.payment.uploadSuccess}
        </div>
      ) : showUpload ? (
        <div className="space-y-3 rounded-card bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">{ru.payment.uploadTitle}</h2>
          <p className="text-xs text-muted">{ru.payment.uploadHint}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="press w-full rounded-button bg-ink py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {uploading ? ru.payment.uploading : ru.payment.chooseFile}
          </button>
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="press w-full rounded-button bg-ink py-3.5 text-[15px] font-semibold text-white shadow-soft"
        >
          {ru.payment.paidButton}
        </button>
      )}
    </div>
  );
}
