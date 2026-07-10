import { Link } from "react-router-dom";
import { Button } from "../components/common/Button";
import {
  HeartIcon,
  LibraryIcon,
  MusicNoteIcon,
  PlaylistIcon,
} from "../components/common/icons";
import { useAuth } from "../hooks/useAuth";
import { useAppVersion } from "../hooks/useAppVersion";
import musicDashboardImage from "../assets/musicDashboardImage.jpeg";

const FEATURES = [
  {
    icon: LibraryIcon,
    title: "Your library, organized",
    description: "Every song, album and artist in one clean, searchable space.",
  },
  {
    icon: PlaylistIcon,
    title: "Playlists that stay yours",
    description: "Build collections around a mood, a memory, or a moment.",
  },
  {
    icon: HeartIcon,
    title: "Liked music, always close",
    description:
      "Save the tracks you come back to and pick up right where you left off.",
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const versionInfo = useAppVersion();

  return (
    <div className="min-h-svh bg-rockstar-atmosphere">
      <header className="mx-auto flex w-full max-w-[var(--width-content)] items-center justify-between px-4 py-6 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rockstar-gradient text-rockstar-black">
            <MusicNoteIcon width={18} height={18} aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-rockstar-text-primary">
            Rockstar
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {isAuthenticated ? (
            <Button as={Link} to="/home" variant="primary" size="sm">
              Open Rockstar
            </Button>
          ) : (
            <>
              <Button as={Link} to="/login" variant="ghost" size="sm">
                Log in
              </Button>
              <Button as={Link} to="/register" variant="primary" size="sm">
                Create account
              </Button>
            </>
          )}
        </div>
      </header>

      <main id="main-content">
        <section className="mx-auto grid w-full max-w-[var(--width-content)] gap-10 px-4 py-14 sm:px-8 sm:py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div className="space-y-6">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-rockstar-text-primary sm:text-5xl">
              Your music,
              <span className="text-rockstar-gradient"> your space.</span>
            </h1>
            <p className="max-w-md text-base text-rockstar-text-secondary sm:text-lg">
              A focused music experience built around your library - no clutter,
              no noise, just the songs that matter to you.
            </p>
            <div className="flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Button as={Link} to="/home" size="lg">
                  Open Rockstar
                </Button>
              ) : (
                <>
                  <Button as={Link} to="/register" size="lg">
                    Create account
                  </Button>
                  <Button as={Link} to="/login" variant="secondary" size="lg">
                    Log in
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-md">
            <div className="absolute inset-0 rounded-[var(--radius-card)] bg-rockstar-gradient opacity-20 blur-3xl" />
            <div className="relative flex h-full w-full flex-col justify-end gap-4 overflow-hidden rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-6">
              <div className="flex-1 rounded-[calc(var(--radius-card)-8px)] bg-rockstar-atmosphere">
                <img
                  src={musicDashboardImage}
                  alt="Now playing artwork"
                  className="h-full w-full object-contain object-center"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-rockstar-text-primary">
                  Now playing, wherever you left off
                </p>
                <p className="text-xs text-rockstar-text-secondary">
                  Catalog, uploads, playlists, and history - all live
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[var(--width-content)] px-4 pb-20 sm:px-8">
          <div className="grid gap-6 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-6"
              >
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-rockstar-surface-elevated text-rockstar-tan">
                  <Icon width={18} height={18} aria-hidden="true" />
                </span>
                <h2 className="mb-1.5 text-base font-semibold text-rockstar-text-primary">
                  {title}
                </h2>
                <p className="text-sm text-rockstar-text-secondary">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-rockstar-border px-4 py-8 text-center text-xs text-rockstar-text-secondary sm:px-8">
        Rockstar {versionInfo ? `· v${versionInfo.version}` : ""}
      </footer>
    </div>
  );
}
