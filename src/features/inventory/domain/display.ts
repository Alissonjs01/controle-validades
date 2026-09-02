import type { InventoryMovement, IsoDate, Lot, Product } from "@/types/inventory";

import { splitIsoDate } from "@/features/inventory/domain/dates";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type ExpiryVisualState = "expired" | "urgent" | "attention" | "normal";

export function getTodayIsoDate(date = new Date()): IsoDate {
  return `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}` as IsoDate;
}

export function formatCivilDate(date: IsoDate) {
  const [year, month, day] = splitIsoDate(date);

  return `${day.toString().padStart(2, "0")}/${month
    .toString()
    .padStart(2, "0")}/${year.toString().padStart(4, "0")}`;
}

export function getDaysUntilExpiration(expirationDate: IsoDate, referenceDate: IsoDate) {
  const [expirationYear, expirationMonth, expirationDay] = splitIsoDate(expirationDate);
  const [referenceYear, referenceMonth, referenceDay] = splitIsoDate(referenceDate);
  const expiration = Date.UTC(expirationYear, expirationMonth - 1, expirationDay);
  const reference = Date.UTC(referenceYear, referenceMonth - 1, referenceDay);

  return Math.round((expiration - reference) / DAY_IN_MS);
}

export function getExpiryVisualState(
  expirationDate: IsoDate,
  referenceDate: IsoDate
): ExpiryVisualState {
  const days = getDaysUntilExpiration(expirationDate, referenceDate);

  if (days < 0) {
    return "expired";
  }

  if (days <= 7) {
    return "urgent";
  }

  if (days <= 30) {
    return "attention";
  }

  return "normal";
}

export function formatDaysRemaining(days: number) {
  if (days < 0) {
    return `Vencido há ${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"}`;
  }

  if (days === 0) {
    return "Vence hoje";
  }

  if (days === 1) {
    return "Vence amanhã";
  }

  return `Vence em ${days} dias`;
}

export function formatQuantity(quantity: number, unitLabel: string) {
  const rounded = Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(3);
  const plural = quantity === 1 ? unitLabel : pluralizeUnit(unitLabel);

  return `${rounded} ${plural}`;
}

export function getProductName(products: readonly Product[], productId: string) {
  return products.find((product) => product.id === productId)?.name ?? "Produto";
}

export function getProduct(products: readonly Product[], productId: string) {
  return products.find((product) => product.id === productId) ?? null;
}

export function movementLabel(type: InventoryMovement["type"]) {
  switch (type) {
    case "ENTRY":
      return "Entrada";
    case "EXIT":
      return "Saída";
    case "ZERO":
      return "Zeramento";
    case "ADJUSTMENT":
      return "Ajuste";
  }
}

export function lotMatchesMovement(lot: Lot, movement: InventoryMovement) {
  return movement.lotId === lot.id || movement.productId === lot.productId;
}

function pluralizeUnit(unitLabel: string) {
  if (unitLabel.endsWith("s")) {
    return unitLabel;
  }

  return `${unitLabel}s`;
}
