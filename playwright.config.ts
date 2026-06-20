import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "https://pluribus.danielasiegbunam.com",
    headless: true,
    ignoreHTTPSErrors: true,
  },
  projects: [{ name: "chromium", use: { channel: "chromium" } }],
});
