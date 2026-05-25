import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = await import("../../../test/setup");

describe("CallbackService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./callback.service");
    service = mod.callbackService;
  });

  describe("formatBytes", () => {
    it("formats bytes correctly", () => {
      expect(service.formatBytes(0)).toBe("0 B");
      expect(service.formatBytes(512)).toBe("512 B");
      expect(service.formatBytes(1023)).toBe("1023 B");
    });

    it("formats kilobytes correctly", () => {
      expect(service.formatBytes(1024)).toBe("1.0 KB");
      expect(service.formatBytes(1536)).toBe("1.5 KB");
      expect(service.formatBytes(102400)).toBe("100.0 KB");
    });

    it("formats megabytes correctly", () => {
      expect(service.formatBytes(1048576)).toBe("1.0 MB");
      expect(service.formatBytes(5242880)).toBe("5.0 MB");
      expect(service.formatBytes(1572864)).toBe("1.5 MB");
    });
  });

  describe("processCallback", () => {
    it("throws on invalid platform", async () => {
      await expect(
        service.processCallback("build-1", "macos", "SUCCESS"),
      ).rejects.toThrow("Invalid callback platform");
    });

    it("throws on invalid status", async () => {
      await expect(
        service.processCallback("build-1", "linux", "PENDING"),
      ).rejects.toThrow("Invalid callback status");
    });

    it("throws when build not found", async () => {
      mockPrisma.build.findUnique.mockResolvedValue(null);
      await expect(
        service.processCallback("nonexistent", "linux", "SUCCESS"),
      ).rejects.toThrow("Build not found");
    });

    it("handles FAILED status for linux platform", async () => {
      mockPrisma.build.findUnique.mockResolvedValue({
        id: "build-1",
        buildNumber: 1,
        plugin: { slug: "test-plugin", displayName: "Test", pluginType: "CPP" },
      });
      mockPrisma.build.update.mockResolvedValue({});
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await service.processCallback(
        "build-1",
        "linux",
        "FAILED",
        "Compilation error",
      );
      expect(result.message).toBe("Failure recorded");
      expect(mockPrisma.build.update).toHaveBeenCalledWith({
        where: { id: "build-1" },
        data: { linuxBuildStatus: "FAILED" },
      });
    });

    it("handles FAILED status for windows platform", async () => {
      mockPrisma.build.findUnique.mockResolvedValue({
        id: "build-1",
        buildNumber: 1,
        plugin: { slug: "test-plugin", displayName: "Test", pluginType: "CPP" },
      });
      mockPrisma.build.update.mockResolvedValue({});
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await service.processCallback(
        "build-1",
        "windows",
        "FAILED",
      );
      expect(result.message).toBe("Failure recorded");
      expect(mockPrisma.build.update).toHaveBeenCalledWith({
        where: { id: "build-1" },
        data: { winBuildStatus: "FAILED" },
      });
    });

    it("throws on SUCCESS without file", async () => {
      mockPrisma.build.findUnique.mockResolvedValue({
        id: "build-1",
        buildNumber: 1,
        plugin: { slug: "test-plugin", displayName: "Test", pluginType: "CPP" },
      });
      await expect(
        service.processCallback("build-1", "linux", "SUCCESS"),
      ).rejects.toThrow("No artifact file provided");
    });
  });
});
