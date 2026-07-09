import { PageHeader } from "../../components/common/PageHeader";

const SECTIONS = [
  {
    title: "Appearance",
    description: "Theme and display preferences.",
    note: "Available after account setup.",
  },
  {
    title: "Playback",
    description: "Audio quality and playback behavior.",
    note: "Available once playback is implemented.",
  },
  {
    title: "Privacy & data",
    description: "Control what Rockstar remembers about your listening.",
    note: "Available after account setup.",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your Rockstar experience." />

      <div className="space-y-4">
        {SECTIONS.map(({ title, description, note }) => (
          <div
            key={title}
            className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-5"
          >
            <h3 className="text-sm font-semibold text-rockstar-text-primary">{title}</h3>
            <p className="mt-0.5 text-sm text-rockstar-text-secondary">{description}</p>
            <p className="mt-3 inline-block rounded-full border border-rockstar-border bg-rockstar-surface-elevated px-3 py-1 text-xs text-rockstar-text-secondary">
              {note}
            </p>
          </div>
        ))}

        <div className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-5">
          <h3 className="text-sm font-semibold text-rockstar-text-primary">About</h3>
          <p className="mt-0.5 text-sm text-rockstar-text-secondary">Rockstar Music Player</p>
          <p className="text-sm text-rockstar-text-secondary">Phase 1 &middot; v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
