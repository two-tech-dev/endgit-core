import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const redis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  family: 4,
  tls: REDIS_URL.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
});

const PREFIX = "cache:";

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(`${PREFIX}${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redis.set(`${PREFIX}${key}`, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(`${PREFIX}${key}`);
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const keys = await redis.keys(`${PREFIX}${pattern}`);
  if (keys.length > 0) await redis.del(...keys);
}
