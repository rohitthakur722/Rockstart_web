import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MenuIcon, SearchIcon } from "../common/icons";
import { Avatar } from "../common/Avatar";
import { useAuth } from "../../hooks/useAuth";

export function TopBar({ title, onMenuClick }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const trimmed = search.trim();
    navigate(trimmed ? `/library?tab=songs&search=${encodeURIComponent(trimmed)}` : "/library?tab=songs");
  };

  return (
    <header className="sticky top-0 z-20 flex h-[var(--height-topbar)] items-center gap-3 border-b border-rockstar-border bg-rockstar-background/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="rounded-full p-2 text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan lg:hidden"
      >
        <MenuIcon aria-hidden="true" />
      </button>

      <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-rockstar-text-primary sm:text-lg">
        {title}
      </h1>

      <form onSubmit={handleSearchSubmit} className="relative hidden sm:block">
        <label htmlFor="topbar-search" className="sr-only">
          Search Rockstar
        </label>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rockstar-text-secondary"
          width={16}
          height={16}
        />
        <input
          id="topbar-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search Rockstar…"
          className="h-9 w-52 rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface pl-9 pr-3 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
        />
      </form>

      <Link
        to="/profile"
        aria-label={user ? `Go to your profile, ${user.fullName}` : "Go to your profile"}
        className="flex items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-rockstar-tan"
      >
        <Avatar avatarUrl={user?.avatarUrl} name={user?.fullName} size="sm" />
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-rockstar-text-primary md:inline">
          {user?.fullName}
        </span>
      </Link>
    </header>
  );
}
