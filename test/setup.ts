import { vi } from "vitest";

process.env.NEXTAUTH_SECRET =
  "test-secret-key-that-is-at-least-32-characters-long";
process.env.ENDGIT_CALLBACK_TOKEN =
  "test-callback-token-that-is-at-least-32-chars";
process.env.ENDGIT_WEBHOOK_SECRET =
  "test-webhook-secret-that-is-at-least-32-chars-long";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.STORAGE_TYPE = "local";
process.env.STORAGE_PATH = "./test-uploads";

const mockRedisInstance = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  setex: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  keys: vi.fn().mockResolvedValue([]),
  expire: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(-1),
  on: vi.fn(),
  quit: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("ioredis", () => {
  const IORedis = vi.fn(function (this: any) {
    Object.assign(this, mockRedisInstance);
  });
  return { default: IORedis };
});

vi.mock("bullmq", () => {
  const Queue = vi.fn(function (this: any) {
    this.add = vi.fn().mockResolvedValue({ id: "mock-job-id" });
    this.close = vi.fn();
  });
  const Worker = vi.fn(function (this: any) {});
  return { Queue, Worker };
});

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  plugin: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  version: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  build: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  rating: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  review: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  report: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  pluginComment: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  pluginAnalytics: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  autoCheck: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  account: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  moderationLog: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  producer: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  dependency: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  $transaction: vi.fn(async (fn: any) => {
    if (typeof fn === "function") {
      return fn(mockPrisma);
    }
    return fn;
  }),
  $executeRaw: vi.fn().mockResolvedValue(1),
};

vi.mock("@endgit/database", () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

vi.mock("@endgit/storage", () => ({
  createStorage: vi.fn(() => ({
    upload: vi.fn().mockResolvedValue("mock-key"),
    download: vi.fn().mockResolvedValue(Buffer.from("mock-data")),
    delete: vi.fn().mockResolvedValue(undefined),
    getUrl: vi.fn().mockReturnValue("/api/v1/download/file/mock-key"),
    exists: vi.fn().mockResolvedValue(true),
  })),
  LocalStorage: vi.fn(),
  S3Storage: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: "mock-message-id" }),
    })),
  },
  createTransport: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({ messageId: "mock-message-id" }),
  })),
}));

export { mockPrisma, mockRedisInstance };
