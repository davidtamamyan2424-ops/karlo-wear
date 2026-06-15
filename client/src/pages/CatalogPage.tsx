import { useEffect, useState } from "react";
import { fetchProducts } from "../api/endpoints";
import type { Product } from "../types";
import { ru } from "../i18n/ru";
import ProductCard from "../components/ProductCard";

function Skeleton() {
  return (
    <div className="flex flex-col">
      <div className="aspect-[4/5] w-full animate-pulse rounded-card bg-surface" />
      <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-surface" />
      <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-surface" />
    </div>
  );
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setError(ru.common.error));
  }, []);

  return (
    <div className="animate-fade-in">
      <header className="px-1 pb-5 pt-1">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">
          {ru.catalog.title}
        </h1>
        <p className="mt-1 text-sm text-muted">Новая коллекция</p>
      </header>

      {error && <p className="py-8 text-center text-sm text-red-600">{error}</p>}

      {!products && !error && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-7">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} />
          ))}
        </div>
      )}

      {products && products.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">{ru.catalog.empty}</p>
      )}

      {products && products.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-7">
          {products.map((product, i) => (
            <div
              key={product.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
