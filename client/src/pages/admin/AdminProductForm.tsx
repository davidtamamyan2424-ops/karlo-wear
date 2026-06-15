import { useRef, useState } from "react";
import { ru } from "../../i18n/ru";
import { SIZES, PRODUCT_BADGE_LABELS, type ProductBadge, type Size } from "../../constants";
import type { Product } from "../../types";
import { fileUrl } from "../../api/client";
import {
  adminAdjustStock,
  adminCreateProduct,
  adminUpdateProduct,
  adminUploadProductImages,
  type ProductPayload,
} from "../../api/endpoints";

const t = ru.admin.products;

function imgSrc(url: string): string {
  return url.startsWith("http") ? url : fileUrl(url);
}

interface Props {
  token: string;
  product: Product | null; // null => создание
  onClose: () => void;
  onSaved: (product: Product) => void;
}

export default function AdminProductForm({ token, product, onClose, onSaved }: Props) {
  const isEdit = Boolean(product);

  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [priceRub, setPriceRub] = useState(
    product ? String(Math.round(product.price / 100)) : "",
  );
  const [composition, setComposition] = useState(product?.composition ?? "");
  const [fabricDensity, setFabricDensity] = useState(product?.fabricDensity ?? "");
  const [modelHeight, setModelHeight] = useState(
    product?.modelHeight != null ? String(product.modelHeight) : "",
  );
  const [modelSize, setModelSize] = useState<string>(product?.modelSize ?? "");
  const [badge, setBadge] = useState<string>(product?.badge ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  const initialStock: Record<Size, number> = { S: 0, M: 0, L: 0, XL: 0 };
  for (const s of product?.sizes ?? []) {
    if ((SIZES as readonly string[]).includes(s.label)) {
      initialStock[s.label as Size] = s.stock;
    }
  }
  const [stock, setStock] = useState<Record<Size, number>>(initialStock);
  const [deltas, setDeltas] = useState<Record<Size, string>>({ S: "", M: "", L: "", XL: "" });

  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);

  // --- Изображения ---
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const { urls } = await adminUploadProductImages(token, Array.from(files));
      setImages((prev) => [...prev, ...urls]);
    } catch {
      setError(t.uploadError);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeImage = (i: number) => setImages((prev) => prev.filter((_, idx) => idx !== i));
  const setMain = (i: number) =>
    setImages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(i, 1);
      copy.unshift(item);
      return copy;
    });

  const onDrop = (target: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from == null || from === target) return;
    setImages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  // --- Быстрое добавление остатка (только для существующего товара) ---
  const applyDelta = async (label: Size) => {
    const raw = deltas[label].trim();
    if (!raw || !product) return;
    const delta = Number(raw);
    if (!Number.isInteger(delta) || delta === 0) return;
    setError(null);
    try {
      const updated = await adminAdjustStock(token, product.id, label, delta);
      const next = { ...stock };
      for (const s of updated.sizes) {
        if ((SIZES as readonly string[]).includes(s.label)) next[s.label as Size] = s.stock;
      }
      setStock(next);
      setDeltas((d) => ({ ...d, [label]: "" }));
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError);
    }
  };

  const save = async () => {
    if (!name.trim() || !sku.trim() || !priceRub.trim()) {
      setError(t.validationError);
      return;
    }
    const priceKopecks = Math.round(Number(priceRub) * 100);
    if (!Number.isFinite(priceKopecks) || priceKopecks < 1) {
      setError(t.validationError);
      return;
    }
    setSaving(true);
    setError(null);

    const payload: ProductPayload = {
      name: name.trim(),
      sku: sku.trim(),
      description: description.trim() || null,
      price: priceKopecks,
      composition: composition.trim() || null,
      fabricDensity: fabricDensity.trim() || null,
      modelHeight: modelHeight.trim() ? Number(modelHeight) : null,
      modelSize: modelSize ? (modelSize as Size) : null,
      badge: badge ? (badge as ProductBadge) : null,
      images,
      isActive,
      sizes: SIZES.map((label) => ({ label, stock: stock[label] })),
    };

    try {
      const result = product
        ? await adminUpdateProduct(token, product.id, payload)
        : await adminCreateProduct(token, payload);
      onSaved(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-tg-button";

  return (
    <div className="space-y-4 rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{isEdit ? t.editTitle : t.newTitle}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-tg-secondaryBg px-3 py-1.5 text-xs font-medium"
        >
          {t.cancel}
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {/* Основные поля */}
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t.name} *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} className={inputCls} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t.sku} *</span>
            <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t.price} *</span>
            <input
              type="number"
              inputMode="numeric"
              value={priceRub}
              onChange={(e) => setPriceRub(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t.description}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t.composition}</span>
            <input value={composition} onChange={(e) => setComposition(e.target.value)} placeholder={t.compositionPlaceholder} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t.fabricDensity}</span>
            <input value={fabricDensity} onChange={(e) => setFabricDensity(e.target.value)} placeholder={t.fabricDensityPlaceholder} className={inputCls} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t.modelHeight}</span>
            <input
              type="number"
              inputMode="numeric"
              value={modelHeight}
              onChange={(e) => setModelHeight(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{t.modelSize}</span>
            <select value={modelSize} onChange={(e) => setModelSize(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t.badge}</span>
          <select value={badge} onChange={(e) => setBadge(e.target.value)} className={inputCls}>
            <option value="">{t.noBadge}</option>
            {(Object.keys(PRODUCT_BADGE_LABELS) as ProductBadge[]).map((b) => (
              <option key={b} value={b}>
                {PRODUCT_BADGE_LABELS[b]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Статус публикации */}
      <div className="flex items-center justify-between rounded-xl bg-tg-secondaryBg px-3 py-2.5">
        <span className="text-sm font-medium">{t.status}</span>
        <button
          type="button"
          onClick={() => setIsActive((v) => !v)}
          className={[
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            isActive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700",
          ].join(" ")}
        >
          {isActive ? t.published : t.hidden}
        </button>
      </div>

      {/* Изображения */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t.images}</span>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-tg-button px-3 py-1.5 text-xs font-medium text-tg-buttonText disabled:opacity-50"
          >
            {uploading ? t.uploading : t.uploadImages}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            multiple
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
        </div>

        {images.length === 0 ? (
          <p className="rounded-lg bg-tg-secondaryBg px-3 py-3 text-center text-xs text-tg-hint">
            {t.noImages}
          </p>
        ) : (
          <>
            <p className="text-xs text-tg-hint">{t.dragHint}</p>
            <div className="grid grid-cols-3 gap-2">
              {images.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  draggable
                  onDragStart={() => (dragIndex.current = i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(i)}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-tg-secondaryBg"
                >
                  <img src={imgSrc(url)} alt="" className="h-full w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded-md bg-tg-button px-1.5 py-0.5 text-[10px] font-semibold text-tg-buttonText">
                      {t.main}
                    </span>
                  )}
                  <div className="absolute inset-x-1 bottom-1 flex gap-1">
                    {i !== 0 && (
                      <button
                        type="button"
                        onClick={() => setMain(i)}
                        title={t.setMain}
                        className="flex-1 rounded-md bg-black/55 py-1 text-[10px] font-medium text-white backdrop-blur"
                      >
                        {t.setMain}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      title={t.removeImage}
                      className="rounded-md bg-red-600/80 px-2 py-1 text-[10px] font-medium text-white backdrop-blur"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Остатки по размерам */}
      <div className="space-y-2">
        <span className="text-sm font-medium">{t.sizesStock}</span>
        <div className="space-y-2">
          {SIZES.map((label) => (
            <div key={label} className="flex items-center gap-2 rounded-xl bg-tg-secondaryBg p-2">
              <span className="w-8 text-center text-sm font-semibold">{label}</span>
              <label className="flex items-center gap-1">
                <span className="text-xs text-tg-hint">{t.stock}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={stock[label]}
                  onChange={(e) =>
                    setStock((prev) => ({ ...prev, [label]: Math.max(0, Number(e.target.value) || 0) }))
                  }
                  className="w-16 rounded-lg border border-black/15 bg-white px-2 py-1.5 text-sm"
                />
              </label>

              {isEdit && (
                <div className="ml-auto flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="+/-"
                    value={deltas[label]}
                    onChange={(e) => setDeltas((d) => ({ ...d, [label]: e.target.value }))}
                    className="w-16 rounded-lg border border-black/15 bg-white px-2 py-1.5 text-sm"
                    title={t.addStockHint}
                  />
                  <button
                    type="button"
                    onClick={() => void applyDelta(label)}
                    className="rounded-lg bg-tg-button px-2.5 py-1.5 text-xs font-medium text-tg-buttonText"
                  >
                    {t.apply}
                  </button>
                  {deltas[label].trim() && Number.isInteger(Number(deltas[label])) && (
                    <span className="text-[11px] text-tg-hint">
                      → {Math.max(0, stock[label] + Number(deltas[label]))}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {isEdit && <p className="text-xs text-tg-hint">{t.addStockHint}</p>}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="flex-1 rounded-xl bg-tg-button py-3 text-sm font-semibold text-tg-buttonText disabled:opacity-50"
        >
          {saving ? t.saving : t.save}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-tg-secondaryBg px-5 py-3 text-sm font-medium"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
