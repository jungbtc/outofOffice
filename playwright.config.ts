import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "apps/desktop/tests",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:1420", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm --filter @outofoffice/desktop preview --host 127.0.0.1 --port 1420",
    port: 1420,
    reuseExistingServer: true,
  },
});
