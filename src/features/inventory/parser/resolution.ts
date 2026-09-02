import type {
  InventoryCatalog,
  Lot,
  PackagingConversion,
  Product
} from "@/types/inventory";

import { getOpenLotsByFefo } from "@/features/inventory/domain/fefo";
import {
  includesPhrase,
  normalizePortugueseText
} from "@/features/inventory/parser/normalization";
import { operationalVocabulary } from "@/features/inventory/parser/vocabulary";

export type ProductResolution =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "resolved"; product: Product; matchedAlias: string }>
  | Readonly<{ kind: "ambiguous"; candidates: readonly Product[] }>;

export type PackagingResolution =
  | Readonly<{ kind: "none" }>
  | Readonly<{
      kind: "resolved";
      conversion: PackagingConversion;
      matchedAlias: string;
    }>
  | Readonly<{ kind: "unknown"; matchedPackaging: string }>
  | Readonly<{
      kind: "ambiguous";
      candidates: readonly PackagingConversion[];
    }>;

export type LotResolution =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "resolved"; lot: Lot }>
  | Readonly<{ kind: "fefo-suggested"; lot: Lot; candidates: readonly Lot[] }>
  | Readonly<{ kind: "ambiguous"; candidates: readonly Lot[] }>;

export function resolveProduct(
  normalizedText: string,
  products: readonly Product[]
): ProductResolution {
  const matches = products
    .filter((product) => product.isActive)
    .flatMap((product) =>
      productAliases(product).flatMap((alias) => {
        if (!includesPhrase(normalizedText, alias)) {
          return [];
        }

        return [
          {
            product,
            alias,
            score: alias.split(" ").length * 100 + alias.length
          }
        ];
      })
    )
    .sort((left, right) => right.score - left.score);

  const best = matches[0];

  if (!best) {
    return { kind: "none" };
  }

  const bestMatches = matches.filter((match) => match.score === best.score);
  const productsById = new Map(
    bestMatches.map((match) => [match.product.id, match.product])
  );

  if (productsById.size > 1) {
    return { kind: "ambiguous", candidates: [...productsById.values()] };
  }

  return {
    kind: "resolved",
    product: best.product,
    matchedAlias: best.alias
  };
}

export function resolvePackaging(
  normalizedText: string,
  product: Product | null,
  catalog: InventoryCatalog
): PackagingResolution {
  if (!product) {
    return { kind: "none" };
  }

  const conversions = catalog.packagingConversions.filter(
    (conversion) => conversion.productId === product.id
  );
  const matches = conversions.flatMap((conversion) =>
    conversionAliases(conversion).flatMap((alias) => {
      if (!includesPhrase(normalizedText, alias)) {
        return [];
      }

      return [
        {
          conversion,
          alias,
          score: alias.split(" ").length * 100 + alias.length
        }
      ];
    })
  );

  if (matches.length > 0) {
    const sorted = matches.sort((left, right) => right.score - left.score);
    const best = sorted[0];

    if (!best) {
      return { kind: "none" };
    }

    const bestMatches = sorted.filter((match) => match.score === best.score);
    const conversionsById = new Map(
      bestMatches.map((match) => [match.conversion.id, match.conversion])
    );

    if (conversionsById.size > 1) {
      return { kind: "ambiguous", candidates: [...conversionsById.values()] };
    }

    return {
      kind: "resolved",
      conversion: best.conversion,
      matchedAlias: best.alias
    };
  }

  const knownPackaging = operationalVocabulary.packaging.find((packaging) =>
    includesPhrase(normalizedText, packaging)
  );

  if (knownPackaging) {
    return { kind: "unknown", matchedPackaging: knownPackaging };
  }

  return { kind: "none" };
}

export function resolveLot(
  product: Product | null,
  lots: readonly Lot[],
  expirationDate: string | null,
  partialDate: Readonly<{ day: number; month: number }> | null
): LotResolution {
  if (!product) {
    return { kind: "none" };
  }

  const productLots = getOpenLotsByFefo(
    lots.filter((lot) => lot.productId === product.id)
  );

  if (productLots.length === 0) {
    return { kind: "none" };
  }

  if (expirationDate) {
    const matchingLots = productLots.filter(
      (lot) => lot.expirationDate === expirationDate
    );

    return lotsToResolution(matchingLots);
  }

  if (partialDate) {
    const day = partialDate.day.toString().padStart(2, "0");
    const month = partialDate.month.toString().padStart(2, "0");
    const matchingLots = productLots.filter((lot) =>
      lot.expirationDate.endsWith(`-${month}-${day}`)
    );

    return lotsToResolution(matchingLots);
  }

  const fefoLot = productLots[0];

  if (!fefoLot) {
    return { kind: "none" };
  }

  return {
    kind: "fefo-suggested",
    lot: fefoLot,
    candidates: productLots
  };
}

function lotsToResolution(lots: readonly Lot[]): LotResolution {
  if (lots.length === 0) {
    return { kind: "none" };
  }

  if (lots.length === 1) {
    const [lot] = lots;

    if (!lot) {
      return { kind: "none" };
    }

    return { kind: "resolved", lot };
  }

  return { kind: "ambiguous", candidates: lots };
}

function productAliases(product: Product) {
  return [
    normalizePortugueseText(product.name),
    ...product.aliases.map((alias) => alias.normalizedValue)
  ].sort((left, right) => right.length - left.length);
}

function conversionAliases(conversion: PackagingConversion) {
  return [
    normalizePortugueseText(conversion.packagingType),
    ...conversion.aliases.map(normalizePortugueseText)
  ].sort((left, right) => right.length - left.length);
}
