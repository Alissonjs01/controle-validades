import { applyConfirmedMovement } from "@/features/inventory/domain/movements";
import { devInventoryCatalog } from "@/features/inventory/fixtures/dev-catalog";
import {
  defaultAlertPreferences,
  type AlertDeliveryRecord,
  type AlertPreferences
} from "@/features/inventory/notifications/alerts";
import type {
  InventoryCatalog,
  InventoryMovement,
  InventoryMovementType,
  IsoDate,
  Lot,
  LotId,
  PackagingConversion,
  PackagingConversionId,
  Product,
  ProductId
} from "@/types/inventory";

const STORAGE_KEY = "controle-validades:inventory:v1";

export type InventoryStoreState = InventoryCatalog &
  Readonly<{
    movements: readonly InventoryMovement[];
    alertPreferences: AlertPreferences;
    alertDeliveries: readonly AlertDeliveryRecord[];
  }>;

export type ManualLotInput = Readonly<{
  productId: ProductId;
  conversionId: PackagingConversionId;
  enteredQuantity: number;
  expirationDate: IsoDate;
  sourceText: string | null;
}>;

export type EntryIntentInput = Readonly<{
  productId: ProductId;
  expirationDate: IsoDate;
  baseQuantity: number;
  sourceText: string;
  metadata: Record<string, unknown>;
}>;

export type MovementIntentInput = Readonly<{
  type: Extract<InventoryMovementType, "EXIT" | "ZERO">;
  productId: ProductId;
  lotId: LotId;
  baseQuantity: number;
  sourceText: string;
  metadata: Record<string, unknown>;
}>;

export type LotEditInput = Readonly<{
  lotId: LotId;
  productId: ProductId;
  currentQuantity: number;
  expirationDate: IsoDate;
}>;

export function createInitialInventoryState(): InventoryStoreState {
  return {
    ...devInventoryCatalog,
    lots: devInventoryCatalog.lots.map((lot) => ({ ...lot })),
    alertPreferences: defaultAlertPreferences,
    alertDeliveries: [],
    movements: [
      createMovement({
        type: "ENTRY",
        productId: "product-coca-cola-2l",
        lotId: "lot-coca-2l-2026-09-10",
        quantityDelta: 30,
        quantityBefore: 0,
        quantityAfter: 30,
        sourceText: "Estoque inicial",
        occurredAt: "2026-09-02T09:00:00-03:00"
      }),
      createMovement({
        type: "ENTRY",
        productId: "product-coca-cola-2l",
        lotId: "lot-coca-2l-2026-11-04",
        quantityDelta: 60,
        quantityBefore: 0,
        quantityAfter: 60,
        sourceText: "Estoque inicial",
        occurredAt: "2026-09-02T09:05:00-03:00"
      }),
      createMovement({
        type: "ENTRY",
        productId: "product-coca-cola-lata",
        lotId: "lot-coca-lata-2026-10-10",
        quantityDelta: 120,
        quantityBefore: 0,
        quantityAfter: 120,
        sourceText: "Estoque inicial",
        occurredAt: "2026-09-02T09:10:00-03:00"
      })
    ]
  };
}

export function loadInventoryState() {
  if (typeof window === "undefined") {
    return createInitialInventoryState();
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return createInitialInventoryState();
  }

  try {
    return hydrateStoredState(JSON.parse(stored) as Partial<InventoryStoreState>);
  } catch {
    return createInitialInventoryState();
  }
}

