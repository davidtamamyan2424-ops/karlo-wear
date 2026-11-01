import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Safely consolidate color-specific product cards into one card per model.
 * Dry-run by default. Run after a PostgreSQL backup, with --apply to commit.
 * Source product rows remain archived so historical orders and sales keep their product IDs.
 */
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const GROUPS = [
  "«Наследие» оверсайз худи unisex",
  "«Saw» оверсайз худи unisex",
  "«Hope» оверсайз худи unisex",
  "«Диагональ» оверсайз худи unisex",
  "«Наследие» свободные брюки unisex",
  "«Saw» свободные брюки unisex",
];

async function main() {
  const products = await prisma.product.findMany({
    where: { archived: false },
    include: { variants: { include: { sizes: true }, orderBy: { position: "asc" } } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  let changes = 0;
  for (const name of GROUPS) {
    const group = products.filter(p => p.name.trim().toLowerCase() === name.toLowerCase());
    if (group.length < 2) { console.log("SKIP", name, group.length); continue; }
    const [target, ...sources] = group;
    const variants = group.flatMap(p => p.variants.map(v => ({ ...v, owner: p.id })));
    // Fail closed: never guess colors, merge same-color stock or overwrite any historical data.
    if (group.some(p => p.variants.length !== 1)) {
      throw new Error(name + ": expected exactly one color variant per original product; manual review required");
    }
    const colors = variants.map(v => v.name.trim().toLowerCase());
    if (colors.some(c => !c || c === "базовый цвет") || new Set(colors).size !== colors.length) {
      throw new Error(name + ": missing or repeated color name; manual review required");
    }
    const prices = new Set(group.map(p => p.price));
    if (prices.size !== 1) throw new Error(name + ": different prices; manual review required");
    console.log(name, "=>", target.id, "colors:", variants.map(v => v.name).join(", "),
      "stock:", variants.map(v => v.sizes.reduce((n,s) => n+s.stock,0)).join("+"));
    changes += sources.length;
    if (!APPLY) continue;
    await prisma.$transaction(async tx => {
      const current = await tx.product.findMany({
        where: { id: { in: group.map(p => p.id) } },
        include: { variants: { include: { sizes: true } } },
      });
      if (current.length !== group.length || current.some(p => p.archived || p.variants.length !== 1)) {
        throw new Error(name + ": data changed during merge; aborting");
      }
      const currentColors = current.map(p => p.variants[0].name.trim().toLowerCase());
      if (new Set(currentColors).size !== currentColors.length ||
          currentColors.some(c => !c || c === "базовый цвет")) {
        throw new Error(name + ": conflicting colors; aborting");
      }
      let position = 1;
      for (const source of sources) {
        await tx.productVariant.update({
          where: { id: source.variants[0].id },
          data: { productId: target.id, position: position++, isDefault: false },
        });
        // Archive, never delete: old order and manual-sale relations still reference this product.
        await tx.product.update({
          where: { id: source.id },
          data: { archived: true, isActive: false },
        });
      }
      await tx.productVariant.update({
        where: { id: target.variants[0].id },
        data: { position: 0, isDefault: true },
      });
    });
  }
  console.log(APPLY ? "Merged source cards:" : "Dry-run: cards that would be archived:", changes);
}
main().catch(e => { console.error(e); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
