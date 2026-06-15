import { PrismaClient } from "@prisma/client";
import { SIZES } from "../src/constants.js";

const prisma = new PrismaClient();

type SeedSize = { label: (typeof SIZES)[number]; stock: number };

type SeedProduct = {
  sku: string;
  name: string;
  description: string;
  // цена в рублях (в БД сохраняется в копейках)
  priceRub: number;
  category: string;
  // ключи изображений для генерации галереи (несколько фото на товар)
  imageSeeds: string[];
  badge?: "NEW" | "BESTSELLER" | "LIMITED";
  composition: string;
  fabricDensity: string;
  modelHeight: number;
  modelSize: (typeof SIZES)[number];
  sizes: SeedSize[];
};

// Демонстрационные фото (несколько на товар) — для галереи с листанием.
function imageUrls(seeds: string[]): string[] {
  return seeds.map((s) => `https://picsum.photos/seed/${s}/800/1000`);
}

const products: SeedProduct[] = [
  {
    sku: "TSH-OVR-001",
    name: "Базовая футболка Oversize",
    description:
      "Свободный крой oversize из плотного хлопка. Универсальная база на каждый день, хорошо держит форму после стирки.",
    priceRub: 1990,
    category: "Футболки",
    imageSeeds: ["karlo-ovr-1", "karlo-ovr-2", "karlo-ovr-3", "karlo-ovr-4"],
    badge: "NEW",
    composition: "100% хлопок",
    fabricDensity: "190 г/м²",
    modelHeight: 182,
    modelSize: "L",
    sizes: [
      { label: "S", stock: 8 },
      { label: "M", stock: 12 },
      { label: "L", stock: 6 },
      { label: "XL", stock: 3 },
    ],
  },
  {
    sku: "TSH-HVY-002",
    name: "Футболка Heavy Cotton",
    description:
      "Тяжёлый хлопок премиального качества, не просвечивает, держит насыщенный цвет. Прямой силуэт.",
    priceRub: 2490,
    category: "Футболки",
    imageSeeds: ["karlo-hvy-1", "karlo-hvy-2", "karlo-hvy-3"],
    badge: "BESTSELLER",
    composition: "100% хлопок",
    fabricDensity: "240 г/м²",
    modelHeight: 178,
    modelSize: "M",
    sizes: [
      { label: "S", stock: 5 },
      { label: "M", stock: 10 },
      { label: "L", stock: 9 },
      { label: "XL", stock: 0 },
    ],
  },
  {
    sku: "TSH-PRM-003",
    name: "Футболка Premium Black",
    description:
      "Глубокий чёрный цвет, мягкий пенье-хлопок и аккуратные плоские швы. Минималистичная посадка по фигуре.",
    priceRub: 2790,
    category: "Футболки",
    imageSeeds: ["karlo-prm-1", "karlo-prm-2", "karlo-prm-3", "karlo-prm-4"],
    badge: "LIMITED",
    composition: "95% хлопок, 5% эластан",
    fabricDensity: "210 г/м²",
    modelHeight: 185,
    modelSize: "L",
    sizes: [
      { label: "S", stock: 4 },
      { label: "M", stock: 7 },
      { label: "L", stock: 7 },
      { label: "XL", stock: 5 },
    ],
  },
  {
    sku: "HOD-ZIP-004",
    name: "Худи на молнии Street",
    description:
      "Утеплённый футер с начёсом, объёмный капюшон на кулиске и карманы-кенгуру. Тёплое и износостойкое.",
    priceRub: 4990,
    category: "Худи",
    imageSeeds: ["karlo-hod-1", "karlo-hod-2", "karlo-hod-3"],
    composition: "80% хлопок, 20% полиэстер",
    fabricDensity: "330 г/м²",
    modelHeight: 180,
    modelSize: "M",
    sizes: [
      { label: "S", stock: 6 },
      { label: "M", stock: 8 },
      { label: "L", stock: 4 },
      { label: "XL", stock: 2 },
    ],
  },
  {
    sku: "SWT-CRW-005",
    name: "Свитшот Basic Grey",
    description:
      "Классический свитшот серого меланжа из мягкого футера. Лаконичная модель, которая сочетается с чем угодно.",
    priceRub: 3490,
    category: "Свитшоты",
    imageSeeds: ["karlo-swt-1", "karlo-swt-2", "karlo-swt-3", "karlo-swt-4"],
    badge: "NEW",
    composition: "70% хлопок, 30% полиэстер",
    fabricDensity: "280 г/м²",
    modelHeight: 176,
    modelSize: "S",
    sizes: [
      { label: "S", stock: 9 },
      { label: "M", stock: 11 },
      { label: "L", stock: 6 },
      { label: "XL", stock: 4 },
    ],
  },
  {
    sku: "TSH-LNG-006",
    name: "Лонгслив Cotton Comfort",
    description:
      "Лонгслив прямого кроя из гладкого хлопка с эластаном. Приятно облегает и не сковывает движения.",
    priceRub: 2290,
    category: "Лонгсливы",
    imageSeeds: ["karlo-lng-1", "karlo-lng-2", "karlo-lng-3"],
    composition: "92% хлопок, 8% эластан",
    fabricDensity: "200 г/м²",
    modelHeight: 183,
    modelSize: "L",
    sizes: [
      { label: "S", stock: 7 },
      { label: "M", stock: 9 },
      { label: "L", stock: 5 },
      { label: "XL", stock: 6 },
    ],
  },
];

