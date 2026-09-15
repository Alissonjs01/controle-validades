import { describe, expect, it } from "vitest";

import { devInventoryCatalog } from "@/features/inventory/fixtures/dev-catalog";
import { parseInventoryCommand } from "@/features/inventory/parser/parse-command";
import type { InventoryCatalog, Product } from "@/types/inventory";

const referenceDate = "2026-09-02" as const;

function parse(text: string, catalog: InventoryCatalog = devInventoryCatalog) {
  return parseInventoryCommand(text, catalog, { referenceDate });
}

describe("parseInventoryCommand entry", () => {
  it.each([
    "Chegou 20 fardos de Coca 2L vence 10/10/2027",
    "chegou 20 fardo coca 2l vence 10/10/2027",
    "Entraram 20 fardos de coca 2 litros validade 10/10/2027",
    "Adicionar 5 fardos de coca 2l validade 10-10-2027"
  ])("parses complete entry command: %s", (text) => {
    const command = parse(text);

    expect(command.status).toBe("READY");
    expect(command.action).toBe("ENTRY");
    expect(command.product?.name).toBe("Coca-Cola 2L");
    expect(command.packaging).toBe("fardo");
    expect(command.conversion?.multiplier).toBe(6);
    expect(command.expirationDate).toBe("2027-10-10");
    expect(command.baseQuantity).toBe(
      (command.enteredQuantity ?? 0) * (command.conversion?.multiplier ?? 0)
    );
  });

  it("centralizes two digit year expansion for expiration dates", () => {
    const command = parse("Recebi 10 fardos de Coca 2L vencimento 10/10/27");

    expect(command.status).toBe("NEEDS_CONFIRMATION");
    expect(command.action).toBe("ENTRY");
    expect(command.enteredQuantity).toBe(10);
    expect(command.expirationDate).toBe("2027-10-10");
    expect(command.baseQuantity).toBe(60);
    expect(command.warnings).toContain("Ano abreviado interpretado como 2027.");
  });

  it("parses month names as Brazilian civil dates", () => {
    const command = parse("Chegou 20 fardos de Coca 2L vence 10 de outubro de 2027");

    expect(command.status).toBe("READY");
    expect(command.expirationDate).toBe("2027-10-10");
  });
});

describe("parseInventoryCommand exit", () => {
  it.each([
    ["Vendeu 3 fardos da Coca 2L", 3, 18],
    ["Saíram 18 unidades de Coca 2L", 18, 18],
    ["Baixa 2 fardos de Coca 2L", 2, 12],
    ["Retirar 12 unidades da Coca 2 litros", 12, 12]
  ])("parses exit command: %s", (text, enteredQuantity, baseQuantity) => {
    const command = parse(text);

    expect(command.status).toBe("NEEDS_CONFIRMATION");
    expect(command.action).toBe("EXIT");
    expect(command.enteredQuantity).toBe(enteredQuantity);
    expect(command.baseQuantity).toBe(baseQuantity);
    expect(command.lot?.id).toBe("lot-coca-2l-2026-09-10");
    expect(command.warnings).toContain(
      "Lote FEFO sugerido; requer confirmação explícita."
    );
  });

  it("resolves an explicitly dated lot without mutating inventory", () => {
    const before = devInventoryCatalog.lots[1]?.currentQuantity;
    const command = parse("Vendeu 3 fardos da Coca 2L que vence 04/11/2026");
    const after = devInventoryCatalog.lots[1]?.currentQuantity;

    expect(command.status).toBe("READY");
    expect(command.lot?.id).toBe("lot-coca-2l-2026-11-04");
    expect(command.baseQuantity).toBe(18);
    expect(after).toBe(before);
  });
});

describe("parseInventoryCommand zero", () => {
  it.each([
    "Zerou a Coca 2L",
    "Acabou a Coca 2L",
    "Saiu tudo da Coca 2L",
    "Vendeu tudo da Coca 2 litros"
  ])("parses zero command and suggests FEFO when date is absent: %s", (text) => {
    const command = parse(text);

    expect(command.status).toBe("NEEDS_CONFIRMATION");
    expect(command.action).toBe("ZERO");
    expect(command.product?.name).toBe("Coca-Cola 2L");
    expect(command.lot?.id).toBe("lot-coca-2l-2026-09-10");
  });

  it("uses date candidates for zero commands with partial dates", () => {
    const command = parse("Acabou a Coca 2L que vence dia 10/09");

    expect(command.status).toBe("NEEDS_CONFIRMATION");
    expect(command.action).toBe("ZERO");
    expect(command.lot?.id).toBe("lot-coca-2l-2026-09-10");
    expect(command.warnings).toContain(
      "Data sem ano; confirme o lote antes de executar."
    );
  });
});

