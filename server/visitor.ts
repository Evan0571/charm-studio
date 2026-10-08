import type { RequestHandler } from 'express';
import { randomBytes } from 'node:crypto';
import { hash } from './studio-service';

// The demo uses a browser guest identity. OAuth links exactly this identity;
// it does not claim to verify an email or create a customer account.
export const visitor: RequestHandler = (req, res, next) => {
  let token = req.cookies?.loop_guest;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomBytes(32).toString('hex');
    res.cookie('loop_guest', token, { httpOnly: true, sameSite: 'lax', secure: req.secure || process.env.COOKIE_SECURE === 'true', maxAge: 365 * 24 * 60 * 60_000, path: '/' });
  }
  res.locals.ownerId = hash(token);
  next();
};
