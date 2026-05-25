import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = await import("../../../test/setup");

describe("DashboardService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./dashboard.service");
    service = mod.dashboardService;
  });

  describe("getStatus", () => {
    it("returns status with expired token when no account", async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        weeklyBuildQuota: 50,
        weeklyBuildCount: 10,
        quotaResetAt: new Date(Date.now() + 86400000),
      });

      const result = await service.getStatus("user-1");
      expect(result.githubTokenExpired).toBe(true);
      expect(result.hasAppInstalled).toBe(false);
      expect(result.quota.used).toBe(10);
      expect(result.quota.limit).toBe(50);
    });

    it("resets quota when reset time has passed", async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        weeklyBuildQuota: 50,
        weeklyBuildCount: 10,
        quotaResetAt: new Date(Date.now() - 86400000), // Past
      });

      const result = await service.getStatus("user-1");
      expect(result.quota.used).toBe(0);
    });
  });

  describe("getMyPlugins", () => {
    it("returns plugins with version info", async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([
        {
          id: "p1",
          slug: "test",
          versions: [{ version: "1.0.0" }],
          _count: { versions: 3, ratings: 5, reports: 0 },
        },
      ]);

      const result = await service.getMyPlugins("user-1");
      expect(result).toHaveLength(1);
      expect(result[0].latestVersion).toBe("1.0.0");
      expect(result[0].versionCount).toBe(3);
    });

    it("handles plugins with no versions", async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([
        {
          id: "p1",
          slug: "test",
          versions: [],
          _count: { versions: 0, ratings: 0, reports: 0 },
        },
      ]);

      const result = await service.getMyPlugins("user-1");
      expect(result[0].latestVersion).toBeNull();
    });
  });

  describe("getMyStats", () => {
    it("returns user stats", async () => {
      mockPrisma.plugin.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
      mockPrisma.plugin.aggregate.mockResolvedValue({
        _sum: { downloads: 1000 },
      });
      mockPrisma.version.count.mockResolvedValue(15);

      const result = await service.getMyStats("user-1");
      expect(result.totalPlugins).toBe(5);
      expect(result.totalDownloads).toBe(1000);
      expect(result.totalVersions).toBe(15);
      expect(result.pendingReviews).toBe(2);
    });

    it("returns 0 downloads when no plugins", async () => {
      mockPrisma.plugin.count.mockResolvedValue(0);
      mockPrisma.plugin.aggregate.mockResolvedValue({
        _sum: { downloads: null },
      });
      mockPrisma.version.count.mockResolvedValue(0);

      const result = await service.getMyStats("user-1");
      expect(result.totalDownloads).toBe(0);
    });
  });
});
