import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/lib/server/app-service.ts",
        "src/lib/server/profit-sharing.ts",
        "src/lib/server/reporting.ts",
        "src/lib/server/rbac.ts",
        "src/lib/server/route-error.ts",
        "src/lib/server/timezone.ts",
        "src/lib/server/validation.ts",
      ],
      exclude: ["src/lib/server/pdf-pcm.tsx"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 45,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
