import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.ENDGIT_WEBHOOK_SECRET!;

describe("WebhooksService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./webhooks.service");
    service = mod.webhooksService;
  });

  describe("verifySignature", () => {
    it("returns true for a valid signature", () => {
      const payload = Buffer.from('{"test": true}');
      const expectedSig =
        "sha256=" +
        crypto
          .createHmac("sha256", WEBHOOK_SECRET)
          .update(payload)
          .digest("hex");
      expect(service.verifySignature(payload, expectedSig)).toBe(true);
    });

    it("returns false for an invalid signature", () => {
      const payload = Buffer.from('{"test": true}');
      expect(service.verifySignature(payload, "sha256=invalidsignature")).toBe(
        false,
      );
    });

    it("returns false when signature is undefined", () => {
      const payload = Buffer.from('{"test": true}');
      expect(service.verifySignature(payload, undefined)).toBe(false);
    });

    it("returns false for empty string signature", () => {
      const payload = Buffer.from('{"test": true}');
      expect(service.verifySignature(payload, "")).toBe(false);
    });

    it("returns false when payload is tampered", () => {
      const payload = Buffer.from('{"test": true}');
      const tamperedPayload = Buffer.from('{"test": false}');
      const sig =
        "sha256=" +
        crypto
          .createHmac("sha256", WEBHOOK_SECRET)
          .update(payload)
          .digest("hex");
      expect(service.verifySignature(tamperedPayload, sig)).toBe(false);
    });
  });

  describe("processGitHubPush", () => {
    it("ignores tag pushes", async () => {
      const payload = {
        ref: "refs/tags/v1.0.0",
        repository: { html_url: "https://github.com/test/repo" },
      };
      const result = await service.processGitHubPush(payload);
      expect(result.queued).toBe(false);
      expect(result.message).toContain("Ignored tag push");
    });

    it("throws when repository URL is missing", async () => {
      const payload = {
        ref: "refs/heads/main",
        repository: {},
      };
      await expect(service.processGitHubPush(payload)).rejects.toThrow(
        "Missing repository URL",
      );
    });
  });
});
