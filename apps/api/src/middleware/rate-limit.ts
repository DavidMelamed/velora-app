import { rateLimit } from 'express-rate-limit'

/** Auth endpoints: 5 requests per minute */
export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later' },
})

/** Write endpoints: 30 requests per minute */
export const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many write requests, please try again later' },
})

/** Read endpoints: 600 requests per minute */
export const readLimiter = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})
