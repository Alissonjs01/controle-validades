import { describe, expect, it } from "vitest";

import {
  findMostUrgentLot,
  getOpenLotsByFefo,
  isLotExpired,
  isLotExpiringSoon
} from "@/features/inventory/domain/fefo";
import { devLots } from "@/features/inventory/fixtures/dev-catalog";

describe("FEFO utilities", () => {
  it("orders open lots by earliest expiration and ignores zeroed lots", () => {
    const lots = [
      { ...devLots[1]!, expirationDate: "2026-11-04" as const },
      { ...devLots[0]!, expirationDate: "2026-09-10" as const },
      {
        ...devLots[2]!,
        id: "zeroed",
        expirationDate: "2026-09-01" as const,
        currentQuantity: 0,
        status: "ZEROED" as const
      }
    ];

    expect(getOpenLotsByFefo(lots).map((lot) => lot.expirationDate)).toEqual([
      "2026-09-10",
      "2026-11-04"
    ]);
  });

  it("finds the most urgent open lot", () => {
    expect(findMostUrgentLot(devLots)?.id).toBe("lot-coca-2l-2026-09-10");
  });

  it("identifies expired and expiring-soon lots using civil dates", () => {
    expect(isLotExpired(devLots[0]!, "2026-09-11")).toBe(true);
    expect(isLotExpiringSoon(devLots[0]!, "2026-09-02", 30)).toBe(true);
    expect(isLotExpiringSoon(devLots[1]!, "2026-09-02", 30)).toBe(false);
  });
});
