const { getRefreshExpirySeconds } = require("./token");

// Phase 5's session-management endpoints (/api/users/me/sessions) need to
// read this cookie to identify "the current session" — scoping it to
// "/api/auth" (as in Phase 2) would mean the browser never sends it to
// /api/users/* at all. "/api" is still narrower than every path, still
// HttpOnly/Secure, and covers every route that legitimately needs it.
const REFRESH_COOKIE_PATH = "/api";

const getRefreshCookieName = () => process.env.REFRESH_COOKIE_NAME;

const baseCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: (process.env.COOKIE_SAME_SITE || "lax").toLowerCase(),
  path: REFRESH_COOKIE_PATH,
});

const setRefreshCookie = (res, token) => {
  res.cookie(getRefreshCookieName(), token, {
    ...baseCookieOptions(),
    maxAge: getRefreshExpirySeconds() * 1000,
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(getRefreshCookieName(), baseCookieOptions());
};

module.exports = { getRefreshCookieName, setRefreshCookie, clearRefreshCookie };
