export function normalizePortugueseText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/(?<=\p{L})-(?=\p{L})/gu, " ")
    .replace(/[.,;:!?()[\]{}"']/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function phrasePattern(phrase: string) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:\\s|$)`, "u");
}

export function includesPhrase(text: string, phrase: string) {
  return phrasePattern(phrase).test(text);
}
