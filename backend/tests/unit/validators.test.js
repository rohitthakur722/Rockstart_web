const {
  isNonEmptyString,
  validateFullName,
  validateUsername,
  validateEmail,
  validatePassword,
} = require("../../validation/validators");

describe("isNonEmptyString", () => {
  it("is true for a non-blank string", () => {
    expect(isNonEmptyString("hello")).toBe(true);
  });

  it("is false for an empty or whitespace-only string", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
  });

  it("is false for non-string values", () => {
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(123)).toBe(false);
  });
});

describe("validateFullName", () => {
  it("accepts and trims a valid name", () => {
    expect(validateFullName("  Jane Doe  ")).toEqual({ value: "Jane Doe" });
  });

  it("rejects an empty name", () => {
    expect(validateFullName("")).toEqual({ error: "Full name is required." });
  });

  it("rejects a name below 2 characters", () => {
    expect(validateFullName("J")).toEqual({ error: "Full name must be at least 2 characters." });
  });

  it("accepts a name at exactly 2 characters", () => {
    expect(validateFullName("Jo")).toEqual({ value: "Jo" });
  });

  it("rejects a name over 120 characters", () => {
    expect(validateFullName("a".repeat(121))).toEqual({
      error: "Full name must be at most 120 characters.",
    });
  });

  it("accepts a name at exactly 120 characters", () => {
    const name = "a".repeat(120);
    expect(validateFullName(name)).toEqual({ value: name });
  });
});

describe("validateUsername", () => {
  it("accepts a valid username", () => {
    expect(validateUsername("valid_user.name")).toEqual({ value: "valid_user.name" });
  });

  it("rejects a username below 3 characters", () => {
    expect(validateUsername("ab")).toEqual({ error: "Username must be at least 3 characters." });
  });

  it("rejects a username over 30 characters", () => {
    expect(validateUsername("a".repeat(31))).toEqual({
      error: "Username must be at most 30 characters.",
    });
  });

  it("rejects a username with disallowed characters", () => {
    expect(validateUsername("not valid!")).toEqual({
      error: "Username may only contain letters, numbers, underscores, and periods.",
    });
  });

  it("rejects a username with spaces", () => {
    expect(validateUsername("has space").error).toBeDefined();
  });
});

describe("validateEmail", () => {
  it("accepts and lowercases a valid email", () => {
    expect(validateEmail("User@Example.com")).toEqual({ value: "user@example.com" });
  });

  it("rejects an email missing the @ symbol", () => {
    expect(validateEmail("not-an-email")).toEqual({ error: "Enter a valid email address." });
  });

  it("rejects an email missing a domain", () => {
    expect(validateEmail("user@")).toEqual({ error: "Enter a valid email address." });
  });

  it("rejects an empty email", () => {
    expect(validateEmail("")).toEqual({ error: "Email is required." });
  });

  it("rejects an email over 255 characters", () => {
    const longEmail = `${"a".repeat(250)}@example.com`;
    expect(validateEmail(longEmail)).toEqual({ error: "Email must be at most 255 characters." });
  });
});

describe("validatePassword", () => {
  it("accepts a valid password with a letter and a number", () => {
    expect(validatePassword("Password123")).toEqual({ value: "Password123" });
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(validatePassword("Ab1")).toEqual({ error: "Password must be at least 8 characters." });
  });

  it("rejects a password longer than 72 characters", () => {
    expect(validatePassword(`Aa1${"a".repeat(70)}`)).toEqual({
      error: "Password must be at most 72 characters.",
    });
  });

  it("rejects a password with no letters", () => {
    expect(validatePassword("12345678")).toEqual({
      error: "Password must include at least one letter and one number.",
    });
  });

  it("rejects a password with no numbers", () => {
    expect(validatePassword("passwordonly")).toEqual({
      error: "Password must include at least one letter and one number.",
    });
  });

  it("rejects an empty password", () => {
    expect(validatePassword("")).toEqual({ error: "Password is required." });
  });

  it("rejects a non-string password", () => {
    expect(validatePassword(undefined)).toEqual({ error: "Password is required." });
  });
});
