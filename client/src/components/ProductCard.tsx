import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CatalogItem } from "../lib/catalog";
import { PRODUCT_BADGE_LABELS, type ProductBadge, type Size } from "../constants";
import { ru } from "../i18n/ru";
import { formatPrice } from "../lib/format";
import { useCart } from "../cart/CartContext";
import { useToast } from "./Toast";
import { hapticImpact, hapticNotify, hapticSelection } from "../telegram/webapp";
import ImageGallery from "./ImageGallery";
import ColorSwatch from "./ColorSwatch";

interface Props {
  item: CatalogItem;
  showColor?: boolean;
}

export default function ProductCard({ item, showColor = true }: Props) {
  const { product, variant } = item;
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { show } = useToast();

  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [addedSize, setAddedSize] = useState<Size | null>(null);
  const [flash, setFlash] = useState(false);

  const variantPrice = variant.price ?? product.price;
  const variantImages = variant.images.length > 0 ? variant.images : product.images;

  const open = () =>
    navigate(`/product/${product.id}?variant=${encodeURIComponent(variant.id)}`);
  const badge = product.badge as ProductBadge | null;
  const badgeLabel = badge && PRODUCT_BADGE_LABELS[badge] ? PRODUCT_BADGE_LABELS[badge] : null;

  const inCart = addedSize !== null && addedSize === selectedSize;

  const selectSize = (size: Size, disabled: boolean) => {
    if (disabled) return;
    hapticSelection();
    setSelectedSize((cur) => (cur === size ? null : size));
  };

  const handleAdd = () => {
    if (inCart) {
      navigate("/cart");
      return;
    }
    if (!selectedSize) return;
    const ok = addItem(product, selectedSize, 1, variant.id);
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

  return (
    <div className="group flex flex-col rounded-card bg-card p-2 shadow-card">
      <div className="relative">
        <ImageGallery images={variantImages} alt={product.name} onTap={open} aspect="4/5" />
        {badgeLabel && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink shadow-card backdrop-blur">
            {badgeLabel}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-0.5 pt-3">
        <button
          type="button"
          onClick={open}
          className="press text-left text-[13px] font-medium leading-snug text-ink line-clamp-2"
        >
          {product.name}
        </button>

        {showColor && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <ColorSwatch name={variant.name} colorHex={variant.colorHex} size={12} />
            <span>{variant.name}</span>
          </p>
        )}

        <p className="mt-1 text-sm font-semibold text-ink">{formatPrice(variantPrice)}</p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {variant.sizes.map((s) => {
            const disabled = s.stock <= 0;
            const active = selectedSize === s.label;
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => selectSize(s.label, disabled)}
                className={[
                  "press h-7 min-w-[30px] rounded-chip px-1.5 text-xs font-medium",
                  disabled
                    ? "cursor-not-allowed text-muted/60 line-through"
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

        <button
          type="button"
          onClick={handleAdd}
          disabled={!selectedSize}
          className={[
            "press mt-2.5 flex h-9 items-center justify-center gap-1.5 rounded-button text-[13px] font-semibold transition-colors",
            !selectedSize
              ? "cursor-not-allowed bg-surface text-muted"
              : flash
                ? "bg-emerald-600 text-white"
                : "bg-ink text-white",
          ].join(" ")}
        >
          {flash ? (
            <>
              <svg className="animate-check-pop" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
      </div>
    </div>
  );
}
