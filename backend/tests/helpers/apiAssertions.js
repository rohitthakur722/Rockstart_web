const expectSuccess = (response, expectedStatus) => {
  if (expectedStatus !== undefined) {
    expect(response.status).toBe(expectedStatus);
  }
  expect(response.body).toMatchObject({ success: true });
  expect(response.body).toHaveProperty("message");
  return response.body.data;
};

const expectError = (response, expectedStatus) => {
  if (expectedStatus !== undefined) {
    expect(response.status).toBe(expectedStatus);
  }
  expect(response.body).toMatchObject({ success: false });
  expect(typeof response.body.message).toBe("string");
  return response.body;
};

const expectValidationErrorOnField = (response, field, expectedStatus = 400) => {
  const body = expectError(response, expectedStatus);
  expect(Array.isArray(body.errors)).toBe(true);
  expect(body.errors.some((e) => e.field === field)).toBe(true);
  return body;
};

const expectNoPasswordHash = (userLike) => {
  expect(userLike).not.toHaveProperty("password_hash");
  expect(userLike).not.toHaveProperty("passwordHash");
};

module.exports = {
  expectSuccess,
  expectError,
  expectValidationErrorOnField,
  expectNoPasswordHash,
};
