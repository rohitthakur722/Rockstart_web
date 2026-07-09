import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/common/PageHeader";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { PasswordInput } from "../../components/common/PasswordInput";
import { Modal } from "../../components/common/Modal";
import { Avatar } from "../../components/common/Avatar";
import { useAuth } from "../../hooks/useAuth";
import * as userApi from "../../api/userApi";
import { extractErrorMessage, extractFieldErrors } from "../../api/axiosInstance";
import { validateFullNameField, validateUsernameField, validatePasswordField } from "../../utils/authValidation";

const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const formatJoinedDate = (isoString) => {
  if (!isoString) return null;
  return new Date(isoString).toLocaleDateString(undefined, { year: "numeric", month: "long" });
};

export default function ProfilePage() {
  const { user, updateCurrentUser, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your Rockstar account details." />

      <ProfileHeaderCard user={user} onAvatarUpdated={updateCurrentUser} onLogout={async () => {
        await logout();
        navigate("/login", { replace: true });
      }} />

      <div className="grid gap-4 lg:grid-cols-2">
        <EditProfileCard user={user} onUpdated={updateCurrentUser} />
        <ChangePasswordCard onPasswordChanged={async () => {
          await logout();
          navigate("/login", { replace: true });
        }} />
      </div>
    </div>
  );
}

function ProfileHeaderCard({ user, onAvatarUpdated, onLogout }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAvatarError("");

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError("Only JPEG, PNG, and WebP images are allowed.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Image must be 5MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const res = await userApi.updateAvatar(file);
      onAvatarUpdated(res.data.user);
    } catch (err) {
      setAvatarError(extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await onLogout();
  };

  const joined = formatJoinedDate(user?.createdAt);

  return (
    <div className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-6 sm:p-8">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <div className="relative">
          <Avatar avatarUrl={user?.avatarUrl} name={user?.fullName} size="lg" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Change avatar"
            aria-busy={uploading || undefined}
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-rockstar-border bg-rockstar-surface-elevated text-rockstar-tan hover:bg-rockstar-surface focus-visible:outline-2 focus-visible:outline-rockstar-tan disabled:opacity-60"
          >
            {uploading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <span aria-hidden="true" className="text-sm leading-none">+</span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Upload a new avatar image"
            onChange={handleFileSelect}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-semibold text-rockstar-text-primary">{user?.fullName}</h2>
          <p className="text-sm text-rockstar-text-secondary">@{user?.username}</p>
          <p className="text-sm text-rockstar-text-secondary">{user?.email}</p>
          {joined && <p className="text-xs text-rockstar-text-secondary">Joined {joined}</p>}
        </div>

        <Button variant="secondary" size="sm" onClick={handleLogout} loading={loggingOut} disabled={loggingOut}>
          Log out
        </Button>
      </div>

      {avatarError && (
        <p role="alert" className="mt-3 text-xs text-rockstar-error">
          {avatarError}
        </p>
      )}
    </div>
  );
}

function EditProfileCard({ user, onUpdated }) {
  const [values, setValues] = useState({ fullName: user?.fullName || "", username: user?.username || "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSuccessMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setServerError("");
    setSuccessMessage("");

    const nextErrors = {};
    const fullNameError = validateFullNameField(values.fullName);
    if (fullNameError) nextErrors.fullName = fullNameError;
    const usernameError = validateUsernameField(values.username);
    if (usernameError) nextErrors.username = usernameError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await userApi.updateMe(values);
      onUpdated(res.data.user);
      setSuccessMessage("Profile updated.");
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
      <h3 className="mb-4 text-sm font-semibold text-rockstar-text-primary">Edit profile</h3>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="Full name"
          id="profile-fullname"
          value={values.fullName}
          onChange={handleChange("fullName")}
          error={errors.fullName}
        />
        <Input
          label="Username"
          id="profile-username"
          value={values.username}
          onChange={handleChange("username")}
          error={errors.username}
        />
        <Input label="Email" id="profile-email" value={user?.email || ""} disabled readOnly hint="Email cannot be changed yet." />

        <div role="alert" aria-live="polite" className="space-y-1">
          {serverError && <p className="text-xs text-rockstar-error">{serverError}</p>}
          {successMessage && <p className="text-xs text-rockstar-success">{successMessage}</p>}
        </div>

        <Button type="submit" loading={submitting} disabled={submitting}>
          Save changes
        </Button>
      </form>
    </div>
  );
}

function ChangePasswordCard({ onPasswordChanged }) {
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
