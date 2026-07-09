const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

// Authenticated requests are limited per-account (so one busy user on a
// shared/NAT'd IP can't crowd out others); unauthenticated requests fall
// back to IP (via express-rate-limit's own helper, which normalizes IPv6
// addresses so a single client can't cycle through addresses to bypass the
// limit), which is all we have before authenticate.middleware runs.
const keyByUserOrIp = (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip));

const sendRateLimited = (_req, res) => {
  res.status(429).json({
    success: false,
    message: "Too many requests. Please slow down and try again shortly.",
    errors: [],
  });
};

const baseOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendRateLimited,
};

// Global safety net — generous enough for normal catalog browsing and the
// player's background requests; the route-specific limiters below are what
// actually protect sensitive endpoints.
const generalApiLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 300,
  keyGenerator: keyByUserOrIp,
});

// Strict, IP-keyed (accounts don't exist yet for register, and login must
// resist credential stuffing regardless of which account is being tried).
const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
});

const uploadLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: keyByUserOrIp,
});

const adminMutationLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: keyByUserOrIp,
});

// The player heartbeats roughly every 12s per actively-playing song; this
// allows plenty of headroom for multiple tabs/devices without permitting
// runaway abuse of the progress endpoint.
const playbackHeartbeatLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: keyByUserOrIp,
});

module.exports = {
  generalApiLimiter,
  authLimiter,
  uploadLimiter,
  adminMutationLimiter,
  playbackHeartbeatLimiter,
};