const paymentAccounts: {
  bankName: string;
  recipientName: string;
  phoneNumber: string;
}[] = [
  { bankName: "Сбер", recipientName: "Иван П.", phoneNumber: "+7 (900) 100-10-01" },
  { bankName: "ВТБ", recipientName: "Иван П.", phoneNumber: "+7 (900) 100-10-02" },
  { bankName: "Альфа-Банк", recipientName: "Иван П.", phoneNumber: "+7 (900) 100-10-03" },
  { bankName: "Т-Банк", recipientName: "Иван П.", phoneNumber: "+7 (900) 100-10-04" },
  { bankName: "Газпромбанк", recipientName: "Иван П.", phoneNumber: "+7 (900) 100-10-05" },
  { bankName: "Ozon Банк", recipientName: "Иван П.", phoneNumber: "+7 (900) 100-10-06" },
  { bankName: "WB Банк", recipientName: "Иван П.", phoneNumber: "+7 (900) 100-10-07" },
];

async function main() {
  console.log("[seed] Очистка существующих данных…");
  await prisma.paymentProof.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.productSize.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.paymentAccount.deleteMany();

  console.log(`[seed] Добавление платёжных реквизитов: ${paymentAccounts.length}`);
  for (const account of paymentAccounts) {
    await prisma.paymentAccount.create({
      data: { ...account, isActive: true },
    });
  }

  console.log(`[seed] Добавление товаров: ${products.length}`);
  let position = 0;
  for (const product of products) {
    const images = imageUrls(product.imageSeeds);
    await prisma.product.create({
      data: {
        sku: product.sku,
        position: position++,
        name: product.name,
        description: product.description,
        price: product.priceRub * 100,
        currency: "RUB",
        category: product.category,
        imageUrl: images[0],
        imagesJson: JSON.stringify(images),
        badge: product.badge ?? null,
        composition: product.composition,
        fabricDensity: product.fabricDensity,
        modelHeight: product.modelHeight,
        modelSize: product.modelSize,
        isActive: true,
        sizes: {
          create: product.sizes.map((size) => ({
            label: size.label,
            stock: size.stock,
          })),
        },
      },
    });
  }

  console.log("[seed] Готово.");
}

main()
  .catch((error) => {
    console.error("[seed] Ошибка:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
