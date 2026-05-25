import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "packages/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "packages/*/src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "packages/**/*.test.ts",
        "src/index.ts",
        "packages/database/src/index.ts",
        "packages/database/prisma/**",
      ],
    },
    setupFiles: ["./test/setup.ts"],
  },
});
