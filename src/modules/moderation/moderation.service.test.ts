import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = await import("../../../test/setup");

describe("ModerationService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./moderation.service");
    service = mod.moderationService;
  });

  describe("reportPlugin", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(
        service.reportPlugin("nonexistent", "user1", "MALWARE"),
      ).rejects.toThrow("Plugin not found");
    });

    it("throws when reason is missing", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      await expect(
        service.reportPlugin("test-plugin", "user1", ""),
      ).rejects.toThrow("reason is required");
    });

    it("creates a report", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.report.create.mockResolvedValue({ id: "r1" });
      mockPrisma.report.count.mockResolvedValue(1);

      const result = await service.reportPlugin(
        "test-plugin",
        "user1",
        "MALWARE",
        "Details here",
      );
      expect(result.id).toBe("r1");
    });

    it("auto-flags plugin at 3 unresolved reports", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        status: "APPROVED",
      });
      mockPrisma.report.create.mockResolvedValue({ id: "r1" });
      mockPrisma.report.count.mockResolvedValue(3);
      mockPrisma.plugin.update.mockResolvedValue({});

      await service.reportPlugin("test-plugin", "user1", "SPAM");

      expect(mockPrisma.plugin.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { status: "FLAGGED" },
      });
    });

    it("does not re-flag an already flagged plugin", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        status: "FLAGGED",
      });
      mockPrisma.report.create.mockResolvedValue({ id: "r1" });
      mockPrisma.report.count.mockResolvedValue(5);

      await service.reportPlugin("test-plugin", "user1", "SPAM");

      expect(mockPrisma.plugin.update).not.toHaveBeenCalled();
    });
  });

  describe("ratePlugin", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(
        service.ratePlugin("nonexistent", "user1", 5),
      ).rejects.toThrow("Plugin not found");
    });

    it("throws when score is out of range", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      await expect(
        service.ratePlugin("test-plugin", "user1", 0),
      ).rejects.toThrow("score must be 1-5");
      await expect(
        service.ratePlugin("test-plugin", "user1", 6),
      ).rejects.toThrow("score must be 1-5");
    });

    it("upserts a rating", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.rating.upsert.mockResolvedValue({
        id: "r1",
        score: 4,
      });

      const result = await service.ratePlugin(
        "test-plugin",
        "user1",
        4,
        "Good",
      );
      expect(result.score).toBe(4);
    });
  });

  describe("getRatings", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(service.getRatings("nonexistent")).rejects.toThrow(
        "Plugin not found",
      );
    });

    it("returns ratings", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.rating.findMany.mockResolvedValue([
        { id: "r1", score: 5, user: { username: "user1" } },
      ]);

      const result = await service.getRatings("test-plugin");
      expect(result).toHaveLength(1);
    });
  });

  describe("updateTrustLevel", () => {
    it("throws on invalid trust level", async () => {
      await expect(
        service.updateTrustLevel("user1", "INVALID"),
      ).rejects.toThrow("Invalid trust level");
    });

    it("updates trust level", async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: "user1",
        username: "testuser",
        trustLevel: "TRUSTED",
      });

      const result = await service.updateTrustLevel("user1", "TRUSTED");
      expect(result.trustLevel).toBe("TRUSTED");
    });

    it("accepts all valid trust levels", async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: "u1",
        username: "test",
        trustLevel: "NEW",
      });
      for (const level of ["NEW", "TRUSTED", "FLAGGED", "ADMIN"]) {
        await expect(
          service.updateTrustLevel("u1", level),
        ).resolves.toBeDefined();
      }
    });
  });
});
