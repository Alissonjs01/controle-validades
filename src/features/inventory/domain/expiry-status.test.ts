import { describe, expect, it } from "vitest";

import { getExpiryStatus } from "@/features/inventory/domain/expiry-status";

const referenceDate = new Date("2026-09-02T12:00:00-03:00");

describe("getExpiryStatus", () => {
  it("classifies expired lots", () => {
    expect(getExpiryStatus("2026-09-01", referenceDate)).toBe("expired");
  });

  it("classifies urgent lots up to 7 days", () => {
    expect(getExpiryStatus("2026-09-09", referenceDate)).toBe("urgent");
  });

  it("classifies attention lots up to 30 days", () => {
    expect(getExpiryStatus("2026-09-20", referenceDate)).toBe("attention");
  });

  it("classifies normal lots after 30 days", () => {
    expect(getExpiryStatus("2026-10-10", referenceDate)).toBe("normal");
  });
});
