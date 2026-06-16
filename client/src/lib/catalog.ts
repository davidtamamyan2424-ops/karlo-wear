import type { Product, ProductVariant } from "../types";

export interface CatalogItem {
  key: string;
  product: Product;
  variant: ProductVariant;
}

/** Разворачивает товары в карточки каталога — по одной на каждый цветовой вариант. */
export function expandCatalog(products: Product[]): CatalogItem[] {
  const items: CatalogItem[] = [];
  for (const product of products) {
    for (const variant of product.variants) {
      items.push({
        key: `${product.id}__${variant.id}`,
        product,
        variant,
      });
    }
  }
  return items;
}
