import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = await import("../../../test/setup");

describe("BuildsService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./builds.service");
    service = mod.buildsService;
  });

  describe("getRecentBuilds", () => {
    it("returns paginated builds", async () => {
      mockPrisma.build.findMany.mockResolvedValue([
        { id: "b1", plugin: { name: "test" } },
      ]);
      mockPrisma.build.count.mockResolvedValue(1);

      const result = await service.getRecentBuilds(1, 10);
      expect(result.builds).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("applies status filter", async () => {
      mockPrisma.build.findMany.mockResolvedValue([]);
      mockPrisma.build.count.mockResolvedValue(0);

      await service.getRecentBuilds(1, 10, "SUCCESS");
      const whereArg = mockPrisma.build.findMany.mock.calls[0][0].where;
      expect(whereArg.status).toBe("SUCCESS");
    });

    it("applies branch filter", async () => {
      mockPrisma.build.findMany.mockResolvedValue([]);
      mockPrisma.build.count.mockResolvedValue(0);

      await service.getRecentBuilds(1, 10, undefined, "main");
      const whereArg = mockPrisma.build.findMany.mock.calls[0][0].where;
      expect(whereArg.branch).toBe("main");
    });
  });

  describe("getMyBuilds", () => {
    it("returns builds for user", async () => {
      mockPrisma.build.findMany.mockResolvedValue([
        { id: "b1", plugin: { name: "test" } },
      ]);

      const result = await service.getMyBuilds("user-1", 1, 10);
      expect(result).toHaveLength(1);
    });
  });

  describe("getPluginBuilds", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      mockPrisma.build.findMany.mockResolvedValue([]);
      mockPrisma.build.count.mockResolvedValue(0);

      await expect(
        service.getPluginBuilds("nonexistent", 1, 10),
      ).rejects.toThrow("Plugin not found");
    });

    it("returns plugin builds with version info for owner", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        name: "test",
        displayName: "Test",
        status: "APPROVED",
        reviewBuildId: null,
        pluginType: "PYTHON",
        authorId: "user-1",
        repoUrl: "https://github.com/test/repo",
        versions: [
          {
            status: "APPROVED",
            fileHash: "abc123",
            version: "1.0.0",
            fileUrl: "artifacts/test/1/file.zip",
          },
        ],
      });
      mockPrisma.build.findMany.mockResolvedValue([
        {
          id: "b1",
          buildNumber: 1,
          commitHash: "abc123",
          status: "SUCCESS",
          isRelease: true,
          artifactUrl: "artifacts/test/1/file.zip",
          artifactUrlLinux: null,
          artifactUrlWin: null,
        },
      ]);
      mockPrisma.build.count.mockResolvedValue(1);

      const result = await service.getPluginBuilds("test", 1, 10, "user-1");
      expect(result.builds[0].canSubmit).toBe(true);
      expect(result.builds[0].versionString).toBe("1.0.0");
    });
  });

  describe("getBuildDetail", () => {
    it("throws when build not found", async () => {
      mockPrisma.build.findUnique.mockResolvedValue(null);
      await expect(service.getBuildDetail("nonexistent")).rejects.toThrow(
        "Build not found",
      );
    });

    it("returns build detail", async () => {
      mockPrisma.build.findUnique.mockResolvedValue({
        id: "b1",
        plugin: { name: "test" },
      });

      const result = await service.getBuildDetail("b1");
      expect(result.id).toBe("b1");
    });
  });

  describe("getBuildStreamData", () => {
    it("returns build stream data", async () => {
      mockPrisma.build.findUnique.mockResolvedValue({
        logs: "some logs",
        status: "BUILDING",
        duration: null,
        finishedAt: null,
      });

      const result = await service.getBuildStreamData("b1");
      expect(result.logs).toBe("some logs");
    });
  });
});
