import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3001",
    channel: "chromium",
    launchOptions: { args: ["--no-sandbox"] },
  },
  webServer: {
    command:
      "LIBRARY_ROOT=./tests/fixtures LIBRARY_DATA_DIR=./.test-data bun --bun next dev --hostname 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001/cookie",
    reuseExistingServer: false,
  },
  timeout: 60000,
});
