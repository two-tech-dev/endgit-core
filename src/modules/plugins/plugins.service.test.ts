import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = await import("../../../test/setup");

describe("PluginsService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./plugins.service");
    service = mod.pluginsService;
  });

  describe("listPlugins", () => {
    it("returns paginated plugins with defaults", async () => {
      const mockPlugins = [
        {
          id: "1",
          name: "test",
          slug: "test",
          displayName: "Test",
          versions: [{ version: "1.0.0", isPreRelease: false }],
        },
      ];
      mockPrisma.plugin.findMany.mockResolvedValue(mockPlugins);
      mockPrisma.plugin.count.mockResolvedValue(1);

      const result = await service.listPlugins({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.plugins[0].latestVersion).toBe("1.0.0");
    });

    it("clamps pageSize to max 50", async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([]);
      mockPrisma.plugin.count.mockResolvedValue(0);

      const result = await service.listPlugins({ pageSize: "100" });
      expect(result.pageSize).toBe(50);
    });

    it("defaults pageSize to 20 when 0 is passed (0 is falsy)", async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([]);
      mockPrisma.plugin.count.mockResolvedValue(0);

      const result = await service.listPlugins({ pageSize: "0" });
      expect(result.pageSize).toBe(20);
    });

    it("clamps page to min 1", async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([]);
      mockPrisma.plugin.count.mockResolvedValue(0);

      const result = await service.listPlugins({ page: "0" });
      expect(result.page).toBe(1);
    });

    it("filters by tag", async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([]);
      mockPrisma.plugin.count.mockResolvedValue(0);

      await service.listPlugins({ tag: "economy" });

      const whereArg = mockPrisma.plugin.findMany.mock.calls[0][0].where;
      expect(whereArg.tags).toEqual({ has: "economy" });
    });

    it("filters by type when valid", async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([]);
      mockPrisma.plugin.count.mockResolvedValue(0);

      await service.listPlugins({ type: "CPP" });

      const whereArg = mockPrisma.plugin.findMany.mock.calls[0][0].where;
      expect(whereArg.pluginType).toBe("CPP");
    });

    it("ignores invalid type filter", async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([]);
      mockPrisma.plugin.count.mockResolvedValue(0);

      await service.listPlugins({ type: "INVALID" });

      const whereArg = mockPrisma.plugin.findMany.mock.calls[0][0].where;
      expect(whereArg.pluginType).toBeUndefined();
    });
  });

  describe("getBySlug", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(service.getBySlug("nonexistent")).rejects.toThrow(
        "Plugin not found",
      );
    });

    it("returns plugin data for approved plugin", async () => {
      const mockPlugin = {
        id: "1",
        slug: "test",
        status: "APPROVED",
        authorId: "user-1",
        versions: [
          {
            id: "v1",
            version: "1.0.0",
            status: "APPROVED",
            isLatest: true,
            vtScanId: null,
            vtStatus: null,
            vtMalicious: null,
            vtSuspicious: null,
            vtUndetected: null,
            vtTotal: null,
            vtPermalink: null,
            vtScanDate: null,
          },
        ],
        ratings: [{ score: 4 }, { score: 5 }],
        author: { username: "author", displayName: "Author", avatarUrl: null },
      };
      mockPrisma.plugin.findUnique.mockResolvedValue(mockPlugin);
      mockPrisma.rating.aggregate.mockResolvedValue({
        _count: 2,
        _avg: { score: 4.5 },
      });

      const result = await service.getBySlug("test");
      expect(result.averageRating).toBe(4.5);
      expect(result.totalRatings).toBe(2);
      expect(result.latestVersion).toBe("1.0.0");
    });

    it("hides non-approved plugin from non-owner", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "1",
        slug: "test",
        status: "DRAFT",
        authorId: "user-1",
        versions: [],
        ratings: [],
      });

      await expect(
        service.getBySlug("test", { id: "user-2", trustLevel: "NEW" }),
      ).rejects.toThrow("Plugin not found");
    });

    it("shows non-approved plugin to admin", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "1",
        slug: "test",
        status: "DRAFT",
        authorId: "user-1",
        versions: [],
        ratings: [],
      });

      const result = await service.getBySlug("test", {
        id: "admin-1",
        trustLevel: "ADMIN",
      });
      expect(result).toBeDefined();
    });
  });

  describe("createPlugin", () => {
    it("throws when required fields are missing", async () => {
      await expect(
        service.createPlugin({ name: "test" }, "user-1"),
      ).rejects.toThrow("name, displayName, and description are required");
    });

    it("throws when plugin name already exists", async () => {
      mockPrisma.plugin.findFirst.mockResolvedValue({ id: "existing" });
      await expect(
        service.createPlugin(
          {
            name: "test",
            displayName: "Test",
            description: "A test plugin",
          },
          "user-1",
        ),
      ).rejects.toThrow("A plugin with this name already exists");
    });

    it("creates a plugin with valid data", async () => {
      mockPrisma.plugin.findFirst.mockResolvedValue(null);
      mockPrisma.plugin.create.mockResolvedValue({
        id: "new-plugin",
        name: "my-plugin",
        slug: "my-plugin",
        displayName: "My Plugin",
      });

      const result = await service.createPlugin(
        {
          name: "My-Plugin",
          displayName: "My Plugin",
          description: "A test plugin",
        },
        "user-1",
      );

      expect(mockPrisma.plugin.create).toHaveBeenCalled();
      expect(result.id).toBe("new-plugin");
    });
  });

  describe("updatePlugin", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(
        service.updatePlugin("nonexistent", {}, { id: "user-1" }),
      ).rejects.toThrow("Plugin not found");
    });

    it("throws when user is not authorized", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "1",
        authorId: "user-1",
        displayName: "Test",
      });
      await expect(
        service.updatePlugin("test", {}, { id: "user-2", trustLevel: "NEW" }),
      ).rejects.toThrow("Not authorized");
    });

    it("allows admin to update any plugin", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "1",
        authorId: "user-1",
        displayName: "Test",
      });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          plugin: {
            update: vi.fn().mockResolvedValue({
              id: "1",
              displayName: "Updated",
            }),
          },
          version: { findFirst: vi.fn().mockResolvedValue(null) },
        };
        return fn(tx);
      });

      const result = await service.updatePlugin(
        "test",
        { displayName: "Updated" },
        { id: "admin-1", trustLevel: "ADMIN" },
      );
      expect(result).toBeDefined();
    });
  });

  describe("deletePlugin", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(
        service.deletePlugin("nonexistent", { id: "user-1" }),
      ).rejects.toThrow("Plugin not found");
    });

    it("throws when user is not authorized", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "1",
        authorId: "user-1",
      });
      await expect(
        service.deletePlugin("test", { id: "user-2", trustLevel: "NEW" }),
      ).rejects.toThrow("Not authorized");
    });

    it("deletes plugin when authorized", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "1",
        authorId: "user-1",
      });
      mockPrisma.plugin.delete.mockResolvedValue({});

      await service.deletePlugin("test", { id: "user-1" });
      expect(mockPrisma.plugin.delete).toHaveBeenCalledWith({
        where: { slug: "test" },
      });
    });
  });

  describe("getGlobalStats", () => {
    it("returns aggregated stats", async () => {
      mockPrisma.plugin.count.mockResolvedValue(10);
      mockPrisma.plugin.aggregate.mockResolvedValue({
        _sum: { downloads: 5000 },
      });
      mockPrisma.build.count.mockResolvedValue(50);

      const result = await service.getGlobalStats();
      expect(result.plugins).toBe(10);
      expect(result.downloads).toBe(5000);
      expect(result.builds).toBe(50);
    });
  });

  describe("getTrending", () => {
    it("returns trending plugins", async () => {
      const mockPlugins = [
        {
          id: "1",
          slug: "popular",
          displayName: "Popular Plugin",
          versions: [{ version: "2.0.0", isPreRelease: false }],
        },
      ];
      mockPrisma.plugin.findMany.mockResolvedValue(mockPlugins);

      const result = await service.getTrending();
      expect(result).toHaveLength(1);
      expect(result[0].latestVersion).toBe("2.0.0");
    });
  });

  describe("getAnalytics", () => {
    it("throws when plugin has no analytics and does not exist", async () => {
      mockPrisma.pluginAnalytics.findMany.mockResolvedValue([]);
      mockPrisma.plugin.count.mockResolvedValue(0);

      await expect(service.getAnalytics("nonexistent")).rejects.toThrow(
        "Plugin not found",
      );
    });

    it("returns analytics data", async () => {
      const analytics = [{ date: new Date(), downloads: 10 }];
      mockPrisma.pluginAnalytics.findMany.mockResolvedValue(analytics);

      const result = await service.getAnalytics("test-plugin");
      expect(result).toEqual(analytics);
    });
  });

  describe("getDependencies", () => {
    it("throws when no version found", async () => {
      mockPrisma.version.findFirst.mockResolvedValue(null);
      await expect(service.getDependencies("nonexistent")).rejects.toThrow(
        "No version found",
      );
    });

    it("returns dependencies", async () => {
      mockPrisma.version.findFirst.mockResolvedValue({
        id: "v1",
        version: "1.0.0",
        dependencies: [{ name: "dep1", version: "^1.0.0" }],
      });

      const result = await service.getDependencies("test-plugin");
      expect(result.version).toBe("1.0.0");
      expect(result.dependencies).toHaveLength(1);
    });
  });
});
