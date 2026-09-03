import { describe, expect, it } from "vitest";

import {
  createAlertDeliveries,
  defaultAlertPreferences,
  getDueExpiryAlerts
} from "@/features/inventory/notifications/alerts";
import { devInventoryCatalog } from "@/features/inventory/fixtures/dev-catalog";
import type { Lot } from "@/types/inventory";

describe("expiry alerts", () => {
  it("creates a 30 day alert when the milestone is enabled", () => {
    const lots = [buildLot("2026-10-02", 10)];
    const alerts = getDueExpiryAlerts({
      lots,
      products: devInventoryCatalog.products,
      preferences: { enabled: true, milestones: [30, 15, 7, 0] },
      deliveries: [],
      referenceDate: "2026-09-02"
    });

    expect(alerts[0]?.milestone).toBe(30);
    expect(alerts[0]?.title).toContain("vence em 30 dias");
  });

  it("does not repeat a delivered milestone on the next check", () => {
    const lots = [buildLot("2026-10-02", 10)];
    const alerts = getDueExpiryAlerts({
      lots,
      products: devInventoryCatalog.products,
      preferences: { enabled: true, milestones: [30, 15, 7, 0] },
      deliveries: [],
      referenceDate: "2026-09-02"
    });
    const deliveries = createAlertDeliveries(alerts, "2026-09-02T09:00:00-03:00");

    expect(
      getDueExpiryAlerts({
        lots,
        products: devInventoryCatalog.products,
        preferences: { enabled: true, milestones: [30, 15, 7, 0] },
        deliveries,
        referenceDate: "2026-09-02"
      })
    ).toHaveLength(0);
  });

  it("emits a new alert at the 15 and 7 day milestones", () => {
    expect(alertsFor("2026-09-17", "2026-09-02")[0]?.milestone).toBe(15);
    expect(alertsFor("2026-09-09", "2026-09-02")[0]?.milestone).toBe(7);
  });

  it("does not alert for disabled preferences", () => {
    expect(
      getDueExpiryAlerts({
        lots: [buildLot("2026-09-09", 10)],
        products: devInventoryCatalog.products,
        preferences: defaultAlertPreferences,
        deliveries: [],
        referenceDate: "2026-09-02"
      })
    ).toHaveLength(0);
  });

  it("does not alert zeroed or empty lots", () => {
    expect(alertsFor("2026-09-09", "2026-09-02", 0)).toHaveLength(0);
    expect(alertsFor("2026-09-09", "2026-09-02", 10, "ZEROED")).toHaveLength(0);
  });
});

function alertsFor(
  expirationDate: Lot["expirationDate"],
  referenceDate: Lot["expirationDate"],
  currentQuantity = 10,
  status: Lot["status"] = "OPEN"
) {
  return getDueExpiryAlerts({
    lots: [buildLot(expirationDate, currentQuantity, status)],
    products: devInventoryCatalog.products,
    preferences: { enabled: true, milestones: [30, 15, 7, 0] },
    deliveries: [],
    referenceDate
  });
}

function buildLot(
  expirationDate: Lot["expirationDate"],
  currentQuantity: number,
  status: Lot["status"] = "OPEN"
): Lot {
  return {
    id: `lot-${expirationDate}`,
    productId: "product-coca-cola-2l",
    expirationDate,
    originalQuantity: currentQuantity,
    currentQuantity,
    status,
    createdAt: "2026-09-02T09:00:00-03:00",
    updatedAt: "2026-09-02T09:00:00-03:00"
  };
}
