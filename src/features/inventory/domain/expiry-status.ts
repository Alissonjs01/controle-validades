export type ExpiryStatus = "normal" | "attention" | "urgent" | "expired";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function getExpiryStatus(
  expiresAt: string,
  referenceDate = new Date()
): ExpiryStatus {
  const expiryDate = new Date(`${expiresAt}T12:00:00`);
  const reference = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12
  );
  const daysUntilExpiry = Math.floor(
    (expiryDate.getTime() - reference.getTime()) / DAY_IN_MS
  );

  if (daysUntilExpiry < 0) {
    return "expired";
  }

  if (daysUntilExpiry <= 7) {
    return "urgent";
  }

  if (daysUntilExpiry <= 30) {
    return "attention";
  }

  return "normal";
}
