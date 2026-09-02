import type { IsoDate } from "@/types/inventory";

const MONTHS = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12
} as const;

type MonthName = keyof typeof MONTHS;

export type ParsedCivilDate =
  | Readonly<{
      kind: "complete";
      value: IsoDate;
      source: string;
      usedTwoDigitYear: boolean;
    }>
  | Readonly<{
      kind: "partial-day-month";
      day: number;
      month: number;
      source: string;
    }>
  | Readonly<{
      kind: "invalid";
      source: string;
      reason: string;
    }>
  | Readonly<{
      kind: "missing";
    }>;

export function expandTwoDigitExpirationYear(year: number) {
  return 2000 + year;
}

export function formatIsoDate(year: number, month: number, day: number): IsoDate {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}` as IsoDate;
}

export function isValidCivilDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function splitIsoDate(date: IsoDate) {
  const [year, month, day] = date.split("-").map(Number);

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid ISO civil date: ${date}`);
  }

  return [year, month, day] as const;
}

export function addCivilDays(date: IsoDate, days: number): IsoDate {
  const [year, month, day] = splitIsoDate(date);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);

  return formatIsoDate(
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    utc.getUTCDate()
  );
}

export function parseBrazilianCivilDate(
  normalizedText: string,
  referenceDate: IsoDate
): ParsedCivilDate {
  const relative = parseRelativeDate(normalizedText, referenceDate);

  if (relative.kind !== "missing") {
    return relative;
  }

  const numericDate = normalizedText.match(
    /\b(?<day>\d{1,2})[/-](?<month>\d{1,2})(?:[/-](?<year>\d{2}|\d{4}))?\b/u
  );

  if (numericDate?.groups) {
    return buildNumericDate(numericDate.groups, numericDate[0]);
  }

  const monthNameDate = normalizedText.match(
    /\b(?<day>\d{1,2})\s+de\s+(?<monthName>janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(?<year>\d{2}|\d{4})\b/u
  );

  if (monthNameDate?.groups) {
    return buildMonthNameDate(monthNameDate.groups, monthNameDate[0]);
  }

  return { kind: "missing" };
}

function parseRelativeDate(
  normalizedText: string,
  referenceDate: IsoDate
): ParsedCivilDate {
  if (/\bhoje\b/u.test(normalizedText)) {
    return {
      kind: "complete",
      value: referenceDate,
      source: "hoje",
      usedTwoDigitYear: false
    };
  }

  if (/\bamanha\b/u.test(normalizedText)) {
    return {
      kind: "complete",
      value: addCivilDays(referenceDate, 1),
      source: "amanha",
      usedTwoDigitYear: false
    };
  }

  return { kind: "missing" };
}

function buildNumericDate(
  groups: Record<string, string | undefined>,
  source: string
): ParsedCivilDate {
  const day = Number(groups.day);
  const month = Number(groups.month);
  const rawYear = groups.year;

  if (!rawYear) {
    if (!isValidDayMonth(day, month)) {
      return { kind: "invalid", source, reason: "Data parcial inválida." };
    }

    return { kind: "partial-day-month", day, month, source };
  }

  const usedTwoDigitYear = rawYear.length === 2;
  const year = usedTwoDigitYear
    ? expandTwoDigitExpirationYear(Number(rawYear))
    : Number(rawYear);

  if (!isValidCivilDate(year, month, day)) {
    return { kind: "invalid", source, reason: "Data civil inválida." };
  }

  return {
    kind: "complete",
    value: formatIsoDate(year, month, day),
    source,
    usedTwoDigitYear
  };
}

function buildMonthNameDate(
  groups: Record<string, string | undefined>,
  source: string
): ParsedCivilDate {
  const day = Number(groups.day);
  const monthName = groups.monthName as MonthName | undefined;
  const rawYear = groups.year;

  if (!monthName || !rawYear) {
    return { kind: "missing" };
  }

  const usedTwoDigitYear = rawYear.length === 2;
  const year = usedTwoDigitYear
    ? expandTwoDigitExpirationYear(Number(rawYear))
    : Number(rawYear);
  const month = MONTHS[monthName];

  if (!isValidCivilDate(year, month, day)) {
    return { kind: "invalid", source, reason: "Data civil inválida." };
  }

  return {
    kind: "complete",
    value: formatIsoDate(year, month, day),
    source,
    usedTwoDigitYear
  };
}

function isValidDayMonth(day: number, month: number) {
  return (
    Number.isInteger(day) &&
    Number.isInteger(month) &&
    day >= 1 &&
    day <= 31 &&
    month >= 1 &&
    month <= 12
  );
}
