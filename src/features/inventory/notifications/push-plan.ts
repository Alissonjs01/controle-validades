import { getDaysUntilExpiration } from "@/features/inventory/domain/display";
import type { IsoDate, Lot } from "@/types/inventory";
import type { AlertMilestone } from "./alerts";

export function planPushAlerts(
  lots: readonly Lot[],
  milestones: readonly AlertMilestone[],
  today: IsoDate
) {
  return lots.flatMap((lot) => {
    if (lot.status !== "OPEN" || lot.currentQuantity <= 0) return [];
    const days = getDaysUntilExpiration(lot.expirationDate, today);
    const milestone = [...milestones]
      .sort((a, b) => a - b)
      .find((value) => days <= value);
    if (milestone === undefined) return [];
    // Include the expiration date so a corrected date starts a new alert cycle.
    const key = `${lot.id}:${lot.expirationDate}:${milestone}${days < 0 ? `:${today}` : ""}`;
    return [{ key, lot, days, milestone }];
  });
}

export function brazilToday(now: Date): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now) as IsoDate;
}
