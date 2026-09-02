import { describe, expect, it } from "vitest";

import { applyConfirmedMovement } from "@/features/inventory/domain/movements";
import { devLots } from "@/features/inventory/fixtures/dev-catalog";

const occurredAt = "2026-09-02T12:00:00-03:00";

describe("applyConfirmedMovement", () => {
  it("creates movement history while updating a lot after confirmation", () => {
    const lot = devLots[0]!;
    const result = applyConfirmedMovement(lot, {
      id: "movement-exit-1",
      type: "EXIT",
      productId: lot.productId,
      lotId: lot.id,
      quantityDelta: -18,
      sourceText: "Vendeu 3 fardos da Coca 2L",
      occurredAt
    });

    expect(result.lot.currentQuantity).toBe(12);
    expect(result.movement.quantityBefore).toBe(30);
    expect(result.movement.quantityAfter).toBe(12);
    expect(result.movement.quantityDelta).toBe(-18);
    expect(lot.currentQuantity).toBe(30);
  });

  it("prevents negative inventory", () => {
    const lot = devLots[0]!;

    expect(() =>
      applyConfirmedMovement(lot, {
        id: "movement-exit-negative",
        type: "EXIT",
        productId: lot.productId,
        lotId: lot.id,
        quantityDelta: -31,
        sourceText: null,
        occurredAt
      })
    ).toThrow("negative inventory");
  });

  it("turns zero commands into an audited delta", () => {
    const lot = devLots[0]!;
    const result = applyConfirmedMovement(lot, {
      id: "movement-zero-1",
      type: "ZERO",
      productId: lot.productId,
      lotId: lot.id,
      quantityDelta: 0,
      sourceText: "Zerou a Coca 2L",
      occurredAt
    });

    expect(result.lot.currentQuantity).toBe(0);
    expect(result.lot.status).toBe("ZEROED");
    expect(result.movement.quantityDelta).toBe(-30);
  });
});
