export type ProductId = string;
export type LotId = string;

export type UnitKind = "unit" | "package";

export type ProductSeed = Readonly<{
  name: string;
  baseUnitLabel: string;
}>;

export type LotSeed = Readonly<{
  productId: ProductId;
  expiresAt: string;
  quantityInBaseUnits: number;
}>;

export type PackagingConversionSeed = Readonly<{
  productId: ProductId;
  packageLabel: string;
  unitsPerPackage: number;
}>;
