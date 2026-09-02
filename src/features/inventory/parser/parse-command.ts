import type {
  InventoryCatalog,
  InventoryMovementType,
  IsoDate,
  Lot,
  PackagingConversion,
  Product
} from "@/types/inventory";

import { parseBrazilianCivilDate } from "@/features/inventory/domain/dates";
import {
  includesPhrase,
  normalizePortugueseText
} from "@/features/inventory/parser/normalization";
import { parseQuantity } from "@/features/inventory/parser/quantity";
import {
  resolveLot,
  resolvePackaging,
  resolveProduct
} from "@/features/inventory/parser/resolution";
import { operationalVocabulary } from "@/features/inventory/parser/vocabulary";

export type ParseStatus = "READY" | "NEEDS_CONFIRMATION" | "AMBIGUOUS" | "INVALID";

export type ParsedCommand = Readonly<{
  status: ParseStatus;
  originalText: string;
  normalizedText: string;
  action: InventoryMovementType | null;
  product: Product | null;
  productCandidates: readonly Product[];
  enteredQuantity: number | null;
  packaging: string | null;
  conversion: PackagingConversion | null;
  baseQuantity: number | null;
  expirationDate: IsoDate | null;
  lot: Lot | null;
  lotCandidates: readonly Lot[];
  warnings: readonly string[];
  missingFields: readonly string[];
  errors: readonly string[];
}>;

export type ParseCommandOptions = Readonly<{
  referenceDate: IsoDate;
}>;

export function parseInventoryCommand(
  text: string,
  catalog: InventoryCatalog,
  options: ParseCommandOptions
): ParsedCommand {
  const normalizedText = normalizePortugueseText(text);
  const warnings: string[] = [];
  const missingFields: string[] = [];
  const errors: string[] = [];
  const action = detectAction(normalizedText);
  const date = parseBrazilianCivilDate(normalizedText, options.referenceDate);
  const quantity = parseQuantity(normalizedText);
  const productResolution = resolveProduct(normalizedText, catalog.products);
  const product =
    productResolution.kind === "resolved" ? productResolution.product : null;
  const productCandidates =
    productResolution.kind === "ambiguous" ? productResolution.candidates : [];
  const packagingResolution = resolvePackaging(normalizedText, product, catalog);
  const conversion =
    packagingResolution.kind === "resolved"
      ? packagingResolution.conversion
      : null;
  const baseQuantity =
    quantity && conversion ? quantity.value * conversion.multiplier : null;

  if (date.kind === "invalid") {
    errors.push(date.reason);
  }

  if (date.kind === "complete" && date.usedTwoDigitYear) {
    warnings.push(
      `Ano abreviado interpretado como ${date.value.slice(0, 4)}.`
    );
  }

  const partialDate =
    date.kind === "partial-day-month"
      ? { day: date.day, month: date.month }
      : null;
  const expirationDate = date.kind === "complete" ? date.value : null;
  const lotResolution =
    action === "EXIT" || action === "ZERO"
      ? resolveLot(product, catalog.lots, expirationDate, partialDate)
      : { kind: "none" as const };

  if (!action) {
    missingFields.push("action");
  }

  if (productResolution.kind === "none") {
    missingFields.push("product");
  }

  if (productResolution.kind === "ambiguous") {
    warnings.push("Produto ambíguo; escolha um candidato antes de confirmar.");
  }

  if ((action === "ENTRY" || action === "EXIT") && !quantity) {
    missingFields.push("quantity");
  }

  if ((action === "ENTRY" || action === "EXIT") && !conversion) {
    missingFields.push("packagingConversion");
  }

  if (action === "ENTRY" && !expirationDate) {
    missingFields.push("expirationDate");
  }

  if (packagingResolution.kind === "unknown") {
    errors.push(
      `Embalagem reconhecida, mas sem conversão para o produto: ${packagingResolution.matchedPackaging}.`
    );
  }

  if (packagingResolution.kind === "ambiguous") {
    warnings.push("Embalagem ambígua para o produto.");
  }

  if (lotResolution.kind === "fefo-suggested") {
    warnings.push("Lote FEFO sugerido; requer confirmação explícita.");
  }

  if (lotResolution.kind === "ambiguous") {
    warnings.push("Mais de um lote possível; escolha um antes de confirmar.");
  }

  if ((action === "EXIT" || action === "ZERO") && lotResolution.kind === "none") {
    warnings.push("Nenhum lote aberto foi identificado para esta operação.");
  }

  if (date.kind === "partial-day-month") {
    warnings.push("Data sem ano; confirme o lote antes de executar.");
  }

  const status = determineStatus({
    errors,
    missingFields,
    productResolutionKind: productResolution.kind,
    packagingResolutionKind: packagingResolution.kind,
    lotResolutionKind: lotResolution.kind,
    warnings
  });

  return {
    status,
    originalText: text,
    normalizedText,
    action,
    product,
    productCandidates,
    enteredQuantity: quantity?.value ?? null,
    packaging:
      packagingResolution.kind === "resolved"
        ? packagingResolution.conversion.packagingType
        : packagingResolution.kind === "unknown"
          ? packagingResolution.matchedPackaging
          : null,
    conversion,
    baseQuantity,
    expirationDate,
    lot:
      lotResolution.kind === "resolved" || lotResolution.kind === "fefo-suggested"
        ? lotResolution.lot
        : null,
    lotCandidates:
      lotResolution.kind === "ambiguous" || lotResolution.kind === "fefo-suggested"
        ? lotResolution.candidates
        : [],
    warnings,
    missingFields,
    errors
  };
}

function detectAction(normalizedText: string): InventoryMovementType | null {
  if (
    operationalVocabulary.zero.some((term) => includesPhrase(normalizedText, term))
  ) {
    return "ZERO";
  }

  if (
    operationalVocabulary.entry.some((term) => includesPhrase(normalizedText, term))
  ) {
    return "ENTRY";
  }

  if (
    operationalVocabulary.exit.some((term) => includesPhrase(normalizedText, term))
  ) {
    return "EXIT";
  }

  return null;
}

function determineStatus(
  params: Readonly<{
    errors: readonly string[];
    missingFields: readonly string[];
    productResolutionKind: string;
    packagingResolutionKind: string;
    lotResolutionKind: string;
    warnings: readonly string[];
  }>
): ParseStatus {
  if (params.errors.length > 0) {
    return "INVALID";
  }

  if (params.missingFields.includes("action")) {
    return "INVALID";
  }

  if (
    params.productResolutionKind === "ambiguous" ||
    params.packagingResolutionKind === "ambiguous" ||
    params.lotResolutionKind === "ambiguous"
  ) {
    return "AMBIGUOUS";
  }

  if (params.missingFields.length > 0) {
    return "NEEDS_CONFIRMATION";
  }

  if (
    params.lotResolutionKind === "fefo-suggested" ||
    params.warnings.length > 0
  ) {
    return "NEEDS_CONFIRMATION";
  }

  return "READY";
}
