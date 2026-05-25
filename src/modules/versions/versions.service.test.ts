import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = await import("../../../test/setup");

describe("VersionsService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./versions.service");
    service = mod.versionsService;
  });

  describe("getVersions", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(service.getVersions("nonexistent")).rejects.toThrow(
        "Plugin not found",
      );
    });

    it("returns versions for a plugin", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1" });
      mockPrisma.version.findMany.mockResolvedValue([
        { id: "v2", version: "2.0.0" },
        { id: "v1", version: "1.0.0" },
      ]);

      const result = await service.getVersions("test-plugin");
      expect(result).toHaveLength(2);
    });
  });

  describe("createVersion", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(
        service.createVersion("nonexistent", "user1", "NEW", {
          version: "1.0.0",
        }),
      ).rejects.toThrow("Plugin not found");
    });

    it("throws when not authorized", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        authorId: "user1",
      });
      await expect(
        service.createVersion("test-plugin", "user2", "NEW", {
          version: "1.0.0",
        }),
      ).rejects.toThrow("Not authorized");
    });

    it("allows admin to create version for any plugin", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        authorId: "user1",
        pluginType: "PYTHON",
        status: "APPROVED",
      });
      mockPrisma.version.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.version.create.mockResolvedValue({
        id: "v1",
        version: "1.0.0",
      });
      mockPrisma.plugin.update.mockResolvedValue({});

      const result = await service.createVersion("test-plugin", "admin1", "ADMIN", {
        version: "1.0.0",
        fileUrl: "https://example.com/file.zip",
        fileName: "file.zip",
        fileSize: 1024,
      });
      expect(result.id).toBe("v1");
    });

    it("throws when fileUrl is missing for non-CPP plugin", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        authorId: "user1",
        pluginType: "PYTHON",
        status: "APPROVED",
      });

      await expect(
        service.createVersion("test-plugin", "user1", "NEW", {
          version: "1.0.0",
        }),
      ).rejects.toThrow("File URL and Name are required");
    });

    it("links build artifact for CPP plugin", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        authorId: "user1",
        pluginType: "CPP",
        slug: "test-plugin",
        status: "APPROVED",
      });
      mockPrisma.build.findUnique.mockResolvedValue({
        id: "b1",
        pluginId: "p1",
        status: "SUCCESS",
        artifactUrlLinux: "/artifacts/test.so",
        artifactUrlWin: "/artifacts/test.dll",
        artifactSizeLinux: 500,
        artifactSizeWin: 600,
      });
      mockPrisma.version.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.version.create.mockResolvedValue({
        id: "v1",
        version: "1.0.0",
      });
      mockPrisma.build.update.mockResolvedValue({});
      mockPrisma.plugin.update.mockResolvedValue({});

      const result = await service.createVersion("test-plugin", "user1", "NEW", {
        version: "1.0.0",
        buildId: "b1",
      });
      expect(result.id).toBe("v1");
    });

    it("throws on invalid build ID", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        authorId: "user1",
        pluginType: "PYTHON",
        status: "APPROVED",
      });
      mockPrisma.build.findUnique.mockResolvedValue(null);

      await expect(
        service.createVersion("test-plugin", "user1", "NEW", {
          version: "1.0.0",
          buildId: "invalid-build",
        }),
      ).rejects.toThrow("Invalid or unsuccessful build ID");
    });

    it("sets isLatest to true and clears others", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        authorId: "user1",
        pluginType: "PYTHON",
        status: "APPROVED",
      });
      mockPrisma.version.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.version.create.mockResolvedValue({
        id: "v1",
        version: "1.0.0",
      });
      mockPrisma.plugin.update.mockResolvedValue({});

      await service.createVersion("test-plugin", "user1", "NEW", {
        version: "1.0.0",
        fileUrl: "https://example.com/file.zip",
        fileName: "file.zip",
      });

      expect(mockPrisma.version.updateMany).toHaveBeenCalledWith({
        where: { pluginId: "p1" },
        data: { isLatest: false },
      });
    });

    it("transitions DRAFT plugin to PENDING_REVIEW", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        authorId: "user1",
        pluginType: "PYTHON",
        status: "DRAFT",
      });
      mockPrisma.version.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.version.create.mockResolvedValue({
        id: "v1",
        version: "1.0.0",
      });
      mockPrisma.plugin.update.mockResolvedValue({});

      await service.createVersion("test-plugin", "user1", "NEW", {
        version: "1.0.0",
        fileUrl: "https://example.com/file.zip",
        fileName: "file.zip",
      });

      expect(mockPrisma.plugin.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { status: "PENDING_REVIEW" },
      });
    });
  });

  describe("deleteVersion", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(
        service.deleteVersion("nonexistent", "1.0.0", "user1", "NEW"),
      ).rejects.toThrow("Plugin not found");
    });

    it("throws when not authorized", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        authorId: "user1",
      });
      await expect(
        service.deleteVersion("test", "1.0.0", "user2", "NEW"),
      ).rejects.toThrow("Not authorized");
    });

    it("throws when version not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        authorId: "user1",
      });
      mockPrisma.version.findFirst.mockResolvedValue(null);
      await expect(
        service.deleteVersion("test", "1.0.0", "user1", "NEW"),
      ).rejects.toThrow("Version not found");
    });

    it("promotes next version to isLatest when deleting latest", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        authorId: "user1",
      });
      mockPrisma.version.findFirst
        .mockResolvedValueOnce({ id: "v2", isLatest: true })
        .mockResolvedValueOnce({ id: "v1" });
      mockPrisma.version.delete.mockResolvedValue({});
      mockPrisma.version.update.mockResolvedValue({});

      await service.deleteVersion("test", "2.0.0", "user1", "NEW");

      expect(mockPrisma.version.update).toHaveBeenCalledWith({
        where: { id: "v1" },
        data: { isLatest: true },
      });
    });
  });
});
