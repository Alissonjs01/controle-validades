import { describe, expect, it } from "vitest";

import {
  expandTwoDigitExpirationYear,
  parseBrazilianCivilDate
} from "@/features/inventory/domain/dates";

describe("Brazilian civil date parsing", () => {
  it("parses DD/MM/YYYY without timezone conversion", () => {
    expect(parseBrazilianCivilDate("vence 10/10/2027", "2026-09-02")).toMatchObject({
      kind: "complete",
      value: "2027-10-10"
    });
  });

  it("uses the documented two-digit expiration year rule", () => {
    expect(expandTwoDigitExpirationYear(27)).toBe(2027);
    expect(parseBrazilianCivilDate("vence 10/10/27", "2026-09-02")).toMatchObject({
      kind: "complete",
      value: "2027-10-10",
      usedTwoDigitYear: true
    });
  });

  it("parses relative civil dates with injected reference date", () => {
    expect(parseBrazilianCivilDate("vence hoje", "2026-09-02")).toMatchObject({
      kind: "complete",
      value: "2026-09-02"
    });
    expect(parseBrazilianCivilDate("vence amanha", "2026-09-02")).toMatchObject({
      kind: "complete",
      value: "2026-09-03"
    });
  });
});
