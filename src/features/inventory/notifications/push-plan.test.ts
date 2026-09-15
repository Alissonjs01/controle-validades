import { describe, expect, it } from "vitest";
import { brazilToday, planPushAlerts } from "./push-plan";
import type { Lot } from "@/types/inventory";

const lot: Lot = {
  id: "a",
  productId: "p",
  expirationDate: "2026-10-15",
  originalQuantity: 10,
  currentQuantity: 10,
  status: "OPEN",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z"
};
const milestones = [30, 15, 7, 0] as const;
describe("push planning", () => {
  it("keeps the same delivery key at 30 and 29 days, then changes at 15 and 7", () => {
    const keys = (
      ["2026-09-15", "2026-09-16", "2026-09-30", "2026-10-08"] as const
    ).map((day) => planPushAlerts([lot], milestones, day)[0]?.key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[1]).not.toBe(keys[2]);
    expect(keys[2]).not.toBe(keys[3]);
  });
  it("catches lots entered after a milestone without sending all older milestones", () => {
    expect(planPushAlerts([lot], milestones, "2026-10-10")).toHaveLength(1);
    expect(planPushAlerts([lot], milestones, "2026-10-10")[0]?.milestone).toBe(
      7
    );
  });
  it("ignores closed, empty, disabled and distant lots", () => {
    expect(
      planPushAlerts(
        [
          { ...lot, status: "CLOSED" },
          { ...lot, currentQuantity: 0 }
        ],
        milestones,
        "2026-10-10"
      )
    ).toEqual([]);
    expect(planPushAlerts([lot], [], "2026-10-10")).toEqual([]);
    expect(planPushAlerts([lot], milestones, "2026-08-01")).toEqual([]);
    expect(planPushAlerts([lot], [0], "2026-10-14")).toEqual([]);
  });
  it("changes the key when expiration is corrected", () => {
    expect(planPushAlerts([lot], milestones, "2026-10-10")[0]?.key).not.toBe(
      planPushAlerts(
        [{ ...lot, expirationDate: "2026-10-16" }],
        milestones,
        "2026-10-10"
      )[0]?.key
    );
  });
  it("reminds once per civil day after expiration", () => {
    expect(planPushAlerts([lot], milestones, "2026-10-16")[0]?.key).not.toBe(
      planPushAlerts([lot], milestones, "2026-10-17")[0]?.key
    );
  });
  it("uses Sao Paulo civil day near UTC midnight", () => {
    expect(brazilToday(new Date("2026-10-16T01:00:00Z"))).toBe("2026-10-15");
  });
});
