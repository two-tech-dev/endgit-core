import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = await import("../../../test/setup");

describe("ReviewsService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./reviews.service");
    service = mod.reviewsService;
  });

  describe("getAutoChecks", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(service.getAutoChecks("nonexistent")).rejects.toThrow(
        "Plugin not found",
      );
    });

    it("returns auto checks", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.autoCheck.findMany.mockResolvedValue([
        { id: "ac1", tier: "TIER_1_AUTO", status: "PASSED" },
      ]);

      const result = await service.getAutoChecks("test-plugin");
      expect(result).toHaveLength(1);
    });
  });

  describe("getReviews", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(service.getReviews("nonexistent")).rejects.toThrow(
        "Plugin not found",
      );
    });

    it("returns reviews", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.review.findMany.mockResolvedValue([
        {
          id: "r1",
          decision: "APPROVED",
          reviewer: { username: "reviewer1" },
        },
      ]);

      const result = await service.getReviews("test-plugin");
      expect(result).toHaveLength(1);
    });
  });

  describe("submitReview", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(
        service.submitReview("nonexistent", "reviewer1", {
          decision: "APPROVED",
        }),
      ).rejects.toThrow("Plugin not found");
    });

    it("throws when decision is missing", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        status: "PENDING_REVIEW",
        author: { id: "u1", username: "author", email: "a@b.com" },
      });
      await expect(
        service.submitReview("test", "reviewer1", {}),
      ).rejects.toThrow("decision is required");
    });
  });

  describe("getReviewQueue", () => {
    it("returns pending plugins", async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([
        { id: "p1", status: "PENDING_REVIEW" },
      ]);

      const result = await service.getReviewQueue();
      expect(result).toHaveLength(1);
    });
  });
});
