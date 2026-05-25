import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = await import("../../../test/setup");

describe("RatingsService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./ratings.service");
    service = mod.ratingsService;
  });

  describe("getRatings", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(service.getRatings("nonexistent", 1, 10)).rejects.toThrow(
        "Plugin not found",
      );
    });

    it("returns paginated ratings", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.rating.findMany.mockResolvedValue([
        { id: "r1", score: 5, user: { username: "user1" } },
      ]);
      mockPrisma.rating.count.mockResolvedValue(1);

      const result = await service.getRatings("test-plugin", 1, 10);
      expect(result.ratings).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe("getRatingSummary", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(service.getRatingSummary("nonexistent")).rejects.toThrow(
        "Plugin not found",
      );
    });

    it("returns rating summary with distribution", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.rating.findMany.mockResolvedValue([
        { score: 5 },
        { score: 5 },
        { score: 4 },
        { score: 3 },
        { score: 1 },
      ]);

      const result = await service.getRatingSummary("test-plugin");
      expect(result.total).toBe(5);
      expect(result.average).toBe(3.6);
      expect(result.distribution).toHaveLength(5);
      expect(result.distribution[4].count).toBe(2); // 5 stars
      expect(result.distribution[3].count).toBe(1); // 4 stars
    });

    it("returns zero average when no ratings", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.rating.findMany.mockResolvedValue([]);

      const result = await service.getRatingSummary("test-plugin");
      expect(result.average).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("submitRating", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(
        service.submitRating("nonexistent", "user1", 5),
      ).rejects.toThrow("Plugin not found");
    });

    it("throws when no approved versions exist", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        versions: [],
      });
      await expect(
        service.submitRating("test-plugin", "user1", 5),
      ).rejects.toThrow("Cannot rate a plugin with no available versions");
    });

    it("throws when score is out of range", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        versions: [{ id: "v1" }],
      });
      await expect(
        service.submitRating("test-plugin", "user1", 0),
      ).rejects.toThrow("Score must be between 1 and 5");
      await expect(
        service.submitRating("test-plugin", "user1", 6),
      ).rejects.toThrow("Score must be between 1 and 5");
    });

    it("creates a new rating", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        versions: [{ id: "v1" }],
      });
      mockPrisma.rating.findUnique.mockResolvedValue(null);
      mockPrisma.rating.upsert.mockResolvedValue({
        id: "r1",
        score: 5,
        user: { username: "user1" },
      });
      mockPrisma.rating.aggregate.mockResolvedValue({
        _avg: { score: 5 },
        _count: 1,
      });
      mockPrisma.plugin.update.mockResolvedValue({});

      const result = await service.submitRating("test-plugin", "user1", 5);
      expect(result.id).toBe("r1");
      expect(mockPrisma.rating.upsert).toHaveBeenCalled();
    });
  });

  describe("deleteRating", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(
        service.deleteRating("nonexistent", "user1"),
      ).rejects.toThrow("Plugin not found");
    });

    it("deletes rating", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.rating.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteRating("test-plugin", "user1");
      expect(mockPrisma.rating.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user1", pluginId: "p1" },
      });
    });
  });

  describe("replyToRating", () => {
    it("throws not supported error", async () => {
      await expect(
        service.replyToRating("slug", "r1", "reply", "user1"),
      ).rejects.toThrow("Replying to ratings is currently not supported");
    });
  });
});
