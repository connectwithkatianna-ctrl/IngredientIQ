import { Request, Response, NextFunction } from 'express';
import { ApiError } from './errorHandler';

const LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR || 1000);
const WINDOW_MS = 60 * 60 * 1000;

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.apiKey || req.ip || 'anonymous';
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  const remaining = Math.max(0, LIMIT - bucket.count);
  res.setHeader('X-RateLimit-Limit', String(LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(bucket.resetAt / 1000)));

  if (bucket.count > LIMIT) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return next(new ApiError(429, 'RATE_LIMITED', `Rate limit exceeded. Retry after ${retryAfter} seconds.`));
  }
  next();
}
