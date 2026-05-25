import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRedisInstance } = await import("../../../test/setup");

describe("DownloadService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./download.service");
    service = mod.downloadService;
  });

  describe("downloadPluginVersion", () => {
    it("throws when plugin not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      await expect(
        service.downloadPluginVersion("nonexistent", "1.0.0", "127.0.0.1"),
      ).rejects.toThrow("Plugin not found");
    });

    it("throws when version not found", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: "p1", slug: "test" });
      mockPrisma.version.findUnique.mockResolvedValue(null);
      await expect(
        service.downloadPluginVersion("test", "999", "127.0.0.1"),
      ).rejects.toThrow("Version not found");
    });

    it("requires platform for CPP plugins", async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({
        id: "p1",
        slug: "test",
        pluginType: "CPP",
      });
      mockPrisma.version.findUnique.mockResolvedValue({
        id: "v1",
        fileUrl: '{"linux":"artifacts/test/1/test.so","win":"artifacts/test/1/test.dll"}',
        fileName: "test",
        fileHash: "abc",
      });

      await expect(
        service.downloadPluginVersion("test", "1.0.0", "127.0.0.1"),
      ).rejects.toThrow("Platform");
    });
  });
});
