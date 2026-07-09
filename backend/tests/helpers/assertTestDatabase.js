class UnsafeTestDatabaseError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnsafeTestDatabaseError";
  }
}

const assertTestDatabase = () => {
  const { NODE_ENV, DB_NAME, DB_HOST, DB_USER } = process.env;

  const problems = [];

  if (NODE_ENV !== "test") {
    problems.push(`NODE_ENV must be "test" (got ${JSON.stringify(NODE_ENV)}).`);
  }

  if (!DB_NAME) {
    problems.push("DB_NAME is not set.");
  } else {
    if (DB_NAME === "rockstar") {
      problems.push('DB_NAME must not be the real "rockstar" database.');
    }
    if (!DB_NAME.endsWith("_test")) {
      problems.push(`DB_NAME must end with "_test" (got ${JSON.stringify(DB_NAME)}).`);
    }
  }

  if (!DB_HOST) {
    problems.push("DB_HOST is not set.");
  }

  if (!DB_USER) {
    problems.push("DB_USER is not set.");
  }

  if (problems.length > 0) {
    throw new UnsafeTestDatabaseError(
      `Refusing to run a destructive test-database operation:\n- ${problems.join("\n- ")}\n` +
        "Copy backend/.env.test.example to backend/.env.test and fix your configuration."
    );
  }
};

module.exports = { assertTestDatabase, UnsafeTestDatabaseError };
