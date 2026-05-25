import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedisInstance } = await import("../../test/setup");

describe("cache utils", () => {
  let cacheGet: any;
  let cacheSet: any;
  let cacheDel: any;
  let cacheDelPattern: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./cache");
    cacheGet = mod.cacheGet;
    cacheSet = mod.cacheSet;
    cacheDel = mod.cacheDel;
    cacheDelPattern = mod.cacheDelPattern;
  });

  describe("cacheGet", () => {
    it("returns null when key not found", async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const result = await cacheGet("nonexistent");
      expect(result).toBeNull();
    });

    it("returns parsed JSON when key found", async () => {
      mockRedisInstance.get.mockResolvedValue('{"name":"test"}');
      const result = await cacheGet("key");
      expect(result).toEqual({ name: "test" });
    });

    it("returns null for invalid JSON", async () => {
      mockRedisInstance.get.mockResolvedValue("not-json{{{");
      const result = await cacheGet("key");
      expect(result).toBeNull();
    });
  });

  describe("cacheSet", () => {
    it("sets key with TTL", async () => {
      mockRedisInstance.set.mockResolvedValue("OK");
      await cacheSet("key", { data: 1 }, 60);
      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        "cache:key",
        '{"data":1}',
        "EX",
        60,
      );
    });
  });

  describe("cacheDel", () => {
    it("deletes key", async () => {
      mockRedisInstance.del.mockResolvedValue(1);
      await cacheDel("key");
      expect(mockRedisInstance.del).toHaveBeenCalledWith("cache:key");
    });
  });

  describe("cacheDelPattern", () => {
    it("deletes matching keys", async () => {
      mockRedisInstance.keys.mockResolvedValue(["cache:key1", "cache:key2"]);
      mockRedisInstance.del.mockResolvedValue(2);

      await cacheDelPattern("key*");
      expect(mockRedisInstance.keys).toHaveBeenCalledWith("cache:key*");
      expect(mockRedisInstance.del).toHaveBeenCalledWith(
        "cache:key1",
        "cache:key2",
      );
    });

    it("does nothing when no keys match", async () => {
      mockRedisInstance.keys.mockResolvedValue([]);
      await cacheDelPattern("nope*");
      expect(mockRedisInstance.del).not.toHaveBeenCalled();
    });
  });
});
