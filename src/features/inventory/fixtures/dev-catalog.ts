import { normalizePortugueseText } from "@/features/inventory/parser/normalization";
import type {
  InventoryCatalog,
  Lot,
  PackagingConversion,
  Product
} from "@/types/inventory";

const now = "2026-09-02T12:00:00-03:00";

const UNIT_ALIASES = [
  "unidade",
  "unidades",
  "un",
  "unds",
  "garrafa",
  "garrafas",
  "pet",
  "pets",
  "lata",
  "latas",
  "latinha",
  "latinhas"
];
const FARDO_ALIASES = ["fardo", "fardos", "fd", "pack", "packs"];
const PACOTE_ALIASES = ["pacote", "pacotes", "pct"];

function alias(id: string, productId: string, value: string) {
  return {
    id,
    productId,
    value,
    normalizedValue: normalizePortugueseText(value),
    createdAt: now
  };
}

function product(
  id: string,
  name: string,
  aliases: readonly string[]
): Product {
  return {
    id,
    name,
    baseUnitLabel: "unidade",
    isActive: true,
    aliases: aliases.map((value) => alias(`alias-${id}-${slug(value)}`, id, value)),
    createdAt: now,
    updatedAt: now
  };
}

function conversion(
  productId: string,
  packagingType: string,
  multiplier: number,
  aliases: readonly string[]
): PackagingConversion {
  return {
    id: `conversion-${productId.replace(/^product-/u, "")}-${slug(packagingType)}`,
    productId,
    packagingType,
    multiplier,
    aliases,
    createdAt: now,
    updatedAt: now
  };
}

export const devProducts: readonly Product[] = [
  product("product-coca-cola-2l", "Coca-Cola 2L", [
    "coca 2l",
    "coca 2 l",
    "coca 2 litros",
    "coca cola 2l",
    "coca cola 2 l",
    "coca-cola 2 litros",
    "coca grande",
    "coca"
  ]),
  product("product-coca-cola-lata", "Coca-Cola Lata", [
    "coca lata",
    "coca latinha",
    "coca cola lata",
    "coca cola latinha",
    "lata de coca",
    "latinha de coca",
    "coca"
  ]),
  product("product-coca-cola-zero-lata", "Coca-Cola Zero Lata", [
    "coca zero lata",
    "coca zero latinha",
    "coca cola zero lata",
    "coca-cola zero lata",
    "lata de coca zero",
    "latinha de coca zero"
  ]),
  product("product-fanta-guarana-2l", "Fanta Guaraná 2L", [
    "fanta guarana 2l",
    "fanta guarana 2 l",
    "fanta guarana 2 litros",
    "guarana fanta 2l",
    "guarana fanta 2 l",
    "guarana 2l",
    "guarana 2 l",
    "guarana 2 litros",
    "fanta guarana"
  ]),
  product("product-fanta-uva-2l", "Fanta Uva 2L", [
    "fanta uva 2l",
    "fanta uva 2 l",
    "fanta uva 2 litros",
    "uva fanta 2l",
    "uva 2l",
    "uva 2 l",
    "uva 2 litros",
    "fanta uva"
  ]),
  product("product-fanta-laranja-2l", "Fanta Laranja 2L", [
    "fanta laranja 2l",
    "fanta laranja 2 l",
    "fanta laranja 2 litros",
    "laranja fanta 2l",
    "laranja 2l",
    "laranja 2 l",
    "laranja 2 litros",
    "fanta laranja"
  ]),
  product("product-fanta-guarana-lata", "Fanta Guaraná Lata", [
    "fanta guarana lata",
    "fanta guarana latinha",
    "guarana fanta lata",
    "guarana lata",
    "guarana latinha",
    "lata de fanta guarana",
    "latinha de fanta guarana",
    "fanta guarana"
  ]),
  product("product-fanta-uva-lata", "Fanta Uva Lata", [
    "fanta uva lata",
    "fanta uva latinha",
    "uva fanta lata",
    "uva lata",
    "uva latinha",
    "lata de fanta uva",
    "latinha de fanta uva",
    "fanta uva"
  ]),
  product("product-fanta-laranja-lata", "Fanta Laranja Lata", [
    "fanta laranja lata",
    "fanta laranja latinha",
    "laranja fanta lata",
    "laranja lata",
    "laranja latinha",
    "lata de fanta laranja",
    "latinha de fanta laranja",
    "fanta laranja"
  ]),
  product("product-sprite-lata", "Sprite Lata", [
    "sprite lata",
    "sprite latinha",
    "lata de sprite",
    "latinha de sprite",
    "sprite normal lata",
    "split lata",
    "split latinha",
    "split normal lata",
    "sprite"
  ]),
  product("product-sprite-zero-lata", "Sprite Zero Lata", [
    "sprite zero lata",
    "sprite zero latinha",
    "lata de sprite zero",
    "latinha de sprite zero",
    "sprite sem acucar lata",
    "split zero lata",
    "split zero latinha",
    "split sem acucar lata",
    "sprite zero"
  ]),
  product("product-del-valle-uva", "Suco Del Valle Uva", [
    "suco del valle uva",
    "del valle uva",
    "del valle de uva",
    "suco uva del valle",
    "suco de uva del valle"
  ]),
  product("product-del-valle-laranja", "Suco Del Valle Laranja", [
    "suco del valle laranja",
    "del valle laranja",
    "del valle de laranja",
    "suco laranja del valle",
    "suco de laranja del valle"
  ]),
  product("product-agua-mineral-600ml", "Água Mineral 600ml", [
    "agua 600ml",
    "agua 600 ml",
    "agua mineral 600ml",
    "agua mineral 600 ml",
    "agua garrafa 600ml",
    "agua"
  ])
];

const twoLiterProductIds = [
  "product-coca-cola-2l",
  "product-fanta-guarana-2l",
  "product-fanta-uva-2l",
  "product-fanta-laranja-2l"
];

const sodaCanProductIds = [
  "product-coca-cola-lata",
  "product-coca-cola-zero-lata",
  "product-fanta-guarana-lata",
  "product-fanta-uva-lata",
  "product-fanta-laranja-lata",
  "product-sprite-lata",
  "product-sprite-zero-lata"
];

export const devPackagingConversions: readonly PackagingConversion[] = [
  ...twoLiterProductIds.flatMap((productId) => [
    conversion(productId, "unidade", 1, UNIT_ALIASES),
    conversion(productId, "fardo", 6, FARDO_ALIASES)
  ]),
  ...sodaCanProductIds.flatMap((productId) => [
    conversion(productId, "unidade", 1, UNIT_ALIASES),
    conversion(productId, "fardo", 12, FARDO_ALIASES)
  ]),
  conversion("product-del-valle-uva", "unidade", 1, UNIT_ALIASES),
  conversion("product-del-valle-laranja", "unidade", 1, UNIT_ALIASES),
  conversion("product-agua-mineral-600ml", "unidade", 1, UNIT_ALIASES),
  conversion("product-agua-mineral-600ml", "fardo", 12, [
    ...FARDO_ALIASES,
    ...PACOTE_ALIASES
  ])
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
  },
  {
    id: "lot-agua-2026-09-20",
    productId: "product-agua-mineral-600ml",
    expirationDate: "2026-09-20",
    originalQuantity: 96,
    currentQuantity: 96,
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

function slug(value: string) {
  return normalizePortugueseText(value).replace(/\s+/gu, "-");
}
