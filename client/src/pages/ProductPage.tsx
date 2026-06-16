import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { fetchProduct } from "../api/endpoints";
import type { Product } from "../types";
import type { Size } from "../constants";
import { ru } from "../i18n/ru";
import { formatPrice, formatHeight } from "../lib/format";
import { useCart } from "../cart/CartContext";
import { useToast } from "../components/Toast";
import { hapticImpact, hapticNotify, hapticSelection } from "../telegram/webapp";
import ImageGallery from "../components/ImageGallery";
import SizeChartModal from "../components/SizeChartModal";
import ColorSwatch from "../components/ColorSwatch";
import VariantImagePlaceholder from "../components/VariantImagePlaceholder";
import FullscreenImageViewer from "../components/FullscreenImageViewer";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const variantParam = searchParams.get("variant");
  const { addItem } = useCart();
  const { show } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [addedSize, setAddedSize] = useState<Size | null>(null);
  const [flash, setFlash] = useState(false);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    setProduct(null);
    fetchProduct(id)
      .then(setProduct)
      .catch(() => setError(ru.common.error));
  }, [id]);

  useEffect(() => {
    if (!product) return;
    const fromUrl = variantParam
      ? product.variants.find((variant) => variant.id === variantParam)
      : undefined;
    setSelectedVariantId(
      fromUrl?.id ?? product.defaultVariantId ?? product.variants[0]?.id ?? null,
    );
    setSelectedSize(null);
    setAddedSize(null);
    setViewerOpen(false);
  }, [product, variantParam]);

  useEffect(() => {
    setViewerOpen(false);
  }, [selectedVariantId]);

  if (error) {
    return <p className="py-10 text-center text-sm text-red-600">{error}</p>;
  }
  if (!product) {
    return (
      <div className="animate-fade-in">
        <div className="aspect-[3/4] w-full animate-pulse rounded-card bg-surface" />
        <div className="mt-4 h-5 w-2/3 animate-pulse rounded bg-surface" />
        <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-surface" />
      </div>
    );
  }

  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) ?? product.variants[0];
  const variantSizes = selectedVariant?.sizes ?? [];
  const variantImages = selectedVariant?.images ?? [];
  const hasVariantImages = variantImages.length > 0;
  const selectedStock = selectedSize
    ? (variantSizes.find((s) => s.label === selectedSize)?.stock ?? 0)
    : null;

  const inCart = addedSize !== null && addedSize === selectedSize;

  const handleAdd = () => {
    if (inCart) {
      navigate("/cart");
      return;
    }
    if (!selectedSize) return;
    const ok = addItem(product, selectedSize, 1, selectedVariant?.id);
    if (ok) {
      hapticImpact("medium");
      show(ru.notifications.addedToCart, "success");
      setAddedSize(selectedSize);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 900);
    } else {
      hapticNotify("warning");
      show(ru.cart.maxStockReached, "info");
    }
  };

  const detailRow = (label: string, value: string) => (
    <div className="flex justify-between gap-4 py-2.5">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-5">
      {hasVariantImages ? (
        <ImageGallery
          key={selectedVariant?.id}
          images={variantImages}
          alt={product.name}
          aspect="3/4"
          eagerFirst
          onImageClick={(index) => {
            setViewerIndex(index);
            setViewerOpen(true);
          }}
        />
      ) : (
        <VariantImagePlaceholder aspect="3/4" />
      )}

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{product.name}</h1>
        <p className="mt-1.5 text-2xl font-semibold text-ink">
          {formatPrice(selectedVariant?.price ?? product.price)}
        </p>
      </div>

      {product.variants.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">{ru.product.color}</p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => {
              const active = selectedVariant?.id === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => {
                    hapticSelection();
                    setSelectedVariantId(variant.id);
                    setSelectedSize(null);
                    setAddedSize(null);
                  }}
                  className={[
                    "press flex items-center gap-2 rounded-button px-3 py-2 text-sm font-medium",
                    active ? "bg-ink text-white" : "bg-surface text-ink hover:bg-line",
                  ].join(" ")}
                >
                  <ColorSwatch name={variant.name} size={16} className={active ? "ring-white/40" : ""} />
                  {variant.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Выбор размера */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-ink">{ru.product.size}</p>
          <div className="flex items-center gap-3">
            {product.sizeChartUrl && (
              <button
                type="button"
                onClick={() => setSizeChartOpen(true)}
                className="press text-sm font-medium text-ink underline decoration-ink/30 underline-offset-2"
              >
                {ru.product.sizeChart}
              </button>
            )}
            {selectedStock != null && selectedStock > 0 && (
              <span className="text-xs text-muted">
                {ru.product.inStock} · {selectedStock} {ru.product.pieces}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {variantSizes.map((s) => {
            const disabled = s.stock <= 0;
            const active = selectedSize === s.label;
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  hapticSelection();
                  setSelectedSize(s.label);
                }}
                className={[
                  "press flex h-12 min-w-12 items-center justify-center rounded-button px-4 text-sm font-medium",
                  disabled
                    ? "cursor-not-allowed text-muted/60 line-through ring-1 ring-inset ring-line"
                    : active
                      ? "bg-ink text-white"
                      : "bg-surface text-ink hover:bg-line",
                ].join(" ")}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {product.description && (
        <div>
          <h2 className="mb-1.5 text-sm font-semibold text-ink">{ru.product.description}</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{product.description}</p>
        </div>
      )}

      {/* Характеристики */}
      <div>
        <h2 className="mb-1 text-sm font-semibold text-ink">{ru.product.details}</h2>
        <div className="divide-y divide-line text-sm">
          {product.composition && detailRow(ru.product.composition, product.composition)}
          {product.fabricDensity &&
            detailRow(ru.product.fabricDensity, product.fabricDensity)}
          {product.modelHeight != null &&
            detailRow(ru.product.modelHeight, formatHeight(product.modelHeight))}
          {product.modelSize && detailRow(ru.product.modelSize, product.modelSize)}
          {detailRow(ru.product.sku, selectedVariant?.sku ?? product.sku)}
        </div>
      </div>

      {/* Док-панель действий */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedSize}
            className={[
              "press flex h-12 flex-1 items-center justify-center gap-2 rounded-button text-[15px] font-semibold",
              !selectedSize
                ? "cursor-not-allowed bg-surface text-muted"
                : flash
                  ? "bg-emerald-600 text-white"
                  : "bg-ink text-white shadow-soft",
            ].join(" ")}
          >
            {flash ? (
              <>
                <svg className="animate-check-pop" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {ru.product.added}
              </>
            ) : inCart ? (
              ru.product.goToCart
            ) : selectedSize ? (
              ru.product.addToCart
            ) : (
              ru.product.selectSize
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate("/cart")}
            className="press flex h-12 items-center justify-center rounded-button bg-surface px-5 text-[15px] font-medium text-ink"
          >
            {ru.nav.cart}
          </button>
        </div>
      </div>

      <div className="h-16" />

      {viewerOpen && hasVariantImages && (
        <FullscreenImageViewer
          images={variantImages}
          initialIndex={viewerIndex}
          alt={product.name}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {sizeChartOpen && product.sizeChartUrl && (
        <SizeChartModal
          imageUrl={product.sizeChartUrl}
          onClose={() => setSizeChartOpen(false)}
        />
      )}
    </div>
  );
}
