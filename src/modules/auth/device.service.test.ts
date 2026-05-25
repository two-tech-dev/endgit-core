import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRedisInstance } = await import("../../../test/setup");

describe("DeviceService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./device.service");
    service = mod.deviceService;
  });

  describe("createDeviceCode", () => {
    it("returns device code and user code", async () => {
      mockRedisInstance.setex.mockResolvedValue("OK");

      const result = await service.createDeviceCode();

      expect(result.device_code).toBeDefined();
      expect(typeof result.device_code).toBe("string");
      expect(result.user_code).toBeDefined();
      expect(result.user_code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(result.verification_uri).toContain("/oauth/device");
      expect(result.expires_in).toBe(900);
      expect(result.interval).toBe(5);
    });

    it("stores both device code and user code in Redis", async () => {
      mockRedisInstance.setex.mockResolvedValue("OK");

      await service.createDeviceCode();

      expect(mockRedisInstance.setex).toHaveBeenCalledTimes(2);
    });
  });

  describe("authorizeDevice", () => {
    it("throws on invalid user code", async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      await expect(
        service.authorizeDevice("INVALID", "user-1"),
      ).rejects.toThrow("Invalid or expired user code");
    });

    it("throws when device code expired", async () => {
      mockRedisInstance.get
        .mockResolvedValueOnce("device-code-123") // user code lookup
        .mockResolvedValueOnce(null); // device code lookup

      await expect(
        service.authorizeDevice("ABCD-EFGH", "user-1"),
      ).rejects.toThrow("Device code has expired");
    });

    it("throws when device code already used", async () => {
      mockRedisInstance.get
        .mockResolvedValueOnce("device-code-123")
        .mockResolvedValueOnce(
          JSON.stringify({
            user_code: "ABCD-EFGH",
            status: "authorized",
            userId: "user-2",
            expires_at: Math.floor(Date.now() / 1000) + 900,
          }),
        );

      await expect(
        service.authorizeDevice("ABCD-EFGH", "user-1"),
      ).rejects.toThrow("This device code has already been used");
    });

    it("authorizes a pending device code", async () => {
      const entry = {
        user_code: "ABCD-EFGH",
        status: "pending",
        expires_at: Math.floor(Date.now() / 1000) + 900,
      };
      mockRedisInstance.get
        .mockResolvedValueOnce("device-code-123")
        .mockResolvedValueOnce(JSON.stringify(entry));
      mockRedisInstance.ttl.mockResolvedValue(800);
      mockRedisInstance.setex.mockResolvedValue("OK");

      await service.authorizeDevice("ABCD-EFGH", "user-1");

      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        "device:dc:device-code-123",
        800,
        expect.stringContaining('"authorized"'),
      );
    });
  });

  describe("pollDeviceToken", () => {
    it("returns expired_token when device code not found", async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await service.pollDeviceToken("nonexistent");
      expect(result.error).toBe("expired_token");
    });

    it("returns authorization_pending when still pending", async () => {
      mockRedisInstance.get.mockResolvedValue(
        JSON.stringify({
          user_code: "ABCD-EFGH",
          status: "pending",
          expires_at: Math.floor(Date.now() / 1000) + 900,
        }),
      );

      const result = await service.pollDeviceToken("device-code");
      expect(result.error).toBe("authorization_pending");
    });

    it("returns access_denied and cleans up when denied", async () => {
      mockRedisInstance.get.mockResolvedValue(
        JSON.stringify({
          user_code: "ABCD-EFGH",
          status: "denied",
          expires_at: Math.floor(Date.now() / 1000) + 900,
        }),
      );
      mockRedisInstance.del.mockResolvedValue(1);

      const result = await service.pollDeviceToken("device-code");
      expect(result.error).toBe("access_denied");
      expect(mockRedisInstance.del).toHaveBeenCalled();
    });

    it("returns tokens when authorized", async () => {
      mockRedisInstance.get.mockResolvedValue(
        JSON.stringify({
          user_code: "ABCD-EFGH",
          status: "authorized",
          userId: "user-1",
          expires_at: Math.floor(Date.now() / 1000) + 900,
        }),
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        username: "testuser",
        trustLevel: "NEW",
      });
      mockRedisInstance.del.mockResolvedValue(1);
      mockRedisInstance.setex.mockResolvedValue("OK");

      const result = await service.pollDeviceToken("device-code");
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.token_type).toBe("bearer");
      expect(result.username).toBe("testuser");
    });

    it("returns expired_token when user not found after auth", async () => {
      mockRedisInstance.get.mockResolvedValue(
        JSON.stringify({
          user_code: "ABCD-EFGH",
          status: "authorized",
          userId: "nonexistent",
          expires_at: Math.floor(Date.now() / 1000) + 900,
        }),
      );
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.pollDeviceToken("device-code");
      expect(result.error).toBe("expired_token");
    });
  });
});
