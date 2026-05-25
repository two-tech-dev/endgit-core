import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRedisInstance } = await import("../../../test/setup");

describe("RefreshService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./refresh.service");
    service = mod.refreshService;
  });

  describe("createRefreshToken", () => {
    it("creates a refresh token and stores in Redis", async () => {
      mockRedisInstance.setex.mockResolvedValue("OK");

      const token = await service.createRefreshToken(
        "user-1",
        "testuser",
        "NEW",
      );

      expect(typeof token).toBe("string");
      expect(token.length).toBe(64); // 32 bytes hex
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        `refresh:${token}`,
        30 * 24 * 3600,
        expect.any(String),
      );
    });
  });

  describe("rotateRefreshToken", () => {
    it("returns null when token not found", async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await service.rotateRefreshToken("nonexistent");
      expect(result).toBeNull();
    });

    it("returns null when user not found", async () => {
      mockRedisInstance.get.mockResolvedValue(
        JSON.stringify({
          userId: "user-1",
          username: "test",
          trustLevel: "NEW",
        }),
      );
      mockRedisInstance.expire.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.rotateRefreshToken("old-token");
      expect(result).toBeNull();
    });

    it("rotates token and returns new tokens", async () => {
      mockRedisInstance.get.mockResolvedValue(
        JSON.stringify({
          userId: "user-1",
          username: "test",
          trustLevel: "NEW",
        }),
      );
      mockRedisInstance.expire.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        username: "testuser",
        trustLevel: "NEW",
      });
      mockRedisInstance.setex.mockResolvedValue("OK");

      const result = await service.rotateRefreshToken("old-token");

      expect(result).toBeDefined();
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.username).toBe("testuser");

      // Old token should have grace period
      expect(mockRedisInstance.expire).toHaveBeenCalledWith(
        "refresh:old-token",
        30,
      );
    });
  });

  describe("revokeRefreshToken", () => {
    it("deletes token from Redis", async () => {
      mockRedisInstance.del.mockResolvedValue(1);

      await service.revokeRefreshToken("token-to-revoke");
      expect(mockRedisInstance.del).toHaveBeenCalledWith(
        "refresh:token-to-revoke",
      );
    });
  });
});
