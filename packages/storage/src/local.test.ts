import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("LocalStorage", () => {
  let storage: any;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "storage-test-"));
    const { LocalStorage } = await import("./local");
    storage = new LocalStorage(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("upload and download", () => {
    it("uploads and downloads a file", async () => {
      const data = Buffer.from("hello world");
      await storage.upload("test/file.txt", data);

      const downloaded = await storage.download("test/file.txt");
      expect(downloaded.toString()).toBe("hello world");
    });

    it("creates nested directories", async () => {
      const data = Buffer.from("nested");
      await storage.upload("a/b/c/file.txt", data);

      const downloaded = await storage.download("a/b/c/file.txt");
      expect(downloaded.toString()).toBe("nested");
    });
  });

  describe("exists", () => {
    it("returns true for existing file", async () => {
      await storage.upload("exists.txt", Buffer.from("data"));
      expect(await storage.exists("exists.txt")).toBe(true);
    });

    it("returns false for non-existing file", async () => {
      expect(await storage.exists("nope.txt")).toBe(false);
    });
  });

  describe("delete", () => {
    it("deletes a file", async () => {
      await storage.upload("to-delete.txt", Buffer.from("bye"));
      await storage.delete("to-delete.txt");
      expect(await storage.exists("to-delete.txt")).toBe(false);
    });

    it("does not throw when deleting non-existing file", async () => {
      await expect(storage.delete("nope.txt")).resolves.toBeUndefined();
    });
  });

  describe("getUrl", () => {
    it("returns API URL for key", () => {
      const url = storage.getUrl("artifacts/test/1/file.so");
      expect(url).toBe(
        `/api/v1/download/file/${encodeURIComponent("artifacts/test/1/file.so")}`,
      );
    });
  });

  describe("resolveKey (path traversal protection)", () => {
    it("rejects path traversal with ../", async () => {
      await expect(
        storage.upload("../../etc/passwd", Buffer.from("hack")),
      ).rejects.toThrow("Invalid storage key");
    });

    it("rejects null bytes", async () => {
      await expect(
        storage.upload("file\0.txt", Buffer.from("hack")),
      ).rejects.toThrow("Invalid storage key");
    });

    it("rejects absolute paths", async () => {
      await expect(
        storage.upload("/etc/passwd", Buffer.from("hack")),
      ).rejects.toThrow("Invalid storage key");
    });

    it("rejects empty key", async () => {
      await expect(
        storage.upload("", Buffer.from("hack")),
      ).rejects.toThrow("Invalid storage key");
    });

    it("allows valid relative paths", async () => {
      await expect(
        storage.upload("artifacts/my-plugin/1/file.so", Buffer.from("ok")),
      ).resolves.toBe("artifacts/my-plugin/1/file.so");
    });
  });
});
