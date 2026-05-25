import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

describe("auth middleware", () => {
  const JWT_SECRET = process.env.NEXTAUTH_SECRET!;

  let requireAuth: any;
  let optionalAuth: any;
  let requireAdmin: any;
  let requireReviewer: any;
  let generateToken: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./auth");
    requireAuth = mod.requireAuth;
    optionalAuth = mod.optionalAuth;
    requireAdmin = mod.requireAdmin;
    requireReviewer = mod.requireReviewer;
    generateToken = mod.generateToken;
  });

  function createMockReqResNext(authHeader?: string) {
    const req: any = {
      headers: authHeader ? { authorization: authHeader } : {},
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    return { req, res, next };
  }

  describe("generateToken", () => {
    it("generates a valid JWT", () => {
      const token = generateToken({
        id: "user-1",
        username: "testuser",
        trustLevel: "NEW",
      });
      expect(typeof token).toBe("string");

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      expect(decoded.sub).toBe("user-1");
      expect(decoded.username).toBe("testuser");
      expect(decoded.trustLevel).toBe("NEW");
    });

    it("sets 7d expiry", () => {
      const token = generateToken({
        id: "user-1",
        username: "testuser",
        trustLevel: "NEW",
      });
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      expect(decoded.exp - decoded.iat).toBe(7 * 24 * 3600);
    });
  });

  describe("requireAuth", () => {
    it("returns 401 when no token provided", () => {
      const { req, res, next } = createMockReqResNext();
      requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 for invalid token", () => {
      const { req, res, next } = createMockReqResNext("Bearer invalid-token");
      requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("calls next and attaches user for valid token", () => {
      const token = generateToken({
        id: "user-1",
        username: "testuser",
        trustLevel: "TRUSTED",
      });
      const { req, res, next } = createMockReqResNext(`Bearer ${token}`);
      requireAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe("user-1");
      expect(req.user.username).toBe("testuser");
      expect(req.user.trustLevel).toBe("TRUSTED");
    });

    it("returns 401 for expired token", () => {
      const token = jwt.sign(
        { sub: "user-1", username: "test", trustLevel: "NEW" },
        JWT_SECRET,
        { expiresIn: "0s" },
      );
      const { req, res, next } = createMockReqResNext(`Bearer ${token}`);
      requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("optionalAuth", () => {
    it("calls next without user when no token", () => {
      const { req, res, next } = createMockReqResNext();
      optionalAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it("attaches user for valid token", () => {
      const token = generateToken({
        id: "user-1",
        username: "testuser",
        trustLevel: "NEW",
      });
      const { req, res, next } = createMockReqResNext(`Bearer ${token}`);
      optionalAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user?.id).toBe("user-1");
    });

    it("continues without user for invalid token", () => {
      const { req, res, next } = createMockReqResNext("Bearer bad-token");
      optionalAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });

  describe("requireAdmin", () => {
    it("returns 401 when no user", () => {
      const { req, res, next } = createMockReqResNext();
      requireAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("returns 403 when user is not admin", () => {
      const { req, res, next } = createMockReqResNext();
      req.user = { id: "u1", username: "test", trustLevel: "NEW" };
      requireAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("calls next when user is admin", () => {
      const { req, res, next } = createMockReqResNext();
      req.user = { id: "u1", username: "admin", trustLevel: "ADMIN" };
      requireAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("requireReviewer", () => {
    it("returns 401 when no user", () => {
      const { req, res, next } = createMockReqResNext();
      requireReviewer(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("returns 403 for NEW trust level", () => {
      const { req, res, next } = createMockReqResNext();
      req.user = { id: "u1", username: "test", trustLevel: "NEW" };
      requireReviewer(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("calls next for TRUSTED user", () => {
      const { req, res, next } = createMockReqResNext();
      req.user = { id: "u1", username: "reviewer", trustLevel: "TRUSTED" };
      requireReviewer(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("calls next for ADMIN user", () => {
      const { req, res, next } = createMockReqResNext();
      req.user = { id: "u1", username: "admin", trustLevel: "ADMIN" };
      requireReviewer(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
