import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Input } from "../../components/common/Input";
import { PasswordInput } from "../../components/common/PasswordInput";
import { Button } from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import { extractErrorMessage, extractFieldErrors } from "../../api/axiosInstance";
import { validateEmailField } from "../../utils/authValidation";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const handleChange = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const nextErrors = {};
    const emailError = validateEmailField(values.email);
    if (emailError) nextErrors.email = emailError;
    if (!values.password) nextErrors.password = "Password is required.";
    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setServerError("");
    const nextErrors = validate();
    setErrors(nextErrors);

    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await login(values);
      const destination = location.state?.from?.pathname || "/home";
      navigate(destination, { replace: true });
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
        <h1 className="text-2xl font-semibold text-rockstar-text-primary">Welcome back</h1>
        <p className="text-sm text-rockstar-text-secondary">Log in to your Rockstar account.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Input
          ref={emailRef}
          label="Email"
          id="login-email"
          type="email"
          name="email"
          autoComplete="email"
          value={values.email}
          onChange={handleChange("email")}
          error={errors.email}
          required
        />
        <div className="space-y-1.5">
          <PasswordInput
            ref={passwordRef}
            label="Password"
            id="login-password"
            name="password"
            autoComplete="current-password"
            value={values.password}
            onChange={handleChange("password")}
            error={errors.password}
            required
          />
          <Link
            to="/forgot-password"
            className="inline-block text-xs font-medium text-rockstar-tan hover:text-rockstar-tan-light focus-visible:outline-2 focus-visible:outline-rockstar-tan rounded"
          >
            Forgot your password?
          </Link>
        </div>

        <div role="alert" aria-live="polite">
          {serverError && <p className="text-xs text-rockstar-error">{serverError}</p>}
        </div>

        <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-rockstar-text-secondary">
        New to Rockstar?{" "}
        <Link
          to="/register"
          className="font-medium text-rockstar-tan hover:text-rockstar-tan-light focus-visible:outline-2 focus-visible:outline-rockstar-tan rounded"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
