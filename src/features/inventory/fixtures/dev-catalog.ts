import { normalizePortugueseText } from "@/features/inventory/parser/normalization";
import type {
  InventoryCatalog,
  Lot,
  PackagingConversion,
  Product
} from "@/types/inventory";

const now = "2026-09-02T12:00:00-03:00";

function alias(id: string, productId: string, value: string) {
  return {
    id,
    productId,
    value,
    normalizedValue: normalizePortugueseText(value),
    createdAt: now
  };
}

export const devProducts: readonly Product[] = [
  {
    id: "product-coca-cola-2l",
    name: "Coca-Cola 2L",
    baseUnitLabel: "unidade",
    isActive: true,
    aliases: [
      alias("alias-coca-2l", "product-coca-cola-2l", "coca 2l"),
      alias("alias-coca-2-litros", "product-coca-cola-2l", "coca 2 litros"),
      alias("alias-coca-cola-2l", "product-coca-cola-2l", "coca cola 2l"),
      alias(
        "alias-coca-cola-2-litros",
        "product-coca-cola-2l",
        "coca-cola 2 litros"
      ),
      alias("alias-coca-grande", "product-coca-cola-2l", "coca grande")
    ],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "product-coca-cola-lata",
    name: "Coca-Cola Lata",
    baseUnitLabel: "unidade",
    isActive: true,
    aliases: [
      alias("alias-coca-lata", "product-coca-cola-lata", "coca lata"),
      alias("alias-coca-cola-lata", "product-coca-cola-lata", "coca cola lata")
    ],
    createdAt: now,
    updatedAt: now
  }
];

export const devPackagingConversions: readonly PackagingConversion[] = [
  {
    id: "conversion-coca-2l-unidade",
    productId: "product-coca-cola-2l",
    packagingType: "unidade",
    multiplier: 1,
    aliases: ["unidade", "unidades", "un", "unds"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "conversion-coca-2l-fardo",
    productId: "product-coca-cola-2l",
    packagingType: "fardo",
    multiplier: 6,
    aliases: ["fardo", "fardos", "fd"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "conversion-coca-lata-unidade",
    productId: "product-coca-cola-lata",
    packagingType: "unidade",
    multiplier: 1,
    aliases: ["unidade", "unidades", "un", "unds"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "conversion-coca-lata-fardo",
    productId: "product-coca-cola-lata",
    packagingType: "fardo",
    multiplier: 12,
    aliases: ["fardo", "fardos", "fd"],
    createdAt: now,
    updatedAt: now
  }
];

export const devLots: readonly Lot[] = [
  {
    id: "lot-coca-2l-2026-09-10",
    productId: "product-coca-cola-2l",
    expirationDate: "2026-09-10",
    originalQuantity: 30,
    currentQuantity: 30,
    status: "OPEN",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "lot-coca-2l-2026-11-04",
    productId: "product-coca-cola-2l",
    expirationDate: "2026-11-04",
    originalQuantity: 60,
    currentQuantity: 60,
    status: "OPEN",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "lot-coca-lata-2026-10-10",
    productId: "product-coca-cola-lata",
    expirationDate: "2026-10-10",
    originalQuantity: 120,
    currentQuantity: 120,
    status: "OPEN",
    createdAt: now,
    updatedAt: now
  }
];

export const devInventoryCatalog: InventoryCatalog = {
  products: devProducts,
  packagingConversions: devPackagingConversions,
  lots: devLots
};
