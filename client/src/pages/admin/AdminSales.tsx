import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  adminCreateManualSale,
  adminFetchManualSales,
  adminFetchProducts,
  adminUpdateManualSale,
} from "../../api/endpoints";
import type { ManualSale } from "../../types/crm";
import type { Product } from "../../types";
import type { Size } from "../../constants";
import { SIZES } from "../../constants";
import { ru } from "../../i18n/ru";
import { formatPrice } from "../../lib/format";
import { SALE_CATEGORY_LABELS, SALE_SOURCE_LABELS } from "../../constants/finance";
import { ApiError } from "../../api/client";

interface Props {
  token: string;
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminSales({ token }: Props) {
  const t = ru.admin.crm;
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<ManualSale[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [sizeLabel, setSizeLabel] = useState<Size | "">("");
  const [quantity, setQuantity] = useState("1");
  const [amountRub, setAmountRub] = useState("");
  const [comment, setComment] = useState("");
  const [saleCategory, setSaleCategory] = useState("SALE");
  const [saleSource, setSaleSource] = useState("MANUAL");
  const [soldAt, setSoldAt] = useState(() => toDatetimeLocalValue(new Date().toISOString()));

  const load = () => {
    void adminFetchProducts(token).then(setProducts);
    void adminFetchManualSales(token).then(setSales);
  };

  useEffect(load, [token]);

  const product = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId],
  );
  const variant = useMemo(
    () => product?.variants.find((v) => v.id === variantId),
    [product, variantId],
  );

  const resetForm = () => {
    setEditingId(null);
    setProductId("");
    setVariantId("");
    setSizeLabel("");
    setQuantity("1");
    setAmountRub("");
    setComment("");
    setSaleCategory("SALE");
    setSaleSource("MANUAL");
    setSoldAt(toDatetimeLocalValue(new Date().toISOString()));
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
    setError(null);
  };

  const openEdit = (sale: ManualSale) => {
    setEditingId(sale.id);
    setProductId(sale.productId);
    setVariantId(sale.productVariantId);
    setSizeLabel(sale.sizeLabel as Size);
    setQuantity(String(sale.quantity));
    setAmountRub(sale.amount != null ? String(sale.amount / 100) : "");
    setComment(sale.comment ?? "");
    setSaleCategory(sale.saleCategory);
    setSaleSource(sale.saleSource ?? "MANUAL");
    setSoldAt(toDatetimeLocalValue(sale.soldAt ?? sale.createdAt));
    setShowForm(true);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!productId || !variantId || !sizeLabel) {
      setError(t.validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const amount =
        amountRub.trim() === ""
          ? null
          : Math.round(Number(amountRub) * 100);
      if (amountRub.trim() !== "" && (!Number.isFinite(amount!) || amount! < 0)) {
        setError(t.validationError);
        setSaving(false);
        return;
      }

      const payload = {
        productId,
        variantId,
        sizeLabel,
        quantity: Number(quantity),
        amount,
        comment: comment.trim() || null,
        saleCategory,
        saleSource,
        soldAt: new Date(soldAt).toISOString(),
      };

      if (editingId) {
        await adminUpdateManualSale(token, editingId, payload);
      } else {
        await adminCreateManualSale(token, payload);
      }

      setShowForm(false);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ru.common.error);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-tg-button";

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => (showForm && !editingId ? setShowForm(false) : openCreate())}
        className="rounded-xl bg-tg-button px-4 py-2 text-sm font-medium text-tg-buttonText"
      >
        {t.addManualSale}
      </button>

      {showForm && (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-black/10 bg-white p-4">
          <h3 className="text-sm font-semibold">
            {editingId ? t.editSaleTitle : t.addManualSale}
          </h3>
          {error && <p className="text-sm text-red-600">{error}</p>}

          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t.model}</span>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setVariantId("");
                setSizeLabel("");
              }}
              className={inputCls}
            >
              <option value="">{t.selectModel}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {product && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium">{t.color}</span>
              <select
                value={variantId}
                onChange={(e) => {
                  setVariantId(e.target.value);
                  setSizeLabel("");
                }}
                className={inputCls}
              >
                <option value="">{t.selectColor}</option>
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {variant && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium">{t.size}</span>
              <select
                value={sizeLabel}
                onChange={(e) => setSizeLabel(e.target.value as Size)}
                className={inputCls}
              >
                <option value="">{t.selectSize}</option>
                {SIZES.map((label) => {
                  const stock = variant.sizes.find((s) => s.label === label)?.stock ?? 0;
                  const isCurrent =
                    editingId &&
                    sales.find((s) => s.id === editingId)?.sizeLabel === label &&
                    sales.find((s) => s.id === editingId)?.productVariantId === variantId;
                  return (
                    <option key={label} value={label} disabled={stock <= 0 && !isCurrent}>
                      {label} ({stock} шт.)
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium">{t.quantity}</span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium">{t.saleAmount}</span>
              <input
                type="number"
                min={0}
                placeholder="0 или пусто"
                value={amountRub}
                onChange={(e) => setAmountRub(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t.saleDate}</span>
            <input
              type="datetime-local"
              value={soldAt}
              onChange={(e) => setSoldAt(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t.saleSource}</span>
            <select
              value={saleSource}
              onChange={(e) => setSaleSource(e.target.value)}
              className={inputCls}
            >
              {Object.entries(SALE_SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t.saleCategory}</span>
            <select
              value={saleCategory}
              onChange={(e) => setSaleCategory(e.target.value)}
              className={inputCls}
            >
              {Object.entries(SALE_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t.comment}</span>
            <input value={comment} onChange={(e) => setComment(e.target.value)} className={inputCls} />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="flex-1 rounded-xl border border-black/15 py-2.5 text-sm font-medium"
            >
              {ru.admin.products.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-tg-button py-2.5 text-sm font-semibold text-tg-buttonText disabled:opacity-60"
            >
              {saving ? ru.admin.products.saving : ru.admin.products.save}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {sales.length === 0 && <p className="text-sm text-tg-hint">{t.noSales}</p>}
        {sales.map((sale) => (
          <div key={sale.id} className="rounded-xl border border-black/10 bg-white p-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="font-medium">
                {sale.productName} · {sale.variantName} · {sale.sizeLabel}
              </span>
              <span>{sale.amount != null ? formatPrice(sale.amount) : "—"}</span>
            </div>
            <p className="mt-1 text-xs text-tg-hint">
              {new Date(sale.soldAt ?? sale.createdAt).toLocaleString("ru-RU")} · {sale.quantity} шт. ·{" "}
              {SALE_CATEGORY_LABELS[sale.saleCategory] ?? sale.saleCategory} ·{" "}
              {SALE_SOURCE_LABELS[sale.saleSource] ?? sale.saleSource}
              {sale.comment ? ` · ${sale.comment}` : ""}
            </p>
            <button
              type="button"
              onClick={() => openEdit(sale)}
              className="mt-2 rounded-lg bg-tg-secondaryBg px-3 py-1.5 text-xs font-medium"
            >
              {t.editSale}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
