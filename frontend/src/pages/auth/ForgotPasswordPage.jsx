import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "../../components/common/Input";
import { Button } from "../../components/common/Button";
import { ChevronLeftIcon } from "../../components/common/icons";
import * as authApi from "../../api/authApi";
import { extractErrorMessage } from "../../api/axiosInstance";
import { validateEmailField } from "../../utils/authValidation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState(null);
  const emailRef = useRef(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setServerError("");
    const emailError = validateEmailField(email);
    setError(emailError || "");
    if (emailError) {
      emailRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.forgotPassword({ email: email.trim().toLowerCase() });
      setSubmitted(true);
      setDevResetUrl(res.data?.devResetUrl || null);
    } catch (err) {
      setServerError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-6 sm:p-8">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold text-rockstar-text-primary">Check your email</h1>
          <p role="status" aria-live="polite" className="text-sm text-rockstar-text-secondary">
            If an account exists for that email, password reset instructions have been sent.
          </p>
        </div>

        {devResetUrl && (
          <div className="mt-4 space-y-1.5 rounded-[var(--radius-field)] border border-rockstar-tan-dark/40 bg-rockstar-surface-elevated p-3.5">
            <p className="text-xs font-medium text-rockstar-tan">Development only — link exposed locally</p>
            <a
              href={devResetUrl}
              className="block break-all text-xs text-rockstar-tan-light underline focus-visible:outline-2 focus-visible:outline-rockstar-tan rounded"
            >
              {devResetUrl}
            </a>
          </div>
        )}

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

  return (
    <div className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-6 sm:p-8">
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold text-rockstar-text-primary">Reset your password</h1>
        <p className="text-sm text-rockstar-text-secondary">
          Enter your email and we&apos;ll send you instructions to reset your password.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Input
          ref={emailRef}
          label="Email"
          id="forgot-email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
          }}
          error={error}
          required
        />

        <div role="alert" aria-live="polite">
          {serverError && <p className="text-xs text-rockstar-error">{serverError}</p>}
        </div>

        <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
          Send reset instructions
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
