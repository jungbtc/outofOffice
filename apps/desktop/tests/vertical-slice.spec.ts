import { expect, test } from "@playwright/test";

test("creates, edits, renames, and duplicates a Word document", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Write without the weight." })).toBeVisible();

  await page.locator(".hero-actions .primary-action").click();
  await expect(page.getByLabel("Write editor")).toBeVisible();
  const editor = page.getByLabel("Document content");
  await editor.fill("A fast local document");
  await expect(page.getByText("4 words")).toBeVisible();

  const title = page.getByLabel("Document title");
  await title.fill("Project brief");
  await title.press("Enter");
  await expect(page.getByRole("tab", { name: /Project brief/ })).toBeVisible();

  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.getByRole("tab", { name: /Project brief copy/ })).toBeVisible();
  await expect(page.locator(".file-tab")).toHaveCount(2);
});

test("formats content and applies real page settings", async ({ page }) => {
  await page.goto("/");
  await page.locator(".hero-actions .primary-action").click();
  const editor = page.getByLabel("Document content");
  await editor.fill("Format this text");
  await editor.selectText();
  await page.getByRole("button", { name: "Italic (Ctrl+I)" }).click();
  await expect(editor).toContainText("Format this text");
  expect(await editor.evaluate((element) => element.innerHTML)).toMatch(
    /<(i|em)>|font-style:\s*italic/i,
  );

  await page.getByLabel("Page orientation").selectOption("landscape");
  await page.getByLabel("Page margins").selectOption("12");
  await expect(editor).toHaveCSS("padding-top", /45\.3|45\.35|45\.36/);

  await page.getByRole("button", { name: "Find and replace (Ctrl+F)" }).click();
  await page.getByRole("textbox", { name: "Find", exact: true }).fill("this");
  await page.getByRole("button", { name: "Find next" }).click();
  await expect(page.getByText(/Found at character/)).toBeVisible();
});

test("offers save, discard, and cancel for unsaved documents", async ({ page }) => {
  await page.goto("/");
  await page.locator(".hero-actions .primary-action").click();
  await page.getByLabel("Document content").fill("Do not lose this");
  await page.getByRole("button", { name: /Close Untitled document/ }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Write editor")).toBeVisible();

  await page.getByRole("button", { name: /Close Untitled document/ }).click();
  await page.getByRole("button", { name: "Don’t save" }).click();
  await expect(page.getByRole("heading", { name: "Write without the weight." })).toBeVisible();
});

test("changes themes from application settings", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
