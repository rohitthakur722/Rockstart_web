import { Link, NavLink } from "react-router-dom";
import { cn } from "../../utils/cn";
import { MusicNoteIcon } from "../common/icons";
import { Avatar } from "../common/Avatar";
import { useAuth } from "../../hooks/useAuth";
import { NAV_ITEMS } from "./navigationItems";

function NavItem({ to, label, icon: Icon, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-[var(--radius-field)] px-3.5 py-2.5 text-sm font-medium transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-rockstar-tan focus-visible:outline-offset-2",
          isActive
            ? "bg-rockstar-surface-elevated text-rockstar-tan-light"
            : "text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon aria-hidden="true" className={isActive ? "text-rockstar-tan" : undefined} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { user } = useAuth();

  return (
    <aside
      aria-label="Primary"
      className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[var(--width-sidebar)] lg:flex-col lg:border-r lg:border-rockstar-border lg:bg-rockstar-black lg:px-4 lg:py-6"
    >
      <a href="/" className="mb-8 flex items-center gap-2.5 px-2 focus-visible:outline-2 focus-visible:outline-rockstar-tan focus-visible:outline-offset-2 rounded-md w-fit">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rockstar-gradient text-rockstar-black">
          <MusicNoteIcon width={18} height={18} aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-rockstar-text-primary">Rockstar</span>
      </a>

      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <Link
        to="/profile"
        className="flex items-center gap-2.5 rounded-[var(--radius-field)] px-3 py-2 hover:bg-rockstar-surface focus-visible:outline-2 focus-visible:outline-rockstar-tan"
      >
        <Avatar avatarUrl={user?.avatarUrl} name={user?.fullName} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-rockstar-text-primary">
            {user?.fullName}
          </span>
          <span className="block text-xs text-rockstar-text-secondary">Rockstar &middot; v1.0.0</span>
        </span>
      </Link>
    </aside>
  );
}
