const { getRefreshExpirySeconds } = require("./token");

const REFRESH_COOKIE_PATH = "/api/auth";

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
