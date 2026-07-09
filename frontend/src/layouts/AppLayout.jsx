import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../components/layout/Sidebar";
import { TopBar } from "../components/layout/TopBar";
import { MobileNavigation } from "../components/layout/MobileNavigation";
import { PlayerBar } from "../components/player/PlayerBar";
import { usePlayer } from "../hooks/usePlayer";

const STATIC_PAGE_TITLES = {
  "/home": "Home",
  "/library": "Library",
  "/library/uploads": "My Uploads",
  "/library/upload": "Upload Music",
  "/playlists": "Playlists",
  "/liked": "Liked Songs",
  "/player": "Now Playing",
  "/history": "Listening History",
  "/profile": "Profile",
  "/settings": "Settings",
};

// Dynamic detail pages (song/artist/album/playlist) render their own heading
// in the page body, so the TopBar only needs a generic, honest label here —
// never a leftover/misleading static title from a route that doesn't apply.
const DYNAMIC_PAGE_TITLES = [
  { prefix: "/songs/", title: "Song" },
  { prefix: "/artists/", title: "Artist" },
  { prefix: "/albums/", title: "Album" },
  { prefix: "/playlists/", title: "Playlist" },
];

const resolvePageTitle = (pathname) => {
  if (STATIC_PAGE_TITLES[pathname]) return STATIC_PAGE_TITLES[pathname];

  const dynamicMatch = DYNAMIC_PAGE_TITLES.find(({ prefix }) => pathname.startsWith(prefix));
  if (dynamicMatch) return dynamicMatch.title;

  return "Rockstar";
};

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const title = resolvePageTitle(location.pathname);
  const { currentSong } = usePlayer();

  return (
    <div className="min-h-svh bg-rockstar-background">
      <Sidebar />
      <MobileNavigation open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="lg:pl-[var(--width-sidebar)]">
        <TopBar title={title} onMenuClick={() => setMenuOpen(true)} />
        <main
          id="main-content"
          className={`mx-auto w-full max-w-[var(--width-content)] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 ${currentSong ? "pb-24 lg:pb-28" : ""}`}
        >
          <Outlet />
        </main>
      </div>

      <PlayerBar />
    </div>
  );
}
