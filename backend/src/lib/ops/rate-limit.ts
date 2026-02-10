import { makeError } from "@/lib/api/errors";

interface RateLimitBucket {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, RateLimitBucket>();

export interface RateLimitOptions {
  capacity: number;
  refillPerSecond: number;
}

const defaultOptions: RateLimitOptions = {
  capacity: Number(process.env.RATE_LIMIT_CAPACITY ?? 120),
  refillPerSecond: Number(process.env.RATE_LIMIT_REFILL_PER_SECOND ?? 2)
};

function nowMs(): number {
  return Date.now();
}

function refill(bucket: RateLimitBucket, options: RateLimitOptions, now: number): void {
  const elapsedSeconds = Math.max(0, (now - bucket.lastRefillMs) / 1000);
  bucket.tokens = Math.min(options.capacity, bucket.tokens + elapsedSeconds * options.refillPerSecond);
  bucket.lastRefillMs = now;
}

export function assertWithinRateLimit(
  key: string,
  options: RateLimitOptions = defaultOptions,
  now = nowMs()
): void {
  if (!key || options.capacity <= 0 || options.refillPerSecond <= 0) {
    throw makeError(500, "internal_error", "Rate limiter misconfigured", "rate-limit", {
      retryable: true,
      details: { key, options }
    });
  }

  const bucket = buckets.get(key) ?? {
    tokens: options.capacity,
    lastRefillMs: now
  };
  refill(bucket, options, now);

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    throw makeError(429, "rate_limited", "Rate limit exceeded", "rate-limit", {
      retryable: true,
      details: {
        key,
        capacity: options.capacity,
        refillPerSecond: options.refillPerSecond
      }
    });
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
}

export function resetRateLimiter(): void {
  buckets.clear();
}
