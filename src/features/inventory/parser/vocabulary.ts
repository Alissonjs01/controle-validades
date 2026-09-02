export const operationalVocabulary = {
  entry: [
    "chegou",
    "chegaram",
    "entrou",
    "entraram",
    "recebi",
    "recebemos",
    "adicionar",
    "adicione",
    "repor",
    "reposicao"
  ],
  exit: [
    "saiu",
    "sairam",
    "vendeu",
    "vendi",
    "vendemos",
    "venderam",
    "baixou",
    "baixa",
    "retirar",
    "retirei"
  ],
  zero: [
    "zerou",
    "zera",
    "zerar",
    "acabou",
    "acabaram",
    "terminou",
    "terminaram",
    "saiu tudo",
    "vendeu tudo",
    "acabou tudo"
  ],
  expiration: [
    "vence",
    "vencem",
    "vencimento",
    "validade",
    "valido ate",
    "vence em"
  ],
  packaging: [
    "unidade",
    "unidades",
    "un",
    "unds",
    "fardo",
    "fardos",
    "fd",
    "caixa",
    "caixas",
    "cx",
    "pacote",
    "pacotes",
    "pct",
    "engradado",
    "engradados"
  ]
} as const;

export type VocabularyGroup = keyof typeof operationalVocabulary;
