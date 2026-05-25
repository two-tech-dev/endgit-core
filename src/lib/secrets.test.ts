import { describe, it, expect, vi, beforeEach } from "vitest";

describe("requireSecret", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the secret when env var exists and is >= 32 chars", async () => {
    const longSecret = "a".repeat(32);
    process.env.TEST_SECRET = longSecret;
    const { requireSecret } = await import("./secrets");
    expect(requireSecret("TEST_SECRET")).toBe(longSecret);
    delete process.env.TEST_SECRET;
  });

  it("throws when env var is missing", async () => {
    delete process.env.MISSING_SECRET;
    const { requireSecret } = await import("./secrets");
    expect(() => requireSecret("MISSING_SECRET")).toThrow(
      "MISSING_SECRET must be configured with a secret of at least 32 characters.",
    );
  });

  it("throws when env var is too short", async () => {
    process.env.SHORT_SECRET = "tooshort";
    const { requireSecret } = await import("./secrets");
    expect(() => requireSecret("SHORT_SECRET")).toThrow(
      "SHORT_SECRET must be configured with a secret of at least 32 characters.",
    );
    delete process.env.SHORT_SECRET;
  });

  it("throws when env var is empty string", async () => {
    process.env.EMPTY_SECRET = "";
    const { requireSecret } = await import("./secrets");
    expect(() => requireSecret("EMPTY_SECRET")).toThrow();
    delete process.env.EMPTY_SECRET;
  });

  it("returns secret exactly 32 characters", async () => {
    const exactSecret = "b".repeat(32);
    process.env.EXACT_SECRET = exactSecret;
    const { requireSecret } = await import("./secrets");
    expect(requireSecret("EXACT_SECRET")).toBe(exactSecret);
    delete process.env.EXACT_SECRET;
  });

  it("returns secret longer than 32 characters", async () => {
    const longSecret = "c".repeat(64);
    process.env.LONG_SECRET = longSecret;
    const { requireSecret } = await import("./secrets");
    expect(requireSecret("LONG_SECRET")).toBe(longSecret);
    delete process.env.LONG_SECRET;
  });
});
