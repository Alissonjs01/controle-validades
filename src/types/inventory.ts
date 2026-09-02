export type ProductId = string;
export type ProductAliasId = string;
export type PackagingConversionId = string;
export type PackagingAliasId = string;
export type LotId = string;
export type InventoryMovementId = string;

export type IsoDate = `${number}-${number}-${number}`;
export type IsoDateTime = string;

export type UnitKind = "unit" | "package";
export type LotStatus = "OPEN" | "ZEROED" | "CLOSED";
export type InventoryMovementType = "ENTRY" | "EXIT" | "ZERO" | "ADJUSTMENT";

export type ProductAlias = Readonly<{
  id: ProductAliasId;
  productId: ProductId;
  value: string;
  normalizedValue: string;
  createdAt: IsoDateTime;
}>;

export type Product = Readonly<{
  id: ProductId;
  name: string;
  baseUnitLabel: string;
  isActive: boolean;
  aliases: readonly ProductAlias[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type PackagingConversion = Readonly<{
  id: PackagingConversionId;
  productId: ProductId;
  packagingType: string;
  multiplier: number;
  aliases: readonly string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type Lot = Readonly<{
  id: LotId;
  productId: ProductId;
  expirationDate: IsoDate;
  originalQuantity: number;
  currentQuantity: number;
  status: LotStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type InventoryMovement = Readonly<{
  id: InventoryMovementId;
  type: InventoryMovementType;
  productId: ProductId;
  lotId: LotId | null;
  quantityDelta: number;
  quantityBefore: number | null;
  quantityAfter: number | null;
  sourceText: string | null;
  metadata: Record<string, unknown>;
  occurredAt: IsoDateTime;
  createdAt: IsoDateTime;
}>;

export type InventoryCatalog = Readonly<{
  products: readonly Product[];
  packagingConversions: readonly PackagingConversion[];
  lots: readonly Lot[];
}>;
