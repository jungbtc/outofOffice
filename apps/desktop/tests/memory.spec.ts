import { expect, test } from "@playwright/test";

test("keeps retained editor heap bounded under repeated large input", async ({ page }) => {
  const session = await page.context().newCDPSession(page);
  await page.goto("/");
  await page.locator(".hero-actions .primary-action").click();
  await session.send("HeapProfiler.enable");
  await session.send("HeapProfiler.collectGarbage");
  const before = await session.send("Runtime.getHeapUsage");

  const elapsedMs = await page.getByLabel("Document content").evaluate(async (element) => {
    const editor = element as HTMLDivElement;
    const base = "A compact paragraph for memory testing. ".repeat(3_000);
    const startedAt = performance.now();
    for (let index = 0; index < 120; index += 1) {
      const offset = 1_000 + index;
      editor.textContent = `${base.slice(0, offset)}${String(index).padStart(4, "0")}${base.slice(offset + 4)}`;
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return performance.now() - startedAt;
  });

  await page.waitForTimeout(800);
  await session.send("HeapProfiler.collectGarbage");
  const after = await session.send("Runtime.getHeapUsage");
  const retainedDeltaBytes = after.usedSize - before.usedSize;
  console.log(
    `MEMORY_AUDIT ${JSON.stringify({
      beforeBytes: before.usedSize,
      afterBytes: after.usedSize,
      retainedDeltaBytes,
      elapsedMs,
    })}`,
  );

  expect(retainedDeltaBytes).toBeLessThan(8 * 1024 * 1024);
  expect(elapsedMs).toBeLessThan(4_000);
});
