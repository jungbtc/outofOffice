import { expect, test } from "@playwright/test";

test("creates and switches between all three editor modules", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What will you make?" })).toBeVisible();

  await page.getByRole("button", { name: /New document/ }).click();
  await expect(page.getByLabel("Write editor")).toBeVisible();
  await page.getByLabel("Document content").fill("A local-first document");
  await expect(page.getByText("3 words")).toBeVisible();

  await page.getByRole("button", { name: "outofOffice home" }).click();
  await page.getByRole("button", { name: /New presentation/ }).click();
  await expect(page.getByLabel("Present editor")).toBeVisible();
  await page.getByRole("button", { name: "Add slide" }).click();
  await page.getByRole("button", { name: "Add rectangle" }).click();
  await expect(page.getByText("Slide 2 of 2")).toBeVisible();

  await page.getByRole("button", { name: "outofOffice home" }).click();
  await page.getByRole("button", { name: /New spreadsheet/ }).click();
  await expect(page.getByLabel("Calculate editor")).toBeVisible();
  await page.getByLabel("Formula input").fill("=SUM(10,20)");
  await page.getByLabel("B1", { exact: true }).click();
  await expect(page.getByLabel("A1", { exact: true })).toHaveValue("30");

  await expect(page.locator(".file-tab")).toHaveCount(3);
  await page.locator(".file-tab").first().getByRole("button").first().click();
  await expect(page.getByLabel("Write editor")).toBeVisible();
});

test("changes themes from application settings", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
