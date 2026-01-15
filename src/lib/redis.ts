import Redis from 'ioredis';

// Cache key prefixes
export const CACHE_KEYS = {
  LINKS: 'links:',
  SUMMARY: 'summary:',
  SEARCH: 'search:',
  RESOLVE: 'resolve:',
  GAME: 'game:',
  RATE_LIMIT: 'ratelimit:',
} as const;

// TTL values in seconds
export const TTL = {
  LINKS: 86400, // 24 hours
  SUMMARY: 86400, // 24 hours
  SEARCH: 600, // 10 minutes
  RESOLVE: 600, // 10 minutes
  GAME: 86400, // 24 hours (increased for dev mode stability)
  RATE_LIMIT: 60, // 1 minute
} as const;

// Use globalThis to persist cache across hot reloads in development
const globalForCache = globalThis as unknown as {
  memoryCache: Map<string, { value: string; expires: number }> | undefined;
};

// In-memory fallback cache when Redis is unavailable
// This persists across hot reloads in development
const memoryCache = globalForCache.memoryCache ?? new Map<string, { value: string; expires: number }>();
globalForCache.memoryCache = memoryCache;

let redisClient: Redis | null = null;
let redisAvailable = true;

function getRedisClient(): Redis | null {
  if (!redisAvailable) return null;
  
  if (!redisClient) {
    try {
      redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          if (times > 2) {
            redisAvailable = false;
            console.warn('Redis unavailable, using in-memory cache fallback');
            return null;
          }
          return Math.min(times * 100, 1000);
        },
        lazyConnect: true,
      });

      redisClient.on('error', () => {
        redisAvailable = false;
      });
    } catch {
      redisAvailable = false;
      return null;
    }
  }
  
  return redisClient;
}

export const redis = {
  async get(key: string): Promise<string | null> {
    const client = getRedisClient();
    if (client && redisAvailable) {
      try {
        return await client.get(key);
      } catch {
        redisAvailable = false;
      }
    }
    // Fallback to memory cache
    const cached = memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }
    memoryCache.delete(key);
    return null;
  },

  async setex(key: string, ttl: number, value: string): Promise<void> {
    const client = getRedisClient();
    if (client && redisAvailable) {
      try {
        await client.setex(key, ttl, value);
        return;
      } catch {
        redisAvailable = false;
      }
    }
    // Fallback to memory cache
    memoryCache.set(key, { value, expires: Date.now() + ttl * 1000 });
  },

  async incr(key: string): Promise<number> {
    const client = getRedisClient();
    if (client && redisAvailable) {
      try {
        return await client.incr(key);
      } catch {
        redisAvailable = false;
      }
    }
    // Fallback to memory
    const cached = memoryCache.get(key);
    const current = cached ? parseInt(cached.value, 10) : 0;
    const newValue = current + 1;
    memoryCache.set(key, { value: String(newValue), expires: Date.now() + TTL.RATE_LIMIT * 1000 });
    return newValue;
  },

  async expire(key: string, ttl: number): Promise<void> {
    const client = getRedisClient();
    if (client && redisAvailable) {
      try {
        await client.expire(key, ttl);
        return;
      } catch {
        redisAvailable = false;
      }
    }
    // Update expiry in memory cache
    const cached = memoryCache.get(key);
    if (cached) {
      cached.expires = Date.now() + ttl * 1000;
    }
  },
};

// Helper functions for caching
export async function getCached<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

// Rate limiting
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
  const minute = Math.floor(Date.now() / 60000);
  const key = `${CACHE_KEYS.RATE_LIMIT}${identifier}:${minute}`;
  
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, TTL.RATE_LIMIT);
  }
  
  return {
    allowed: current <= maxRequests,
    remaining: Math.max(0, maxRequests - current),
  };
}
