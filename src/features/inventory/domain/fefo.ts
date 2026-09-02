import type { IsoDate, Lot } from "@/types/inventory";

export function isOpenLot(lot: Lot) {
  return lot.status === "OPEN" && lot.currentQuantity > 0;
}

export function sortLotsByFefo(lots: readonly Lot[]) {
  return [...lots].sort((left, right) => {
    const dateOrder = left.expirationDate.localeCompare(right.expirationDate);

    if (dateOrder !== 0) {
      return dateOrder;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function getOpenLotsByFefo(lots: readonly Lot[]) {
  return sortLotsByFefo(lots.filter(isOpenLot));
}

export function findMostUrgentLot(lots: readonly Lot[]) {
  return getOpenLotsByFefo(lots)[0] ?? null;
}

export function isLotExpired(lot: Lot, referenceDate: IsoDate) {
  return lot.expirationDate < referenceDate;
}

export function isLotExpiringSoon(
  lot: Lot,
  referenceDate: IsoDate,
  windowDays = 30
) {
  if (isLotExpired(lot, referenceDate)) {
    return false;
  }

  const reference = new Date(`${referenceDate}T12:00:00`);
  const expiration = new Date(`${lot.expirationDate}T12:00:00`);
  const daysUntilExpiry =
    (expiration.getTime() - reference.getTime()) / (24 * 60 * 60 * 1000);

  return daysUntilExpiry <= windowDays;
}
