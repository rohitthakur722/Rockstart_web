import { useState } from "react";
import { Button } from "../common/Button";
import { PasswordInput } from "../common/PasswordInput";
import { Modal } from "../common/Modal";
import * as userApi from "../../api/userApi";
import { extractErrorMessage, extractFieldErrors } from "../../api/axiosInstance";
import { validatePasswordField } from "../../utils/authValidation";

// Shared by ProfilePage and Settings > Security — one password-change flow,
// not duplicated per page.
export function ChangePasswordCard({ onPasswordChanged }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setErrors({});
    setServerError("");
  };

  const handleChange = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setServerError("");
    const nextErrors = {};
    if (!values.currentPassword) nextErrors.currentPassword = "Current password is required.";
    const newPasswordError = validatePasswordField(values.newPassword);
    if (newPasswordError) nextErrors.newPassword = newPasswordError;
    if (!newPasswordError && values.newPassword !== values.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await userApi.changePassword(values);
      setOpen(false);
      resetForm();
      await onPasswordChanged();
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      else setServerError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-5">
      <h3 className="mb-1 text-sm font-semibold text-rockstar-text-primary">Password</h3>
      <p className="mb-4 text-sm text-rockstar-text-secondary">
        Changing your password signs you out everywhere and requires logging in again.
      </p>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Change password
      </Button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="Change password"
      >
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <PasswordInput
            label="Current password"
            id="change-current-password"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={handleChange("currentPassword")}
            error={errors.currentPassword}
          />
          <PasswordInput
            label="New password"
            id="change-new-password"
            autoComplete="new-password"
            value={values.newPassword}
            onChange={handleChange("newPassword")}
            error={errors.newPassword}
            hint={!errors.newPassword ? "At least 8 characters, with a letter and a number." : undefined}
          />
          <PasswordInput
            label="Confirm new password"
            id="change-confirm-password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={handleChange("confirmPassword")}
            error={errors.confirmPassword}
          />

          <div role="alert" aria-live="polite">
            {serverError && <p className="text-xs text-rockstar-error">{serverError}</p>}
          </div>

          <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
            Change password
          </Button>
        </form>
      </Modal>
    </div>
  );
}
