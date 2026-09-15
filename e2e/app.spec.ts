import { expect, type Page, test } from "@playwright/test";
import path from "node:path";

declare global {
  interface Window {
    __CONTROLE_VALIDADES_OCR_TEXT__?: string;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

async function enterCommand(page: Page, command: string) {
  const input = page.getByRole("textbox", { name: "Nova movimentação" });

  await input.fill(command);
  await expect(input).toHaveValue(command);
  await page.getByRole("button", { name: "Interpretar movimentação" }).click();
}

test("opens the mobile app and filters active lots", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Validades" })).toBeVisible();
  await expect(page.getByText("Usar primeiro")).toBeVisible();

  await page.getByRole("button", { name: /Até 30 dias/u }).click();
  await page.getByRole("button", { name: /Todos/u }).click();

  await expect(page.getByText("Coca-Cola 2L").first()).toBeVisible();
  await expect(page.getByText("Água Mineral 600ml")).toBeVisible();

  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  await expect(page.getByRole("button", { name: "Preferências de avisos" })).toBeVisible();
});

test("registers an entry only after confirmation", async ({ page }) => {
  await enterCommand(page, "Chegou 20 fardos de Coca 2L vence 10/10/2027");

  await expect(page.getByRole("heading", { name: "Nova entrada" })).toBeVisible();
  await expect(page.getByText("+120 unidades")).toBeVisible();

  await page.getByRole("button", { name: "Confirmar" }).click();

  await expect(page.getByRole("status")).toContainText("Entrada registrada");
  await expect(page.getByText("10/10/2027")).toBeVisible();
});

test("uses FEFO for exit and keeps history", async ({ page }) => {
  await enterCommand(page, "Vendeu 3 fardos da Coca 2L");

  await expect(page.getByRole("heading", { name: "Saída" })).toBeVisible();
  await expect(page.getByText("-18 unidades")).toBeVisible();

  await page.getByRole("button", { name: "Confirmar" }).click();

  await expect(page.getByText("12 unidades")).toBeVisible();
  await page.getByRole("button", { name: "Abrir histórico" }).click();
  await expect(page.getByText("Vendeu 3 fardos da Coca 2L")).toBeVisible();
});

test("zeroes a lot after confirmation", async ({ page }) => {
  await enterCommand(page, "Zerou a Coca 2L");

  await expect(page.getByRole("heading", { name: "Zerar lote" })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar" }).click();

  await expect(page.getByRole("status")).toContainText("Lote zerado");
  await expect(page.getByText("10/09/2026")).toHaveCount(0);
});

test("uses OCR date capture to pre-fill a new lot", async ({ page }) => {
  await page.addInitScript(() => {
    window.__CONTROLE_VALIDADES_OCR_TEXT__ =
      "FAB 02/08/2026 VAL 18/11/2026";
  });
  await page.reload();

  await page.getByRole("button", { name: "Ler validade" }).click();
  await page
    .getByLabel("Foto da validade")
    .setInputFiles(path.join(process.cwd(), "e2e/fixtures/validade-18-11-2026.svg"));

  await expect(page.getByText("Qual é a validade?")).toBeVisible();
  await expect(page.getByRole("button", { name: "18/11/2026" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await page.getByRole("button", { name: "Usar validade" }).click();
  const newLotDialog = page.getByRole("dialog", { name: "Novo lote" });
  await expect(newLotDialog).toBeVisible();
  await expect(newLotDialog.getByLabel("Validade")).toHaveValue("2026-11-18");

  await newLotDialog.getByLabel("Quantidade").fill("2");
  await newLotDialog.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByRole("status")).toContainText("Entrada registrada");
  await expect(page.getByText("18/11/2026")).toBeVisible();
});

test("edits a lot and keeps the adjustment in history", async ({ page }) => {
  await page.getByRole("button", { name: /Coca-Cola 2L 30 unidades/u }).click();
  await page.getByLabel("Quantidade atual").fill("28");
  await page.getByRole("button", { name: /Salvar edição/u }).click();

  await expect(page.getByRole("status")).toContainText("Lote atualizado");
  await expect(page.getByText("28 unidades")).toBeVisible();

  await page.getByRole("button", { name: "Abrir histórico" }).click();
  await expect(page.getByText("Edição manual do lote")).toBeVisible();
});
