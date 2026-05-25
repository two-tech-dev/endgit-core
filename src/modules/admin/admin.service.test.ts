import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = await import("../../../test/setup");

describe("AdminService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./admin.service");
    service = mod.adminService;
  });

  describe("getUsers", () => {
    it("returns paginated users", async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: "u1", username: "admin" },
      ]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.getUsers(1, 10);
      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("applies search filter", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.getUsers(1, 10, "test");
      const whereArg = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeDefined();
    });
  });

  describe("updateUserTrustLevel", () => {
    it("throws on invalid trust level", async () => {
      await expect(
        service.updateUserTrustLevel("u1", "INVALID"),
      ).rejects.toThrow("Invalid trust level");
    });

    it("updates trust level", async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: "u1",
        username: "test",
        trustLevel: "TRUSTED",
      });

      const result = await service.updateUserTrustLevel("u1", "TRUSTED");
      expect(result.trustLevel).toBe("TRUSTED");
    });
  });

  describe("updateUserQuota", () => {
    it("throws on invalid quota", async () => {
      await expect(service.updateUserQuota("u1", 0)).rejects.toThrow(
        "Quota must be between 1 and 10000",
      );
      await expect(service.updateUserQuota("u1", -1)).rejects.toThrow(
        "Quota must be between 1 and 10000",
      );
      await expect(service.updateUserQuota("u1", 10001)).rejects.toThrow(
        "Quota must be between 1 and 10000",
      );
      await expect(service.updateUserQuota("u1", NaN)).rejects.toThrow(
        "Quota must be between 1 and 10000",
      );
    });

    it("updates quota", async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: "u1",
        username: "test",
        weeklyBuildQuota: 100,
      });

      const result = await service.updateUserQuota("u1", 100);
      expect(result.weeklyBuildQuota).toBe(100);
    });
  });

  describe("getSystemStats", () => {
    it("returns system stats", async () => {
      mockPrisma.user.count.mockResolvedValue(50);
      mockPrisma.plugin.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(5);
      mockPrisma.build.count.mockResolvedValue(100);

      const result = await service.getSystemStats();
      expect(result.users).toBe(50);
      expect(result.plugins).toBe(20);
      expect(result.builds).toBe(100);
      expect(result.pendingReviews).toBe(5);
    });
  });

  describe("getPlugins", () => {
    it("returns paginated plugins", async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([
        { id: "p1", name: "test" },
      ]);
      mockPrisma.plugin.count.mockResolvedValue(1);

      const result = await service.getPlugins(1, 10);
      expect(result.plugins).toHaveLength(1);
    });

    it("applies status filter", async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([]);
      mockPrisma.plugin.count.mockResolvedValue(0);

      await service.getPlugins(1, 10, undefined, "APPROVED");
      const whereArg = mockPrisma.plugin.findMany.mock.calls[0][0].where;
      expect(whereArg.status).toBe("APPROVED");
    });
  });

  describe("updatePluginStatus", () => {
    it("throws on invalid status", async () => {
      await expect(
        service.updatePluginStatus("p1", "INVALID"),
      ).rejects.toThrow("Invalid plugin status");
    });

    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(
        service.updatePluginStatus("p1", "APPROVED"),
      ).rejects.toThrow("Plugin not found");
    });

    it("returns early when status is unchanged", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        status: "APPROVED",
      });

      const result = await service.updatePluginStatus("p1", "APPROVED");
      expect(result.id).toBe("p1");
      expect(mockPrisma.plugin.update).not.toHaveBeenCalled();
    });

    it("updates status and creates audit log", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        status: "APPROVED",
        slug: "test",
        displayName: "Test",
        author: { id: "u1", username: "author", email: "a@b.com" },
        versions: [],
      });
      mockPrisma.plugin.update.mockResolvedValue({
        id: "p1",
        slug: "test",
        status: "SUSPENDED",
      });
      mockPrisma.version.updateMany.mockResolvedValue({});
      mockPrisma.moderationLog.create.mockResolvedValue({});

      const adminUser = { id: "admin1", username: "admin" };
      const result = await service.updatePluginStatus(
        "p1",
        "SUSPENDED",
        "Violation",
        adminUser,
      );

      expect(mockPrisma.moderationLog.create).toHaveBeenCalled();
      expect(mockPrisma.version.updateMany).toHaveBeenCalled();
    });
  });

  describe("updateVersionStatus", () => {
    it("throws on invalid status", async () => {
      await expect(
        service.updateVersionStatus("v1", "INVALID"),
      ).rejects.toThrow("Invalid version status");
    });

    it("throws when version not found", async () => {
      mockPrisma.version.findUnique.mockResolvedValue(null);
      await expect(
        service.updateVersionStatus("v1", "APPROVED"),
      ).rejects.toThrow("Version not found");
    });
  });

  describe("toggleFeatured", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(service.toggleFeatured("p1")).rejects.toThrow(
        "Plugin not found",
      );
    });

    it("toggles featured status", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        isFeatured: false,
      });
      mockPrisma.plugin.update.mockResolvedValue({
        id: "p1",
        slug: "test",
        displayName: "Test",
        isFeatured: true,
      });

      const result = await service.toggleFeatured("p1");
      expect(result.isFeatured).toBe(true);
    });
  });
});
