import react from "@vitejs/plugin-react";
import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    exclude: [...configDefaults.exclude, "e2e/**"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/components/**/*.tsx", "src/lib/**/*.ts", "src/store/**/*.ts"],
      exclude: ["src/**/__tests__/**", "src/test/**", "src/types/**"],
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        statements: 58,
        branches: 52,
        functions: 47,
        lines: 60
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
});
