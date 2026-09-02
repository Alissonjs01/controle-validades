import { expect, test } from "@playwright/test";

test("renders the PWA foundation on mobile", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Controle de Validades", level: 1 })
  ).toBeVisible();
  await expect(page.getByLabel("Comando futuro")).toHaveValue(
    "Chegou 20 fardos de Coca 2L vence 10/10/2027"
  );
});
