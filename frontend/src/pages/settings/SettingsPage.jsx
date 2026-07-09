import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/common/PageHeader";
import { Button } from "../../components/common/Button";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Switch } from "../../components/common/Switch";
import { ChangePasswordCard } from "../../components/profile/ChangePasswordCard";
import { ActiveSessionsCard } from "../../components/profile/ActiveSessionsCard";
import { usePreferences } from "../../hooks/usePreferences";
import { useAuth } from "../../hooks/useAuth";
import { useAppVersion } from "../../hooks/useAppVersion";
import * as historyApi from "../../api/historyApi";
import * as preferenceApi from "../../api/preferenceApi";
import { extractErrorMessage } from "../../api/axiosInstance";

const TABS = [
  { value: "appearance", label: "Appearance" },
  { value: "playback", label: "Playback" },
  { value: "privacy", label: "Privacy" },
  { value: "security", label: "Security" },
  { value: "about", label: "About" },
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TABS.some((t) => t.value === searchParams.get("tab")) ? searchParams.get("tab") : "appearance";

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your Rockstar experience." />

      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex gap-1 overflow-x-auto rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface p-1"
      >
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.value}
            onClick={() => setSearchParams({ tab: tab.value })}
            className={`shrink-0 rounded-[calc(var(--radius-field)-4px)] px-3.5 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-rockstar-surface-elevated text-rockstar-tan-light"
                : "text-rockstar-text-secondary hover:text-rockstar-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === "appearance" && <AppearanceSection />}
        {activeTab === "playback" && <PlaybackSection />}
        {activeTab === "privacy" && <PrivacySection />}
        {activeTab === "security" && <SecuritySection />}
        {activeTab === "about" && <AboutSection />}
      </div>
    </div>
  );
}

function SettingsCard({ title, description, children }) {
  return (
    <section className="space-y-1 rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-5">
      <h2 className="text-sm font-semibold text-rockstar-text-primary">{title}</h2>
      {description && <p className="text-sm text-rockstar-text-secondary">{description}</p>}
      <div className="divide-y divide-rockstar-border pt-2">{children}</div>
    </section>
  );
}

function AppearanceSection() {
  const { preferences, updatePreferences, error } = usePreferences();
  const [saveError, setSaveError] = useState("");

  const handleUpdate = async (partial) => {
    setSaveError("");
    try {
      await updatePreferences(partial);
    } catch (err) {
      setSaveError(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <SettingsCard title="Theme" description="Applies immediately and syncs across your devices.">
        <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-2 py-2">
          {[
            { value: "system", label: "System" },
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={preferences.theme === option.value}
              onClick={() => handleUpdate({ theme: option.value })}
              className={`rounded-[var(--radius-field)] border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rockstar-tan ${
                preferences.theme === option.value
                  ? "border-rockstar-tan bg-rockstar-surface-elevated text-rockstar-tan-light"
                  : "border-rockstar-border text-rockstar-text-secondary hover:text-rockstar-text-primary"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Motion & layout">
        <Switch
          label="Reduce motion"
          description="Minimizes transitions and animations across the app."
          checked={preferences.reduceMotion}
          onChange={(value) => handleUpdate({ reduceMotion: value })}
        />
        <Switch
          label="Compact layout"
          description="Narrower sidebar and top bar for more content on screen."
          checked={preferences.compactLayout}
          onChange={(value) => handleUpdate({ compactLayout: value })}
        />
      </SettingsCard>

      <div role="alert" aria-live="polite">
        {(saveError || error) && <p className="text-xs text-rockstar-error">{saveError || error}</p>}
      </div>
    </div>
  );
}

function PlaybackSection() {
  const { preferences, updatePreferences } = usePreferences();
  const [saveError, setSaveError] = useState("");

  const handleUpdate = async (partial) => {
    setSaveError("");
    try {
      await updatePreferences(partial);
    } catch (err) {
      setSaveError(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <SettingsCard title="Playback behavior">
        <Switch
          label="Autoplay next song"
          description="When off, playback stops after the current song ends naturally. Manual Next and Repeat One still work."
          checked={preferences.autoplayNext}
          onChange={(value) => handleUpdate({ autoplayNext: value })}
        />
        <Switch
          label="Remember player state"
          description="Restores your queue and position (paused) next time you sign in. Turning this off clears anything already saved."
          checked={preferences.rememberPlayerState}
          onChange={(value) => handleUpdate({ rememberPlayerState: value })}
        />
        <Switch
          label="Keyboard shortcuts"
          description="Space, arrow keys, M, N, and P control playback while the player is active."
          checked={preferences.keyboardShortcutsEnabled}
          onChange={(value) => handleUpdate({ keyboardShortcutsEnabled: value })}
        />
      </SettingsCard>

      <div role="alert" aria-live="polite">
        {saveError && <p className="text-xs text-rockstar-error">{saveError}</p>}
      </div>
    </div>
  );
}

function PrivacySection() {
  const [clearOpen, setClearOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const handleClearHistory = async () => {
    await historyApi.clearHistory();
    setClearOpen(false);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      await preferenceApi.downloadExport();
    } catch (err) {
      setExportError(extractErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsCard title="Listening history" description="Songs you've listened to for a meaningful amount of time.">
        <div className="flex items-center justify-between gap-4 py-2">
          <p className="text-sm text-rockstar-text-secondary">
            Clearing removes your recent-plays and statistics. It does not affect the catalog's public play counts,
            delete any audio, or remove your likes or playlists.
          </p>
          <Button variant="ghost" size="sm" className="shrink-0 text-rockstar-error hover:bg-rockstar-error/10" onClick={() => setClearOpen(true)}>
            Clear history
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Your data" description="Download a copy of your account data.">
        <div className="flex items-center justify-between gap-4 py-2">
          <p className="text-sm text-rockstar-text-secondary">
            Includes your profile, preferences, liked-song references, playlists, qualified listening history, and
            uploaded-song metadata. Never includes passwords, tokens, or other users' data.
          </p>
          <Button variant="secondary" size="sm" className="shrink-0" loading={exporting} disabled={exporting} onClick={handleExport}>
            Export data
          </Button>
        </div>
        {exportError && <p className="text-xs text-rockstar-error">{exportError}</p>}
      </SettingsCard>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear listening history?"
        description="This removes your recent-plays and statistics history. It does not affect the catalog's public play counts or delete any audio."
        confirmLabel="Clear history"
        onConfirm={handleClearHistory}
      />
    </div>
  );
}

function SecuritySection() {
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
  };

  return (
    <div className="space-y-4">
      <ChangePasswordCard onPasswordChanged={handleLogout} />
      <ActiveSessionsCard />

      <SettingsCard title="Current session">
        <div className="flex items-center justify-between gap-4 py-2">
          <p className="text-sm text-rockstar-text-secondary">Sign out of Rockstar on this device.</p>
          <Button variant="ghost" size="sm" className="shrink-0 text-rockstar-error hover:bg-rockstar-error/10" loading={loggingOut} disabled={loggingOut} onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}

function AboutSection() {
  const versionInfo = useAppVersion();

  return (
    <SettingsCard title="About">
      <div className="space-y-1 py-2 text-sm text-rockstar-text-secondary">
        <p className="font-medium text-rockstar-text-primary">Rockstar Music Player</p>
        <p>{versionInfo ? `${versionInfo.phase} · v${versionInfo.version}` : "Loading version…"}</p>
        <p>Node.js/Express + PostgreSQL backend, React frontend.</p>
        <p>Your local music catalog, streaming, and listening data stay on this Rockstar instance.</p>
      </div>
    </SettingsCard>
  );
}
