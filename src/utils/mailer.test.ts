import { describe, it, expect, vi, beforeEach } from "vitest";

describe("mailer utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendRejectionEmail", () => {
    it("skips when SMTP_PASS not set", async () => {
      const originalPass = process.env.SMTP_PASS;
      delete process.env.SMTP_PASS;

      const { sendRejectionEmail } = await import("./mailer");
      await sendRejectionEmail({
        to: "test@example.com",
        authorUsername: "author",
        pluginName: "Test Plugin",
        pluginSlug: "test-plugin",
        version: "1.0.0",
        submittedAt: new Date().toISOString(),
        reviewerUsername: "reviewer",
        reason: "Not good enough",
      });

      // Should not throw, just skip
      if (originalPass) process.env.SMTP_PASS = originalPass;
    });

    it("sends email when SMTP_PASS is set", async () => {
      process.env.SMTP_PASS = "test-password";
      const { sendRejectionEmail } = await import("./mailer");
      await sendRejectionEmail({
        to: "test@example.com",
        authorUsername: "author",
        pluginName: "Test Plugin",
        pluginSlug: "test-plugin",
        version: "1.0.0",
        submittedAt: new Date().toISOString(),
        reviewerUsername: "reviewer",
        reason: "Not good enough",
      });
      // Should not throw
      delete process.env.SMTP_PASS;
    });
  });

  describe("sendApprovalEmail", () => {
    it("skips when SMTP_PASS not set", async () => {
      const originalPass = process.env.SMTP_PASS;
      delete process.env.SMTP_PASS;

      const { sendApprovalEmail } = await import("./mailer");
      await sendApprovalEmail({
        to: "test@example.com",
        authorUsername: "author",
        pluginName: "Test Plugin",
        pluginSlug: "test-plugin",
        version: "1.0.0",
        reviewerUsername: "reviewer",
      });

      if (originalPass) process.env.SMTP_PASS = originalPass;
    });
  });
});
