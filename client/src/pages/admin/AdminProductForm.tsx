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
  adminUploadSizeChart,
  type ProductPayload,
} from "../../api/endpoints";
import ColorSwatch from "../../components/ColorSwatch";

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

type VariantForm = {
  id?: string;
  name: string;
  sku: string;
  colorHex: string;
  priceRub: string;
  images: string[];
  stock: Record<Size, number>;
  deltas: Record<Size, string>;
};

function randomVariantSku(): string {
  return `KW-V-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
}

export default function AdminProductForm({ token, product, onClose, onSaved }: Props) {
  const isEdit = Boolean(product);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [priceRub, setPriceRub] = useState(
    product ? String(Math.round(product.price / 100)) : "",
  );
  const [composition, setComposition] = useState(product?.composition ?? "");
  const [badge, setBadge] = useState<string>(product?.badge ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const makeStock = (sizes: { label: string; stock: number }[] = []): Record<Size, number> => {
    const base: Record<Size, number> = { S: 0, M: 0, L: 0, XL: 0 };
    for (const size of sizes) {
      if ((SIZES as readonly string[]).includes(size.label)) base[size.label as Size] = size.stock;
    }
    return base;
  };
  const initialVariants: VariantForm[] =
    product?.variants?.length
      ? product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          colorHex: variant.colorHex ?? "",
          priceRub: variant.price ? String(Math.round(variant.price / 100)) : "",
          images: variant.images,
          stock: makeStock(variant.sizes),
          deltas: { S: "", M: "", L: "", XL: "" },
        }))
      : [
          {
            name: "Базовый цвет",
            sku: product?.sku ?? randomVariantSku(),
            colorHex: "",
            priceRub: "",
            images: product?.images ?? [],
            stock: makeStock(product?.sizes),
            deltas: { S: "", M: "", L: "", XL: "" },
          },
        ];
  const [variants, setVariants] = useState<VariantForm[]>(initialVariants);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [sizeChartUrl, setSizeChartUrl] = useState<string | null>(product?.sizeChartUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadingChart, setUploadingChart] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chartRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const { urls } = await adminUploadProductImages(token, Array.from(files));
      setVariants((prev) =>
        prev.map((variant, idx) =>
          idx === activeVariantIdx ? { ...variant, images: [...variant.images, ...urls] } : variant,
        ),
      );
    } catch {
      setError(t.uploadError);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSizeChartUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadingChart(true);
    setError(null);
    try {
      const { url } = await adminUploadSizeChart(token, file);
      setSizeChartUrl(url);
    } catch {
      setError(t.uploadError);
    } finally {
      setUploadingChart(false);
      if (chartRef.current) chartRef.current.value = "";
    }
  };

  const activeVariant = variants[activeVariantIdx];

  const moveVariant = (from: number, to: number) => {
    if (to < 0 || to >= variants.length || from === to) return;
    setVariants((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setActiveVariantIdx(to);
  };

  const removeImage = (i: number) =>
    setVariants((prev) =>
      prev.map((variant, idx) =>
        idx === activeVariantIdx
          ? { ...variant, images: variant.images.filter((_, imageIdx) => imageIdx !== i) }
          : variant,
      ),
    );
  const setMain = (i: number) =>
    setVariants((prev) =>
      prev.map((variant, idx) => {
        if (idx !== activeVariantIdx) return variant;
        const copy = [...variant.images];
        const [item] = copy.splice(i, 1);
        copy.unshift(item);
        return { ...variant, images: copy };
      }),
    );

  const onDrop = (target: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from == null || from === target) return;
    setVariants((prev) =>
      prev.map((variant, idx) => {
        if (idx !== activeVariantIdx) return variant;
        const copy = [...variant.images];
        const [item] = copy.splice(from, 1);
        copy.splice(target, 0, item);
        return { ...variant, images: copy };
      }),
    );
  };

  const applyDelta = async (label: Size) => {
    const raw = activeVariant?.deltas[label]?.trim() ?? "";
    if (!raw || !product) return;
    const delta = Number(raw);
    if (!Number.isInteger(delta) || delta === 0) return;
    setError(null);
    try {
      const updated = await adminAdjustStock(token, product.id, label, delta, activeVariant.id);
      const updatedVariant =
        updated.variants.find((variant) => variant.id === activeVariant.id) ?? updated.variants[0];
      if (updatedVariant) {
        setVariants((prev) =>
          prev.map((variant, idx) =>
            idx === activeVariantIdx
              ? {
                  ...variant,
                  stock: makeStock(updatedVariant.sizes),
                  deltas: { ...variant.deltas, [label]: "" },
                }
              : variant,
          ),
        );
      }
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveError);
    }
  };

  const save = async () => {
    if (!name.trim() || !priceRub.trim()) {
      setError(t.validationError);
      return;
    }
    if (variants.length === 0) {
      setError(t.validationError);
      return;
    }
    if (variants.some((variant) => !variant.name.trim() || !variant.sku.trim())) {
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
      description: description.trim() || null,
      price: priceKopecks,
      composition: composition.trim() || null,
      badge: badge ? (badge as ProductBadge) : null,
      sizeChartUrl,
      isActive,
      variants: variants.map((variant) => ({
        id: variant.id,
        name: variant.name.trim(),
        sku: variant.sku.trim(),
        colorHex: variant.colorHex.trim() || null,
        price: variant.priceRub.trim() ? Math.round(Number(variant.priceRub) * 100) : null,
        images: variant.images,
        sizes: SIZES.map((label) => ({ label, stock: variant.stock[label] })),
      })),
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

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t.name} *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} className={inputCls} />
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

        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t.description}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className={`${inputCls} resize-y min-h-[140px]`}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t.composition}</span>
          <input value={composition} onChange={(e) => setComposition(e.target.value)} placeholder={t.compositionPlaceholder} className={inputCls} />
        </label>

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

      {/* Варианты цветов */}
      <div className="space-y-2 rounded-xl border border-black/10 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t.variants}</span>
          <button
            type="button"
            onClick={() =>
              setVariants((prev) => [
                ...prev,
                {
                  name: "",
                  sku: randomVariantSku(),
                  colorHex: "",
                  priceRub: "",
                  images: [],
                  stock: { S: 0, M: 0, L: 0, XL: 0 },
                  deltas: { S: "", M: "", L: "", XL: "" },
                },
              ])
            }
            className="rounded-lg bg-tg-button px-3 py-1.5 text-xs font-medium text-tg-buttonText"
          >
            {t.addVariant}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {variants.map((variant, idx) => (
            <button
              key={variant.id ?? `new-${idx}`}
              type="button"
              onClick={() => setActiveVariantIdx(idx)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${idx === activeVariantIdx ? "bg-ink text-white" : "bg-tg-secondaryBg"}`}
            >
              <ColorSwatch
                name={variant.name || `Цвет ${idx + 1}`}
                colorHex={variant.colorHex || null}
                size={12}
              />
              {variant.name || `Цвет ${idx + 1}`}
            </button>
          ))}
        </div>
        {variants.length > 1 && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={activeVariantIdx === 0}
              onClick={() => moveVariant(activeVariantIdx, activeVariantIdx - 1)}
              className="rounded-lg bg-tg-secondaryBg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              {t.moveVariantUp}
            </button>
            <button
              type="button"
              disabled={activeVariantIdx === variants.length - 1}
              onClick={() => moveVariant(activeVariantIdx, activeVariantIdx + 1)}
              className="rounded-lg bg-tg-secondaryBg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              {t.moveVariantDown}
            </button>
          </div>
        )}
      </div>

      {/* Фото варианта */}
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

        {activeVariant.images.length === 0 ? (
          <p className="rounded-lg bg-tg-secondaryBg px-3 py-3 text-center text-xs text-tg-hint">
            {t.noImages}
          </p>
        ) : (
          <>
            <p className="text-xs text-tg-hint">{t.dragHint}</p>
            <div className="grid grid-cols-3 gap-2">
              {activeVariant.images.map((url, i) => (
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

      {/* Размерная сетка */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t.sizeChart}</span>
          <button
            type="button"
            disabled={uploadingChart}
            onClick={() => chartRef.current?.click()}
            className="rounded-lg bg-tg-button px-3 py-1.5 text-xs font-medium text-tg-buttonText disabled:opacity-50"
          >
            {uploadingChart ? t.uploadingSizeChart : t.uploadSizeChart}
          </button>
          <input
            ref={chartRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => void handleSizeChartUpload(e.target.files)}
          />
        </div>

        {sizeChartUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-black/10 bg-tg-secondaryBg">
            <img src={imgSrc(sizeChartUrl)} alt="" className="max-h-48 w-full object-contain" />
            <button
              type="button"
              onClick={() => setSizeChartUrl(null)}
              className="absolute right-2 top-2 rounded-md bg-red-600/90 px-2 py-1 text-[10px] font-medium text-white"
            >
              {t.removeSizeChart}
            </button>
          </div>
        ) : (
          <p className="rounded-lg bg-tg-secondaryBg px-3 py-3 text-center text-xs text-tg-hint">
            {t.noSizeChart}
          </p>
        )}
      </div>

      {/* Остатки по размерам */}
      <div className="space-y-2">
        <span className="text-sm font-medium">{t.sizesStock}</span>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t.colorName} *</span>
          <div className="flex items-center gap-2">
            <ColorSwatch name={activeVariant.name} colorHex={activeVariant.colorHex || null} size={24} />
            <input
              value={activeVariant.name}
              onChange={(e) =>
                setVariants((prev) =>
                  prev.map((variant, idx) =>
                    idx === activeVariantIdx ? { ...variant, name: e.target.value } : variant,
                  ),
                )
              }
              className={`${inputCls} flex-1`}
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t.colorHex}</span>
          <input
            value={activeVariant.colorHex}
            onChange={(e) =>
              setVariants((prev) =>
                prev.map((variant, idx) =>
                  idx === activeVariantIdx ? { ...variant, colorHex: e.target.value } : variant,
                ),
              )
            }
            placeholder="#000000"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t.variantSku} *</span>
          <input
            value={activeVariant.sku}
            onChange={(e) =>
              setVariants((prev) =>
                prev.map((variant, idx) =>
                  idx === activeVariantIdx ? { ...variant, sku: e.target.value } : variant,
                ),
              )
            }
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{t.variantPrice}</span>
          <input
            type="number"
            inputMode="numeric"
            value={activeVariant.priceRub}
            onChange={(e) =>
              setVariants((prev) =>
                prev.map((variant, idx) =>
                  idx === activeVariantIdx ? { ...variant, priceRub: e.target.value } : variant,
                ),
              )
            }
            className={inputCls}
          />
        </label>
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
                  value={activeVariant.stock[label]}
                  onChange={(e) =>
                    setVariants((prev) =>
                      prev.map((variant, idx) =>
                        idx === activeVariantIdx
                          ? {
                              ...variant,
                              stock: {
                                ...variant.stock,
                                [label]: Math.max(0, Number(e.target.value) || 0),
                              },
                            }
                          : variant,
                      ),
                    )
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
                    value={activeVariant.deltas[label]}
                    onChange={(e) =>
                      setVariants((prev) =>
                        prev.map((variant, idx) =>
                          idx === activeVariantIdx
                            ? {
                                ...variant,
                                deltas: { ...variant.deltas, [label]: e.target.value },
                              }
                            : variant,
                        ),
                      )
                    }
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
                  {activeVariant.deltas[label].trim() &&
                    Number.isInteger(Number(activeVariant.deltas[label])) && (
                    <span className="text-[11px] text-tg-hint">
                      → {Math.max(0, activeVariant.stock[label] + Number(activeVariant.deltas[label]))}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {isEdit && <p className="text-xs text-tg-hint">{t.addStockHint}</p>}
        {variants.length > 1 && (
          <button
            type="button"
            onClick={() => {
              const next = variants.filter((_, idx) => idx !== activeVariantIdx);
              setVariants(next);
              setActiveVariantIdx(Math.max(0, activeVariantIdx - 1));
            }}
            className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700"
          >
            {t.removeVariant}
          </button>
        )}
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
