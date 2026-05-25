import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = await import("../../../test/setup");

describe("GithubService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./github.service");
    service = mod.githubService;
  });

  describe("getAccessToken", () => {
    it("returns access token when account exists", async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        access_token: "gho_test123",
      });

      const token = await service.getAccessToken("user-1");
      expect(token).toBe("gho_test123");
    });

    it("returns null when no account", async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      const token = await service.getAccessToken("user-1");
      expect(token).toBeNull();
    });
  });

  describe("getUserOrgs", () => {
    it("throws when no GitHub account linked", async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await expect(service.getUserOrgs("user-1")).rejects.toThrow(
        "GitHub account not linked",
      );
    });
  });

  describe("getUserRepos", () => {
    it("throws when no GitHub account linked", async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await expect(service.getUserRepos("user-1", 1, 10)).rejects.toThrow(
        "GitHub account not linked",
      );
    });
  });

  describe("disableCI", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findFirst.mockResolvedValue(null);
      await expect(
        service.disableCI("user-1", "nonexistent"),
      ).rejects.toThrow("Plugin not found");
    });

    it("clears webhookId", async () => {
      mockPrisma.plugin.findFirst.mockResolvedValue({
        id: "p1",
        webhookId: "12345",
        repoUrl: "https://github.com/owner/repo",
      });
      mockPrisma.account.findFirst.mockResolvedValue({
        access_token: "gho_test",
      });
      mockPrisma.plugin.update.mockResolvedValue({});

      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });

      await service.disableCI("user-1", "p1");

      expect(mockPrisma.plugin.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { webhookId: null },
      });
    });
  });

  describe("createGitHubWebhook", () => {
    it("returns webhook id on success", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 12345 }),
      });

      const id = await service.createGitHubWebhook(
        "gho_test",
        "owner",
        "repo",
      );
      expect(id).toBe(12345);
    });

    it("returns null on failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ message: "Validation Failed" }),
      });

      const id = await service.createGitHubWebhook(
        "gho_test",
        "owner",
        "repo",
      );
      expect(id).toBeNull();
    });

    it("returns null on network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const id = await service.createGitHubWebhook(
        "gho_test",
        "owner",
        "repo",
      );
      expect(id).toBeNull();
    });
  });

  describe("deleteGitHubWebhook", () => {
    it("returns true on success", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });

      const result = await service.deleteGitHubWebhook(
        "gho_test",
        "owner",
        "repo",
        123,
      );
      expect(result).toBe(true);
    });

    it("returns false on failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

      const result = await service.deleteGitHubWebhook(
        "gho_test",
        "owner",
        "repo",
        123,
      );
      expect(result).toBe(false);
    });
  });
});
