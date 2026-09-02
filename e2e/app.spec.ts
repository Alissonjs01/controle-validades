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

  await expect(page.getByText("Coca-Cola 2L").first()).toBeVisible();
  await expect(page.getByText("Água Mineral 500ml")).toBeVisible();
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
