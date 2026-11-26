import { defineConfig } from "@playwright/test";
import process from "node:process";

export default defineConfig({
  testDir: "./test/browser",
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined,
  },
  webServer: {
    command: "pnpm run dev --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    env: { VITE_API_BASE_URL: "/backend" },
  },
});
