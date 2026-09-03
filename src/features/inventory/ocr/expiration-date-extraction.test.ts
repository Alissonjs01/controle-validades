import { describe, expect, it } from "vitest";

import { extractExpirationDatesFromOcrText } from "@/features/inventory/ocr/expiration-date-extraction";

const referenceDate = "2026-09-02" as const;

describe("extractExpirationDatesFromOcrText", () => {
  it("finds a direct validity date", () => {
    const result = extractExpirationDatesFromOcrText("VAL 10/10/2027", {
      referenceDate
    });

    expect(result.status).toBe("found");
    expect(result.suggestedCandidate?.isoDate).toBe("2027-10-10");
  });

  it("uses context when manufacture and validity dates are present", () => {
    const result = extractExpirationDatesFromOcrText(
      "FAB 01/01/2026 VAL 10/10/2027",
      { referenceDate }
    );

    expect(result.status).toBe("multiple");
    expect(result.candidates).toHaveLength(2);
    expect(result.suggestedCandidate?.isoDate).toBe("2027-10-10");
  });

  it("expands two digit years through the shared date rule", () => {
    const result = extractExpirationDatesFromOcrText("VALIDADE: 18-11-26", {
      referenceDate
    });

    expect(result.suggestedCandidate?.displayDate).toBe("18/11/2026");
  });

  it("reports invalid dates safely", () => {
    const result = extractExpirationDatesFromOcrText("VENC 31/02/2027", {
      referenceDate
    });

    expect(result.status).toBe("invalid");
    expect(result.invalidCandidates[0]?.source).toBe("31/02/2027");
  });

  it("warns about expired dates without blocking confirmation", () => {
    const result = extractExpirationDatesFromOcrText("VAL 10/08/2026", {
      referenceDate
    });

    expect(result.suggestedCandidate?.warnings[0]).toMatch(/já passou/u);
  });
});
