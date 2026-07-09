import {
  HomeIcon,
  LibraryIcon,
  PlaylistIcon,
  HeartIcon,
  UserIcon,
  SettingsIcon,
} from "../common/icons";

export const NAV_ITEMS = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/library", label: "Library", icon: LibraryIcon },
  { to: "/playlists", label: "Playlists", icon: PlaylistIcon },
  { to: "/liked", label: "Liked Songs", icon: HeartIcon },
  { to: "/profile", label: "Profile", icon: UserIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];
