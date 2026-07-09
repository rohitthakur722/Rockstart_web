import { Link, Outlet } from "react-router-dom";
import { MusicNoteIcon } from "../components/common/icons";

export function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-rockstar-atmosphere">
      <header className="px-4 py-6 sm:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-rockstar-tan focus-visible:outline-offset-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rockstar-gradient text-rockstar-black">
            <MusicNoteIcon width={18} height={18} aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-rockstar-text-primary">
            Rockstar
          </span>
        </Link>
      </header>

      <main id="main-content" className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
