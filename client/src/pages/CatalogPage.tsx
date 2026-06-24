import { useEffect, useMemo, useState } from "react";
import { fetchProducts } from "../api/endpoints";
import { ru } from "../i18n/ru";
import ProductCard from "../components/ProductCard";
import PromoCarousel from "../components/PromoCarousel";
import { expandCatalog } from "../lib/catalog";

function Skeleton() {
  return (
    <div className="flex flex-col rounded-card bg-card p-2 shadow-card">
      <div className="aspect-[4/5] w-full animate-pulse rounded-card bg-surface" />
      <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-surface" />
      <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-surface" />
    </div>
  );
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Awaited<ReturnType<typeof fetchProducts>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setError(ru.common.error));
  }, []);

  const catalogItems = useMemo(
    () => (products ? expandCatalog(products) : []),
    [products],
  );

  const multiColorProducts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products ?? []) {
      counts.set(product.id, product.variants.length);
    }
    return counts;
  }, [products]);

  return (
    <div className="animate-fade-in">
      <header className="px-1 pb-2 pt-1">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">
          {ru.catalog.title}
        </h1>
        <p className="mt-1 text-sm text-muted">Новая коллекция</p>
      </header>

      <PromoCarousel />

      {error && <p className="py-8 text-center text-sm text-red-600">{error}</p>}

      {!products && !error && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-7">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} />
          ))}
        </div>
      )}

      {products && catalogItems.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">{ru.catalog.empty}</p>
      )}

      {catalogItems.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-7">
          {catalogItems.map((item, i) => (
            <div
              key={item.key}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}
            >
              <ProductCard
                item={item}
                showColor={(multiColorProducts.get(item.product.id) ?? 0) > 1}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
