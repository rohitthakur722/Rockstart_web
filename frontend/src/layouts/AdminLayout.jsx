import { NavLink, Outlet, Link } from "react-router-dom";
import { PlayerBar } from "../components/player/PlayerBar";
import { usePlayer } from "../hooks/usePlayer";
import { cn } from "../utils/cn";
import { GridIcon, UsersIcon, MusicNoteIcon, UserIcon, AlbumIcon, TagIcon, ClipboardIcon, ChevronLeftIcon } from "../components/common/icons";

const ADMIN_NAV_ITEMS = [
  { to: "/admin", label: "Overview", icon: GridIcon, end: true },
  { to: "/admin/users", label: "Users", icon: UsersIcon },
  { to: "/admin/music", label: "Music", icon: MusicNoteIcon },
  { to: "/admin/artists", label: "Artists", icon: UserIcon },
  { to: "/admin/albums", label: "Albums", icon: AlbumIcon },
  { to: "/admin/genres", label: "Genres", icon: TagIcon },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ClipboardIcon },
];

function AdminNavLink({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[var(--radius-field)] px-3.5 py-2.5 text-sm font-medium transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-rockstar-tan focus-visible:outline-offset-2",
          isActive
            ? "bg-rockstar-surface-elevated text-rockstar-tan-light"
            : "text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon aria-hidden="true" width={18} height={18} className={isActive ? "text-rockstar-tan" : undefined} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function AdminLayout() {
  const { currentSong } = usePlayer();

  return (
    <div className="min-h-svh bg-rockstar-background">
      <div className="lg:flex">
        <aside
          aria-label="Admin"
          className="border-b border-rockstar-border bg-rockstar-black px-4 py-4 lg:sticky lg:top-0 lg:h-svh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:py-6"
        >
          <Link
            to="/home"
            className="mb-4 flex items-center gap-2 px-1 text-sm text-rockstar-text-secondary hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan rounded-md w-fit"
          >
            <ChevronLeftIcon width={16} height={16} aria-hidden="true" />
            Back to Rockstar
          </Link>
          <h2 className="mb-3 px-1 text-lg font-semibold tracking-tight text-rockstar-text-primary">Admin</h2>
          <nav
            aria-label="Admin navigation"
            className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
          >
            {ADMIN_NAV_ITEMS.map((item) => (
              <AdminNavLink key={item.to} {...item} />
            ))}
          </nav>
        </aside>

        <main
          id="main-content"
          className={cn("min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8", currentSong ? "pb-24 lg:pb-28" : "")}
        >
          <Outlet />
        </main>
      </div>

      <PlayerBar />
    </div>
  );
}
