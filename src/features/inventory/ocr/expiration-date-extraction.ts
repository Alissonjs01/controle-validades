import {
  parseBrazilianCivilDate,
  splitIsoDate
} from "@/features/inventory/domain/dates";
import { getDaysUntilExpiration } from "@/features/inventory/domain/display";
import { normalizePortugueseText } from "@/features/inventory/parser/normalization";
import type { IsoDate } from "@/types/inventory";

export type OcrExpirationCandidate = Readonly<{
  id: string;
  isoDate: IsoDate;
  displayDate: string;
  source: string;
  context: string;
  score: number;
  warnings: readonly string[];
}>;

export type InvalidOcrDateCandidate = Readonly<{
  source: string;
  reason: string;
}>;

export type OcrExpirationExtraction = Readonly<{
  rawText: string;
  normalizedText: string;
  status: "empty" | "found" | "multiple" | "invalid";
  candidates: readonly OcrExpirationCandidate[];
  invalidCandidates: readonly InvalidOcrDateCandidate[];
  suggestedCandidate: OcrExpirationCandidate | null;
}>;

type ExtractionOptions = Readonly<{
  referenceDate: IsoDate;
  maxFutureYears?: number;
}>;

const NUMERIC_DATE_PATTERN =
  /\b(?<day>\d{1,2})\s*[/-]\s*(?<month>\d{1,2})(?:\s*[/-]\s*(?<year>\d{2}|\d{4}))?\b/gu;

const MONTH_NAME_DATE_PATTERN =
  /\b\d{1,2}\s+de\s+(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{2,4}\b/giu;

const VALIDITY_CONTEXT = /\b(val|validade|valido ate|venc|vence|vencimento)\b/u;
const MANUFACTURE_CONTEXT = /\b(fab|fabricacao|fabricado|prod|producao)\b/u;

export function extractExpirationDatesFromOcrText(
  rawText: string,
  options: ExtractionOptions
): OcrExpirationExtraction {
  const normalizedText = normalizeOcrText(rawText);
  const rawCandidates = [
    ...findNumericDateSources(normalizedText),
    ...findMonthNameDateSources(normalizedText)
  ];
  const uniqueCandidates = new Map<string, OcrExpirationCandidate>();
  const invalidCandidates: InvalidOcrDateCandidate[] = [];

  for (const source of rawCandidates) {
    const parsed = parseBrazilianCivilDate(source, options.referenceDate);

    if (parsed.kind === "complete") {
      const context = getDateContext(normalizedText, source);
      const candidate = buildCandidate(parsed.value, parsed.source, context, options);
      uniqueCandidates.set(candidate.isoDate, candidate);
      continue;
    }

    if (parsed.kind === "invalid") {
      invalidCandidates.push({
        source: parsed.source,
        reason: parsed.reason
      });
    }
  }

  const candidates = [...uniqueCandidates.values()].sort(
    (left, right) => right.score - left.score || left.isoDate.localeCompare(right.isoDate)
  );
  const suggestedCandidate = getSuggestedCandidate(candidates);

  return {
    rawText,
    normalizedText,
    status: getExtractionStatus(candidates, invalidCandidates),
    candidates,
    invalidCandidates,
    suggestedCandidate
  };
}

export function normalizeOcrText(text: string) {
  return normalizePortugueseText(
    text
      .replace(/[|]/gu, "/")
      .replace(/[\\]/gu, "/")
      .replace(/[–—.]/gu, "-")
      .replace(/\bO(?=\d)\b/gu, "0")
  );
}

function findNumericDateSources(text: string) {
  return [...text.matchAll(NUMERIC_DATE_PATTERN)].map((match) =>
    match[0].replace(/\s+/gu, "")
  );
}

function findMonthNameDateSources(text: string) {
  return [...text.matchAll(MONTH_NAME_DATE_PATTERN)].map((match) => match[0]);
}

function buildCandidate(
  isoDate: IsoDate,
  source: string,
  context: string,
  options: ExtractionOptions
): OcrExpirationCandidate {
  const days = getDaysUntilExpiration(isoDate, options.referenceDate);
  const maxFutureYears = options.maxFutureYears ?? 6;
  const warnings: string[] = [];

  if (days < 0) {
    warnings.push("Essa data já passou. Confira antes de confirmar.");
  }

  if (days > maxFutureYears * 366) {
    warnings.push("Essa validade parece muito distante. Confira a leitura.");
  }

  return {
    id: isoDate,
    isoDate,
    displayDate: formatDisplayDate(isoDate),
    source,
    context,
    score: getContextScore(context, source),
    warnings
  };
}

function getDateContext(text: string, source: string) {
  const index = text.indexOf(source);

  if (index < 0) {
    return source;
  }

  return text.slice(Math.max(0, index - 28), index + source.length + 28);
}

function getContextScore(context: string, source: string) {
  let score = 0;
  const sourceIndex = context.indexOf(source);
  const before = sourceIndex >= 0 ? context.slice(0, sourceIndex).slice(-16) : context;
  const after =
    sourceIndex >= 0
      ? context.slice(sourceIndex + source.length, sourceIndex + source.length + 8)
      : "";

  if (VALIDITY_CONTEXT.test(before) || VALIDITY_CONTEXT.test(after)) {
    score += 3;
  }

  if (MANUFACTURE_CONTEXT.test(before)) {
    score -= 2;
  }

  return score;
}

function getSuggestedCandidate(candidates: readonly OcrExpirationCandidate[]) {
  if (candidates.length === 0) {
    return null;
  }

  const [first, second] = candidates;

  if (!first) {
    return null;
  }

  if (!second || first.score > second.score) {
    return first;
  }

  return null;
}

function getExtractionStatus(
  candidates: readonly OcrExpirationCandidate[],
  invalidCandidates: readonly InvalidOcrDateCandidate[]
) {
  if (candidates.length === 0 && invalidCandidates.length === 0) {
    return "empty";
  }

  if (candidates.length === 0) {
    return "invalid";
  }

  if (candidates.length > 1) {
    return "multiple";
  }

  return "found";
}

function formatDisplayDate(date: IsoDate) {
  const [year, month, day] = splitIsoDate(date);

  return `${day.toString().padStart(2, "0")}/${month
    .toString()
    .padStart(2, "0")}/${year}`;
}
