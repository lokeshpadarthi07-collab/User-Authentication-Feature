const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter for Login Endpoint (POST /api/auth/login)
 * Mitigates brute-force credential stuffing and password guessing attacks.
 * Limit: 5 failed or successful attempts per 15-minute window per IP.
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per IP
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts from this IP address. Please wait 15 minutes before trying again.',
  },
  statusCode: 429,
  skipSuccessfulRequests: false, // count all login attempts
});

/**
 * Rate Limiter for Signup Endpoint (POST /api/auth/signup)
 * Mitigates automated mass registration abuse.
 * Limit: 10 signups per 15 minutes per IP.
 */
const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many registration requests. Please wait 15 minutes before creating another account.',
  },
  statusCode: 429,
});

/**
 * General API Rate Limiter
 * Guards API endpoints against DoS or rapid scraping.
 * Limit: 100 requests per 15-minute window per IP.
 */
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down and try again later.',
  },
  statusCode: 429,
});

module.exports = {
  loginRateLimiter,
  signupRateLimiter,
  generalApiLimiter,
};
