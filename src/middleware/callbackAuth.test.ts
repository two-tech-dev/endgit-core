import { describe, it, expect, vi, beforeEach } from "vitest";

describe("callbackAuth middleware", () => {
  let requireCallbackAuth: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./callbackAuth");
    requireCallbackAuth = mod.requireCallbackAuth;
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

  it("calls next for valid token", () => {
    const token = process.env.ENDGIT_CALLBACK_TOKEN!;
    const { req, res, next } = createMockReqResNext(`Bearer ${token}`);
    requireCallbackAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 401 for invalid token", () => {
    const { req, res, next } = createMockReqResNext("Bearer wrong-token-here-12345678901234567890");
    requireCallbackAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when no authorization header", () => {
    const { req, res, next } = createMockReqResNext();
    requireCallbackAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("handles Bearer prefix case-insensitively", () => {
    const token = process.env.ENDGIT_CALLBACK_TOKEN!;
    const { req, res, next } = createMockReqResNext(`bearer ${token}`);
    requireCallbackAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
