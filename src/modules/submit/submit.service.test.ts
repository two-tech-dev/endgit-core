import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = await import("../../../test/setup");

describe("SubmitService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./submit.service");
    service = mod.submitService;
  });

  describe("submitBuild", () => {
    it("throws when build not found", async () => {
      mockPrisma.build.findUnique.mockResolvedValue(null);
      await expect(
        service.submitBuild("nonexistent", {}, "user1"),
      ).rejects.toThrow("Build not found");
    });

    it("throws when user is not the plugin author", async () => {
      mockPrisma.build.findUnique.mockResolvedValue({
        id: "b1",
        status: "SUCCESS",
        plugin: { authorId: "user1" },
      });
      await expect(service.submitBuild("b1", {}, "user2")).rejects.toThrow(
        "You can only submit your own builds",
      );
    });

    it("throws when build is not successful", async () => {
      mockPrisma.build.findUnique.mockResolvedValue({
        id: "b1",
        status: "FAILED",
        plugin: { authorId: "user1" },
      });
      await expect(service.submitBuild("b1", {}, "user1")).rejects.toThrow(
        "Only successful builds can be submitted for review",
      );
    });

    it("throws when version and displayName are missing", async () => {
      mockPrisma.build.findUnique.mockResolvedValue({
        id: "b1",
        status: "SUCCESS",
        buildNumber: 1,
        pluginId: "p1",
        plugin: {
          id: "p1",
          authorId: "user1",
          status: "DRAFT",
          name: "test",
          slug: "test",
          displayName: "Test",
          reviewBuildId: null,
          iconUrl: null,
          repoUrl: null,
          author: { username: "user1" },
        },
      });
      await expect(
        service.submitBuild("b1", { version: "1.0.0" }, "user1"),
      ).rejects.toThrow("Version and Display Name are required");
    });

    it("throws when producers array is missing", async () => {
      mockPrisma.build.findUnique.mockResolvedValue({
        id: "b1",
        status: "SUCCESS",
        buildNumber: 1,
        pluginId: "p1",
        plugin: {
          id: "p1",
          authorId: "user1",
          status: "DRAFT",
          name: "test",
          slug: "test",
          displayName: "Test",
          reviewBuildId: null,
          iconUrl: null,
          repoUrl: null,
          author: { username: "user1" },
        },
      });
      await expect(
        service.submitBuild(
          "b1",
          { version: "1.0.0", displayName: "Test v1" },
          "user1",
        ),
      ).rejects.toThrow("At least one producer is required");
    });
  });

  describe("getStatus", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(service.getStatus("nonexistent")).rejects.toThrow(
        "Plugin not found",
      );
    });

    it("returns plugin status", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        status: "PENDING_REVIEW",
        reviewBuildId: "b1",
        reviews: [
          {
            decision: "REQUEST_CHANGES",
            comment: "Fix this",
            createdAt: new Date(),
            reviewer: { username: "reviewer1" },
          },
        ],
      });

      const result = await service.getStatus("test-plugin");
      expect(result.status).toBe("PENDING_REVIEW");
      expect(result.reviewBuildId).toBe("b1");
      expect(result.latestReview).toBeDefined();
    });
  });
});