export function saveInventoryState(state: InventoryStoreState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function addEntryLot(
  state: InventoryStoreState,
  input: EntryIntentInput
): InventoryStoreState {
  const now = new Date().toISOString();
  const lot: Lot = {
    id: createId("lot"),
    productId: input.productId,
    expirationDate: input.expirationDate,
    originalQuantity: input.baseQuantity,
    currentQuantity: input.baseQuantity,
    status: input.baseQuantity === 0 ? "ZEROED" : "OPEN",
    createdAt: now,
    updatedAt: now
  };
  const movement = createMovement({
    type: "ENTRY",
    productId: input.productId,
    lotId: lot.id,
    quantityDelta: input.baseQuantity,
    quantityBefore: 0,
    quantityAfter: input.baseQuantity,
    sourceText: input.sourceText,
    occurredAt: now,
    metadata: input.metadata
  });

  return {
    ...state,
    lots: [...state.lots, lot],
    movements: [movement, ...state.movements]
  };
}

export function addManualLot(
  state: InventoryStoreState,
  input: ManualLotInput
): InventoryStoreState {
  const conversion = state.packagingConversions.find(
    (item) => item.id === input.conversionId && item.productId === input.productId
  );

  if (!conversion) {
    throw new Error("Conversão de embalagem não encontrada.");
  }

  return addEntryLot(state, {
    productId: input.productId,
    expirationDate: input.expirationDate,
    baseQuantity: input.enteredQuantity * conversion.multiplier,
    sourceText: input.sourceText ?? "Cadastro manual",
    metadata: {
      enteredQuantity: input.enteredQuantity,
      packaging: conversion.packagingType,
      multiplier: conversion.multiplier
    }
  });
}

export function applyInventoryMovement(
  state: InventoryStoreState,
  input: MovementIntentInput
): InventoryStoreState {
  const lot = state.lots.find((item) => item.id === input.lotId);

  if (!lot) {
    throw new Error("Lote não encontrado.");
  }

  const application = applyConfirmedMovement(lot, {
    id: createId("movement"),
    type: input.type,
    productId: input.productId,
    lotId: input.lotId,
    quantityDelta: input.type === "ZERO" ? 0 : -input.baseQuantity,
    sourceText: input.sourceText,
    metadata: input.metadata,
    occurredAt: new Date().toISOString()
  });

  return {
    ...state,
    lots: state.lots.map((item) =>
      item.id === application.lot.id ? application.lot : item
    ),
    movements: [application.movement, ...state.movements]
  };
}

export function editLot(
  state: InventoryStoreState,
  input: LotEditInput
): InventoryStoreState {
  const lot = state.lots.find((item) => item.id === input.lotId);

  if (!lot) {
    throw new Error("Lote não encontrado.");
  }

  if (input.currentQuantity < 0) {
    throw new Error("Quantidade não pode ser negativa.");
  }

  const now = new Date().toISOString();
  const updatedLot: Lot = {
    ...lot,
    productId: input.productId,
    expirationDate: input.expirationDate,
    currentQuantity: input.currentQuantity,
    status: input.currentQuantity === 0 ? "ZEROED" : "OPEN",
    updatedAt: now
  };
  const movement = createMovement({
    type: "ADJUSTMENT",
    productId: input.productId,
    lotId: lot.id,
    quantityDelta: input.currentQuantity - lot.currentQuantity,
    quantityBefore: lot.currentQuantity,
    quantityAfter: input.currentQuantity,
    sourceText: "Edição manual do lote",
    occurredAt: now,
    metadata: {
      previousProductId: lot.productId,
      previousExpirationDate: lot.expirationDate,
      expirationDate: input.expirationDate
    }
  });

  return {
    ...state,
    lots: state.lots.map((item) => (item.id === lot.id ? updatedLot : item)),
    movements: [movement, ...state.movements]
  };
}

export function updateAlertPreferences(
  state: InventoryStoreState,
  alertPreferences: AlertPreferences
): InventoryStoreState {
  return {
    ...state,
    alertPreferences
  };
}

export function recordAlertDeliveries(
  state: InventoryStoreState,
  alertDeliveries: readonly AlertDeliveryRecord[]
): InventoryStoreState {
  if (alertDeliveries.length === 0) {
    return state;
  }

  const knownIds = new Set(state.alertDeliveries.map((delivery) => delivery.id));
  const newDeliveries = alertDeliveries.filter(
    (delivery) => !knownIds.has(delivery.id)
  );

  if (newDeliveries.length === 0) {
    return state;
  }

  return {
    ...state,
    alertDeliveries: [...newDeliveries, ...state.alertDeliveries]
  };
}

function createMovement(input: {
  type: InventoryMovementType;
  productId: ProductId;
  lotId: LotId;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  sourceText: string | null;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}): InventoryMovement {
  return {
    id: createId("movement"),
    type: input.type,
    productId: input.productId,
    lotId: input.lotId,
    quantityDelta: input.quantityDelta,
    quantityBefore: input.quantityBefore,
    quantityAfter: input.quantityAfter,
    sourceText: input.sourceText,
    metadata: input.metadata ?? {},
    occurredAt: input.occurredAt,
    createdAt: input.occurredAt
  };
}

function hydrateStoredState(
  stored: Partial<InventoryStoreState>
): InventoryStoreState {
  const initial = createInitialInventoryState();

  return {
    ...initial,
    ...stored,
    products: mergeBaselineItems(initial.products, stored.products),
    packagingConversions: mergeBaselineItems(
      initial.packagingConversions,
      stored.packagingConversions
    ),
    lots: stored.lots ?? initial.lots,
    movements: stored.movements ?? initial.movements,
    alertPreferences: stored.alertPreferences ?? defaultAlertPreferences,
    alertDeliveries: stored.alertDeliveries ?? []
  };
}

function mergeBaselineItems<T extends Product | PackagingConversion>(
  baseline: readonly T[],
  stored: readonly T[] | undefined
) {
  if (!stored) {
    return baseline;
  }

  const baselineIds = new Set(baseline.map((item) => item.id));
  const storedExtras = stored.filter((item) => !baselineIds.has(item.id));

  return [...baseline, ...storedExtras];
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}
