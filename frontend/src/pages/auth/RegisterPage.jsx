import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "../../components/common/Input";
import { PasswordInput } from "../../components/common/PasswordInput";
import { Button } from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import { extractErrorMessage, extractFieldErrors } from "../../api/axiosInstance";
import {
  validateFullNameField,
  validateUsernameField,
  validateEmailField,
  validatePasswordField,
  validateConfirmPasswordField,
} from "../../utils/authValidation";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fullNameRef = useRef(null);
  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const handleChange = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const nextErrors = {};
    const fullNameError = validateFullNameField(values.fullName);
    if (fullNameError) nextErrors.fullName = fullNameError;

    const usernameError = validateUsernameField(values.username);
    if (usernameError) nextErrors.username = usernameError;

    const emailError = validateEmailField(values.email);
    if (emailError) nextErrors.email = emailError;

    const passwordError = validatePasswordField(values.password);
    if (passwordError) nextErrors.password = passwordError;

    const confirmError = validateConfirmPasswordField(values.password, values.confirmPassword);
    if (!passwordError && confirmError) nextErrors.confirmPassword = confirmError;

    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setServerError("");
    const nextErrors = validate();
    setErrors(nextErrors);

    if (nextErrors.fullName) {
      fullNameRef.current?.focus();
      return;
    }
    if (nextErrors.username) {
      usernameRef.current?.focus();
      return;
    }
    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }
    if (nextErrors.confirmPassword) {
      confirmPasswordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await register(values);
      navigate("/home", { replace: true });
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
      } else {
        setServerError(extractErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-6 sm:p-8">
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold text-rockstar-text-primary">Create your account</h1>
        <p className="text-sm text-rockstar-text-secondary">Join Rockstar and build your library.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Input
          ref={fullNameRef}
          label="Full name"
          id="register-name"
          name="fullName"
          autoComplete="name"
          value={values.fullName}
          onChange={handleChange("fullName")}
          error={errors.fullName}
          required
        />
        <Input
          ref={usernameRef}
          label="Username"
          id="register-username"
          name="username"
          autoComplete="username"
          value={values.username}
          onChange={handleChange("username")}
          error={errors.username}
          hint={!errors.username ? "Letters, numbers, underscores, and periods only." : undefined}
          required
        />
        <Input
          ref={emailRef}
          label="Email"
          id="register-email"
          type="email"
          name="email"
          autoComplete="email"
          value={values.email}
          onChange={handleChange("email")}
          error={errors.email}
          required
        />
        <PasswordInput
          ref={passwordRef}
          label="Password"
          id="register-password"
          name="password"
          autoComplete="new-password"
          value={values.password}
          onChange={handleChange("password")}
          error={errors.password}
          hint={!errors.password ? "At least 8 characters, with a letter and a number." : undefined}
          required
        />
        <PasswordInput
          ref={confirmPasswordRef}
          label="Confirm password"
          id="register-confirm-password"
          name="confirmPassword"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={handleChange("confirmPassword")}
          error={errors.confirmPassword}
          required
        />

        <div role="alert" aria-live="polite">
          {serverError && <p className="text-xs text-rockstar-error">{serverError}</p>}
        </div>

        <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-rockstar-text-secondary">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-medium text-rockstar-tan hover:text-rockstar-tan-light focus-visible:outline-2 focus-visible:outline-rockstar-tan rounded"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
