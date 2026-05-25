import { describe, it, expect, vi, beforeEach } from "vitest";

describe("discord utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    });
  });

  describe("sendPluginApprovedWebhook", () => {
    it("skips when webhook URL not set", async () => {
      delete process.env.DISCORD_WEBHOOK_APPROVED_PLUGIN;
      const { sendPluginApprovedWebhook } = await import("./discord");
      await sendPluginApprovedWebhook({}, {}, "reviewer");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("sends webhook when URL is set", async () => {
      process.env.DISCORD_WEBHOOK_APPROVED_PLUGIN =
        "https://discord.com/api/webhooks/test";
      const { sendPluginApprovedWebhook } = await import("./discord");
      await sendPluginApprovedWebhook(
        {
          slug: "test",
          displayName: "Test Plugin",
          description: "A test",
          tags: ["economy"],
          iconUrl: null,
          author: { username: "author1" },
        },
        {
          version: "1.0.0",
          changelog: "Initial release",
          producers: [{ githubUser: "dev1" }],
        },
        "reviewer1",
      );
      expect(global.fetch).toHaveBeenCalled();
      delete process.env.DISCORD_WEBHOOK_APPROVED_PLUGIN;
    });
  });

  describe("sendNewRatingWebhook", () => {
    it("skips when webhook URL not set", async () => {
      delete process.env.DISCORD_WEBHOOK_NEW_RATING;
      const { sendNewRatingWebhook } = await import("./discord");
      await sendNewRatingWebhook({}, { score: 5 }, "user1");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("sends webhook when URL is set", async () => {
      process.env.DISCORD_WEBHOOK_NEW_RATING =
        "https://discord.com/api/webhooks/test";
      const { sendNewRatingWebhook } = await import("./discord");
      await sendNewRatingWebhook(
        { slug: "test", displayName: "Test", iconUrl: null },
        { score: 4, comment: "Good plugin" },
        "user1",
      );
      expect(global.fetch).toHaveBeenCalled();
      delete process.env.DISCORD_WEBHOOK_NEW_RATING;
    });
  });

  describe("sendPluginSubmittedWebhook", () => {
    it("skips when webhook URL not set", async () => {
      delete process.env.DISCORD_WEBHOOK_SUBMITTED_PLUGIN;
      delete process.env.DISCORD_WEBHOOK_APPROVED_PLUGIN;
      const { sendPluginSubmittedWebhook } = await import("./discord");
      await sendPluginSubmittedWebhook({}, "1.0.0", "user1");
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("sendPluginModerationWebhook", () => {
    it("skips when webhook URL not set", async () => {
      delete process.env.DISCORD_WEBHOOK_MODERATION;
      delete process.env.DISCORD_WEBHOOK_APPROVED_PLUGIN;
      const { sendPluginModerationWebhook } = await import("./discord");
      await sendPluginModerationWebhook({}, "REJECTED", "reason", "admin");
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("sendPluginReportWebhook", () => {
    it("skips when webhook URL not set", async () => {
      delete process.env.DISCORD_WEBHOOK_MODERATION;
      delete process.env.DISCORD_WEBHOOK_APPROVED_PLUGIN;
      const { sendPluginReportWebhook } = await import("./discord");
      await sendPluginReportWebhook({}, "reporter", "MALWARE");
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