describe("parseInventoryCommand conversions", () => {
  it("uses the product-specific fardo multiplier for Coca-Cola 2L", () => {
    const command = parse("Chegou 20 fardos de Coca 2L vence 10/10/2027");

    expect(command.conversion?.multiplier).toBe(6);
    expect(command.baseQuantity).toBe(120);
  });

  it("does not assume fardo equals six globally", () => {
    const command = parse("Chegou 20 fardos de Coca Lata vence 10/10/2027");

    expect(command.product?.name).toBe("Coca-Cola Lata");
    expect(command.conversion?.multiplier).toBe(12);
    expect(command.baseQuantity).toBe(240);
  });

  it("uses fardo with six units for Fanta 2L flavors", () => {
    const command = parse("Chegou 2 fardos de Fanta Guaraná 2 L vence 10/10/2027");

    expect(command.status).toBe("READY");
    expect(command.product?.name).toBe("Fanta Guaraná 2L");
    expect(command.conversion?.multiplier).toBe(6);
    expect(command.baseQuantity).toBe(12);
  });

  it("uses fardo with twelve units for soda cans", () => {
    const command = parse("Chegou 2 fardos de Fanta Uva Lata vence 10/10/2027");

    expect(command.status).toBe("READY");
    expect(command.product?.name).toBe("Fanta Uva Lata");
    expect(command.conversion?.multiplier).toBe(12);
    expect(command.baseQuantity).toBe(24);
  });

  it("recognizes Sprite Zero can even with common typo", () => {
    const command = parse("Chegou 1 fardo de Split Zero Lata vence 10/10/2027");

    expect(command.status).toBe("READY");
    expect(command.product?.name).toBe("Sprite Zero Lata");
    expect(command.conversion?.multiplier).toBe(12);
    expect(command.baseQuantity).toBe(12);
  });

  it("uses fardo with twelve units for water 600ml", () => {
    const command = parse("Chegou 1 fardo de Água 600ml vence 10/10/2027");

    expect(command.status).toBe("READY");
    expect(command.product?.name).toBe("Água Mineral 600ml");
    expect(command.conversion?.multiplier).toBe(12);
    expect(command.baseQuantity).toBe(12);
  });
});

describe("parseInventoryCommand ambiguity and invalid cases", () => {
  it("returns needs confirmation when product is not found", () => {
    const command = parse("Chegou 20 fardos de Guaraná vence 10/10/2027");

    expect(command.status).toBe("NEEDS_CONFIRMATION");
    expect(command.missingFields).toContain("product");
    expect(command.baseQuantity).toBeNull();
  });

  it("returns ambiguous when aliases match more than one product", () => {
    const catalog = withSharedAlias("coca");
    const command = parse("Vendeu 3 fardos de Coca", catalog);

    expect(command.status).toBe("AMBIGUOUS");
    expect(command.productCandidates).toHaveLength(2);
  });

  it("does not silently choose between Fanta 2L and can when format is missing", () => {
    const command = parse("Chegou 2 fardos de Fanta Laranja vence 10/10/2027");

    expect(command.status).toBe("AMBIGUOUS");
    expect(command.productCandidates.map((product) => product.name)).toEqual([
      "Fanta Laranja 2L",
      "Fanta Laranja Lata"
    ]);
  });

  it("returns invalid when a known packaging lacks product conversion", () => {
    const command = parse("Chegou 2 caixas de Coca 2L vence 10/10/2027");

    expect(command.status).toBe("INVALID");
    expect(command.errors[0]).toContain("sem conversão");
  });

  it("returns needs confirmation when entry date is missing", () => {
    const command = parse("Chegou 20 fardos de Coca 2L");

    expect(command.status).toBe("NEEDS_CONFIRMATION");
    expect(command.missingFields).toContain("expirationDate");
  });

  it("returns needs confirmation when quantity is missing", () => {
    const command = parse("Chegou fardos de Coca 2L vence 10/10/2027");

    expect(command.status).toBe("NEEDS_CONFIRMATION");
    expect(command.missingFields).toContain("quantity");
  });

  it("returns invalid when action is unknown", () => {
    const command = parse("Coca 2L 20 fardos validade 10/10/2027");

    expect(command.status).toBe("INVALID");
    expect(command.missingFields).toContain("action");
  });

  it("returns ambiguous when two lots share the same expiration date", () => {
    const catalog: InventoryCatalog = {
      ...devInventoryCatalog,
      lots: [
        ...devInventoryCatalog.lots,
        {
          ...devInventoryCatalog.lots[0]!,
          id: "lot-coca-2l-same-date",
          originalQuantity: 12,
          currentQuantity: 12
        }
      ]
    };
    const command = parse("Vendeu 3 fardos da Coca 2L que vence 10/09/2026", catalog);

    expect(command.status).toBe("AMBIGUOUS");
    expect(command.lotCandidates).toHaveLength(2);
  });

  it("returns invalid for impossible dates", () => {
    const command = parse("Chegou 20 fardos de Coca 2L vence 31/02/2027");

    expect(command.status).toBe("INVALID");
    expect(command.errors).toContain("Data civil inválida.");
  });
});

function withSharedAlias(aliasValue: string): InventoryCatalog {
  const products = devInventoryCatalog.products.slice(0, 2).map((product): Product => ({
    ...product,
    aliases: [
      ...product.aliases,
      {
        id: `shared-${product.id}`,
        productId: product.id,
        value: aliasValue,
        normalizedValue: aliasValue,
        createdAt: "2026-09-02T12:00:00-03:00"
      }
    ]
  }));

  return {
    ...devInventoryCatalog,
    products
  };
}
