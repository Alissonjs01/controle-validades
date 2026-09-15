import { expect, type Page, test } from "@playwright/test";


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

test("shows notifications and no camera action", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Ler validade" })).toHaveCount(0);
  await page.getByRole("button", { name: "Preferências de avisos" }).click();
  await expect(page.getByRole("heading", { name: "Alertas de validade" })).toBeVisible();
  await expect(page.getByLabel("30 dias antes")).toBeChecked();
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
