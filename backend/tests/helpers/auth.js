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

const promoteToAdmin = async (userId) => {
  await query("UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = $1", [userId]);
};

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
