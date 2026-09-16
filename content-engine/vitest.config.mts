import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["tests/unit/setup.ts"],
    env: {
      ENCRYPTION_KEY: "dGVzdC1lbmNyeXB0aW9uLWtleS0zMmJ5dGVzLWxvbmc=",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/unit/server-only-stub.ts") },
  },
});
