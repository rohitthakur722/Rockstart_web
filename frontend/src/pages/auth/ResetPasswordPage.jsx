import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PasswordInput } from "../../components/common/PasswordInput";
import { Button } from "../../components/common/Button";
import { AlertIcon, ChevronLeftIcon } from "../../components/common/icons";
import * as authApi from "../../api/authApi";
import { extractErrorMessage } from "../../api/axiosInstance";
import { validatePasswordField, validateConfirmPasswordField } from "../../utils/authValidation";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  if (!token) {
    return (
      <div className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-6 text-center sm:p-8">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rockstar-error/10 text-rockstar-error">
          <AlertIcon width={22} height={22} aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold text-rockstar-text-primary">Invalid reset link</h1>
        <p className="mt-1.5 text-sm text-rockstar-text-secondary">
          This password reset link is missing its token. Request a new one below.
        </p>
        <Link
          to="/forgot-password"
          className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-rockstar-tan hover:text-rockstar-tan-light focus-visible:outline-2 focus-visible:outline-rockstar-tan rounded"
        >
          <ChevronLeftIcon width={16} height={16} aria-hidden="true" />
          Request a new link
        </Link>
      </div>
    );
  }

  if (succeeded) {
    return (
      <div className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-6 text-center sm:p-8">
        <h1 className="text-xl font-semibold text-rockstar-text-primary">Password reset</h1>
        <p role="status" aria-live="polite" className="mt-1.5 text-sm text-rockstar-text-secondary">
          Your password has been changed. Please log in again.
        </p>
        <Button as={Link} to="/login" className="mt-6" fullWidth>
          Go to login
        </Button>
      </div>
    );
  }

  const handleChange = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const nextErrors = {};
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

    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }
    if (nextErrors.confirmPassword) {
      confirmRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, ...values });
      setSucceeded(true);
    } catch (err) {
      setServerError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-6 sm:p-8">
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold text-rockstar-text-primary">Set a new password</h1>
        <p className="text-sm text-rockstar-text-secondary">Choose a new password for your account.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <PasswordInput
          ref={passwordRef}
          label="New password"
          id="reset-password"
          name="password"
          autoComplete="new-password"
          value={values.password}
          onChange={handleChange("password")}
          error={errors.password}
          hint={!errors.password ? "At least 8 characters, with a letter and a number." : undefined}
          required
        />
        <PasswordInput
          ref={confirmRef}
          label="Confirm new password"
          id="reset-confirm-password"
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
          Reset password
        </Button>
      </form>

      <Link
        to="/login"
        className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-rockstar-tan hover:text-rockstar-tan-light focus-visible:outline-2 focus-visible:outline-rockstar-tan rounded"
      >
        <ChevronLeftIcon width={16} height={16} aria-hidden="true" />
        Back to login
      </Link>
    </div>
  );
}
