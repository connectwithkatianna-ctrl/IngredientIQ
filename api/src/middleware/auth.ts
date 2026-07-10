import { Request, Response, NextFunction } from 'express';
import { ApiError } from './errorHandler';

const VALID_KEYS = new Set(
  (process.env.API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean)
);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKey?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or missing API key'));
  }
  const token = match[1].trim();
  const isSandbox = token.startsWith('iiq_test_');
  const isKnownLive = token.startsWith('iiq_live_') && VALID_KEYS.has(token);
  if (!isSandbox && !isKnownLive) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or missing API key'));
  }
  req.apiKey = token;
  next();
}
