import { useEffect, useRef, useState } from "react";
import { ru } from "../../i18n/ru";
import { PRODUCT_BADGE_LABELS, type ProductBadge } from "../../constants";
import type { Product } from "../../types";
import { fileUrl } from "../../api/client";
import { formatPrice } from "../../lib/format";
import {
  adminDuplicateProduct,
  adminFetchProducts,
  adminReorderProducts,
  adminUpdateProduct,
} from "../../api/endpoints";
import AdminProductForm from "./AdminProductForm";

const t = ru.admin.products;

function imgSrc(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : fileUrl(url);
}

export default function AdminProducts({ token }: { token: string }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ product: Product | null } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const reorderTimer = useRef<number | null>(null);

  const load = () => {
    setError(null);
    adminFetchProducts(token)
      .then(setProducts)
      .catch(() => setError(ru.common.error));
  };

  useEffect(load, [token]);

  const upsert = (product: Product) =>
    setProducts((prev) => {
      if (!prev) return [product];
      const exists = prev.some((p) => p.id === product.id);
      return exists
        ? prev.map((p) => (p.id === product.id ? product : p))
        : [...prev, product];
    });

  const toggleStatus = async (product: Product) => {
    try {
      const updated = await adminUpdateProduct(token, product.id, {
        isActive: !product.isActive,
      });
      upsert(updated);
    } catch {
      setError(ru.common.error);
    }
  };

  const duplicate = async (product: Product) => {
    setBusyId(product.id);
    setError(null);
    try {
      const copy = await adminDuplicateProduct(token, product.id);
      upsert(copy);
      setForm({ product: copy });
    } catch {
      setError(t.duplicateError);
    } finally {
      setBusyId(null);
    }
  };

  // Сохраняем новый порядок (с лёгким дебаунсом, чтобы не слать запрос на каждый шаг).
  const persistOrder = (ordered: Product[]) => {
    if (reorderTimer.current) window.clearTimeout(reorderTimer.current);
    reorderTimer.current = window.setTimeout(() => {
      adminReorderProducts(
        token,
        ordered.map((p) => p.id),
      )
        .then(setProducts)
        .catch(() => setError(t.reorderError));
    }, 400);
  };

  const reorder = (from: number, to: number) => {
    setProducts((prev) => {
      if (!prev) return prev;
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persistOrder(next);
      return next;
    });
  };

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId || !products) return;
    const from = products.findIndex((p) => p.id === dragId);
    const to = products.findIndex((p) => p.id === targetId);
    if (from === -1 || to === -1) return;
    reorder(from, to);
    setDragId(null);
  };

  if (form) {
    return (
      <AdminProductForm
        token={token}
        product={form.product}
        onClose={() => setForm(null)}
        onSaved={upsert}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t.title}</h2>
        <button
          type="button"
          onClick={() => setForm({ product: null })}
          className="rounded-lg bg-tg-button px-3 py-1.5 text-xs font-medium text-tg-buttonText"
        >
          {t.add}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!products && <p className="text-sm text-tg-hint">{t.loading}</p>}
      {products && products.length === 0 && (
        <p className="text-sm text-tg-hint">{t.empty}</p>
      )}

      {products && products.length > 1 && (
        <p className="text-xs text-tg-hint">{t.reorderHint}</p>
      )}

      <ul className="space-y-2">
        {products?.map((product, index) => {
          const cover = imgSrc(product.imageUrl ?? product.images[0] ?? null);
          const badge = product.badge as ProductBadge | null;
          return (
            <li
              key={product.id}
              draggable
              onDragStart={() => setDragId(product.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(product.id)}
              onDragEnd={() => setDragId(null)}
              className={`flex gap-3 rounded-2xl border bg-white p-3 transition ${
                dragId === product.id
                  ? "border-tg-button opacity-60"
                  : "border-black/10"
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => reorder(index, index - 1)}
                  disabled={index === 0}
                  aria-label={t.moveUp}
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-tg-secondaryBg text-tg-hint disabled:opacity-30"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m18 15-6-6-6 6" />
                  </svg>
                </button>
                <span className="cursor-grab text-tg-hint" aria-hidden title={t.reorderHint}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                    <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                    <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
                  </svg>
                </span>
                <button
                  type="button"
                  onClick={() => reorder(index, index + 1)}
                  disabled={index === (products?.length ?? 0) - 1}
                  aria-label={t.moveDown}
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-tg-secondaryBg text-tg-hint disabled:opacity-30"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </div>

              <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-tg-secondaryBg">
                {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
              </div>

              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{product.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      product.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {product.isActive ? t.published : t.hidden}
                  </span>
                </div>

                <p className="mt-0.5 text-sm font-semibold">{formatPrice(product.price)}</p>
                <p className="text-xs text-tg-hint">
                  {t.totalStock}: {product.totalStock ?? 0} {t.pieces}
                </p>
                {badge && PRODUCT_BADGE_LABELS[badge] && (
                  <span className="mt-1 inline-block w-fit rounded-md bg-tg-secondaryBg px-2 py-0.5 text-[11px] font-medium">
                    {PRODUCT_BADGE_LABELS[badge]}
                  </span>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ product })}
                    className="rounded-lg bg-tg-secondaryBg px-3 py-1.5 text-xs font-medium"
                  >
                    {t.edit}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === product.id}
                    onClick={() => void duplicate(product)}
                    className="rounded-lg bg-tg-secondaryBg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  >
                    {t.duplicate}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleStatus(product)}
                    className="rounded-lg bg-tg-secondaryBg px-3 py-1.5 text-xs font-medium"
                  >
                    {product.isActive ? t.hide : t.publish}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
