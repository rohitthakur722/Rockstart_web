/**
 * Auth helpers for integration tests — register/login through the real API
 * (never inserting password hashes and skipping the auth flow, since the
 * whole point of these tests is exercising the actual auth contract) and a
 * controlled SQL promotion to admin for tests that need an elevated role.
 *
 * The access-token middleware re-fetches the user row by id on every
 * request (middleware/authenticate.middleware.js), so promoting a user's
 * role via SQL takes effect immediately on their *existing* access token —
 * no re-login is required after promotion.
 */
const request = require("supertest");
const crypto = require("crypto");
const { query } = require("../../config/db");
const { DEFAULT_TEST_PASSWORD } = require("./factories");

const uniqueSuffix = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

const buildRegistrationPayload = (overrides = {}) => {
  const suffix = uniqueSuffix();
  const password = overrides.password ?? DEFAULT_TEST_PASSWORD;
  return {
    fullName: overrides.fullName ?? `Test User ${suffix}`,
    username: overrides.username ?? `user_${suffix}`,
    email: overrides.email ?? `user_${suffix}@example.test`,
    password,
    confirmPassword: overrides.confirmPassword ?? password,
  };
};

/** Registers a new user via POST /api/auth/register on a fresh agent (cookie jar). */
const registerAndLogin = async (app, overrides = {}) => {
  const payload = buildRegistrationPayload(overrides);
  const agent = request.agent(app);

  const response = await agent.post("/api/auth/register").send(payload);
  if (response.status !== 201) {
    throw new Error(
      `registerAndLogin: registration failed (${response.status}): ${JSON.stringify(response.body)}`
    );
  }

  return {
    agent,
    user: response.body.data.user,
    accessToken: response.body.data.accessToken,
    password: payload.password,
    authHeader: () => ({ Authorization: `Bearer ${response.body.data.accessToken}` }),
  };
};

/** Logs in an existing user (e.g. after a direct-SQL factory-created user). */
const login = async (app, { email, password }) => {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email, password });
  if (response.status !== 200) {
    throw new Error(`login: login failed (${response.status}): ${JSON.stringify(response.body)}`);
  }
  return {
    agent,
    user: response.body.data.user,
    accessToken: response.body.data.accessToken,
    authHeader: () => ({ Authorization: `Bearer ${response.body.data.accessToken}` }),
  };
};

/** Promotes an existing user to admin via direct, controlled SQL (not the admin API). */
const promoteToAdmin = async (userId) => {
  await query("UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = $1", [userId]);
};

/** Registers a normal user then promotes them to admin — same access token works immediately. */
const registerAndLoginAsAdmin = async (app, overrides = {}) => {
  const session = await registerAndLogin(app, overrides);
  await promoteToAdmin(session.user.id);
  return session;
};

module.exports = {
  buildRegistrationPayload,
  registerAndLogin,
  login,
  promoteToAdmin,
  registerAndLoginAsAdmin,
};
