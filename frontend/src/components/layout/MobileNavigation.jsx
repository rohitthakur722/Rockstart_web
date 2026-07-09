import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../../utils/cn";
import { CloseIcon, MusicNoteIcon, ShieldIcon } from "../common/icons";
import { useAuth } from "../../hooks/useAuth";
import { NAV_ITEMS } from "./navigationItems";

export function MobileNavigation({ open, onClose }) {
  const { user } = useAuth();
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      <nav
        aria-label="Mobile navigation"
        className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col border-r border-rockstar-border bg-rockstar-black px-4 py-6"
      >
        <div className="mb-8 flex items-center justify-between px-1">
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rockstar-gradient text-rockstar-black">
              <MusicNoteIcon width={18} height={18} aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-rockstar-text-primary">
              Rockstar
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-full p-1.5 text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-[var(--radius-field)] px-3.5 py-3 text-sm font-medium transition-colors duration-150",
                  "focus-visible:outline-2 focus-visible:outline-rockstar-tan focus-visible:outline-offset-2",
                  isActive
                    ? "bg-rockstar-surface-elevated text-rockstar-tan-light"
                    : "text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary"
                )
              }
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <>
              <div className="my-2 border-t border-rockstar-border" role="separator" />
              <NavLink
                to="/admin"
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-[var(--radius-field)] px-3.5 py-3 text-sm font-medium transition-colors duration-150",
                    "focus-visible:outline-2 focus-visible:outline-rockstar-tan focus-visible:outline-offset-2",
                    isActive
                      ? "bg-rockstar-surface-elevated text-rockstar-tan-light"
                      : "text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary"
                  )
                }
              >
                <ShieldIcon aria-hidden="true" />
                <span>Admin</span>
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}
