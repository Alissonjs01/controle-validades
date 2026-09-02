import { operationalVocabulary } from "@/features/inventory/parser/vocabulary";

const NUMBER_WORDS = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  vinte: 20
} as const;

export type ParsedQuantity = Readonly<{
  value: number;
  token: string;
}>;

export function parseQuantity(normalizedText: string): ParsedQuantity | null {
  const tokens = normalizedText.split(" ");

  for (const [index, token] of tokens.entries()) {
    if (!isFollowedByPackaging(tokens, index)) {
      continue;
    }

    if (/^\d+$/u.test(token)) {
      return {
        value: Number(token),
        token
      };
    }

    const wordValue = NUMBER_WORDS[token as keyof typeof NUMBER_WORDS];

    if (wordValue) {
      return { value: wordValue, token };
    }
  }

  return null;
}

function isFollowedByPackaging(tokens: readonly string[], index: number) {
  const nextOne = tokens[index + 1] ?? "";
  const nextTwo = `${nextOne} ${tokens[index + 2] ?? ""}`.trim();

  return operationalVocabulary.packaging.some(
    (packaging) => packaging === nextOne || packaging === nextTwo
  );
}
