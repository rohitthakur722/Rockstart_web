const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const HomeIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20h3.5a1 1 0 0 0 1-1v-9" />
  </svg>
);

export const LibraryIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <rect x="3.5" y="3.5" width="6" height="17" rx="1.2" />
    <rect x="14.5" y="6.5" width="6" height="14" rx="1.2" />
    <path d="M6.5 8h0M17.5 10.5h0" />
  </svg>
);

export const PlaylistIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M4 6h11M4 12h11M4 18h7" />
    <circle cx="18.5" cy="16.5" r="2.5" />
    <path d="M21 16.5V7l-3 1" />
  </svg>
);

export const HeartIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M12 20s-7.2-4.6-9.6-9A5.3 5.3 0 0 1 12 6a5.3 5.3 0 0 1 9.6 5c-2.4 4.4-9.6 9-9.6 9Z" />
  </svg>
);

export const UserIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
);

export const SettingsIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13a7.9 7.9 0 0 0 0-2l2-1.5-2-3.4-2.4.7a8 8 0 0 0-1.7-1L15 3h-4l-.3 2.8a8 8 0 0 0-1.7 1l-2.4-.7-2 3.4L6.6 11a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.4 2.4-.7a8 8 0 0 0 1.7 1L11 21h4l.3-2.8a8 8 0 0 0 1.7-1l2.4.7 2-3.4-2-1.5Z" />
  </svg>
);

export const MenuIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const CloseIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const SearchIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-3.6-3.6" />
  </svg>
);

export const EyeIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.75" />
  </svg>
);

export const EyeOffIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M3 3l18 18" />
    <path d="M10.6 5.6A10.6 10.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a13.9 13.9 0 0 1-3.2 3.9M6.5 6.9C4 8.6 2.5 12 2.5 12S6 18.5 12 18.5a9.9 9.9 0 0 0 3.3-.6" />
    <path d="M9.9 10a2.75 2.75 0 0 0 3.9 3.9" />
  </svg>
);

export const AlertIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M12 3.5 22 20H2L12 3.5Z" />
    <path d="M12 10v4.5M12 17.2h0" />
  </svg>
);

export const MusicNoteIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M9 18V5.5L20 3v12.5" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="15.5" r="2.5" />
  </svg>
);

export const ChevronLeftIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M15 5 8 12l7 7" />
  </svg>
);

export const ChevronRightIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const RefreshIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M20 11A8 8 0 0 0 5.5 6.5L4 8" />
    <path d="M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" />
    <path d="M20 20v-4h-4" />
  </svg>
);

export const PlusIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const PlayIcon = (props) => (
  <svg {...base} {...props} fill="currentColor" stroke="none" aria-hidden="true">
    <path d="M7 4.5v15l13-7.5-13-7.5Z" />
  </svg>
);

export const PauseIcon = (props) => (
  <svg {...base} {...props} fill="currentColor" stroke="none" aria-hidden="true">
    <rect x="6" y="4.5" width="4.5" height="15" rx="1" />
    <rect x="13.5" y="4.5" width="4.5" height="15" rx="1" />
  </svg>
);

export const PreviousIcon = (props) => (
  <svg {...base} {...props} fill="currentColor" stroke="none" aria-hidden="true">
    <path d="M6 4.5a1 1 0 0 1 1 1v6l11.2-6.7a1 1 0 0 1 1.5.86v12.68a1 1 0 0 1-1.5.86L7 12.5v6a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1H6Z" />
  </svg>
);

export const NextIcon = (props) => (
  <svg {...base} {...props} fill="currentColor" stroke="none" aria-hidden="true">
    <path d="M18 4.5a1 1 0 0 0-1 1v6L5.8 4.8a1 1 0 0 0-1.5.86v12.68a1 1 0 0 0 1.5.86L17 12.5v6a1 1 0 0 0 1 1h.5a1 1 0 0 0 1-1v-13a1 1 0 0 0-1-1H18Z" />
  </svg>
);

export const ShuffleIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M3 6h3.5L15 17.5h3.5M14.5 6H18M18 6l-3-3M18 6l-3 3M3 17.5h3.5L11 12M14.5 17.5H18M18 17.5l-3 3M18 17.5l-3-3" />
  </svg>
);

export const RepeatIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M6.5 8H16a3 3 0 0 1 3 3v1.5M4.5 12.5V11a3 3 0 0 1 .3-1.3M17.5 16H8a3 3 0 0 1-3-3v-1.5" />
    <path d="M9 5 6.5 8 9 11M15 19l2.5-3-2.5-3" />
  </svg>
);

export const RepeatOneIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M6.5 8H16a3 3 0 0 1 3 3v1.5M4.5 12.5V11a3 3 0 0 1 .3-1.3M17.5 16H8a3 3 0 0 1-3-3v-1.5" />
    <path d="M9 5 6.5 8 9 11M15 19l2.5-3-2.5-3" />
    <path d="M12 9.8v3.4M11.3 10.2 12 9.8" />
  </svg>
);

export const VolumeIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4Z" />
    <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
);

export const MuteIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4Z" />
    <path d="M16 9.5l4.5 5M20.5 9.5 16 14.5" />
  </svg>
);

export const QueueIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M4 6h12M4 12h12M4 18h7" />
    <path d="M17.5 10v9M17.5 10l-2.5 2.5M17.5 10l2.5 2.5" />
  </svg>
);

export const ExpandIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
  </svg>
);

export const MoreIcon = (props) => (
  <svg {...base} {...props} fill="currentColor" stroke="none" aria-hidden="true">
    <circle cx="12" cy="5.5" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <circle cx="12" cy="18.5" r="1.75" />
  </svg>
);

export const CheckIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M5 12.5 9.5 17 19 7" />
  </svg>
);

export const ArrowUpIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

export const ArrowDownIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M12 5v14M18 13l-6 6-6-6" />
  </svg>
);

export const ClockIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const ShieldIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M12 3.5 19 6.5v5.5c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6.5L12 3.5Z" />
    <path d="M9 12l2 2 4-4.5" />
  </svg>
);

export const UsersIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <circle cx="9" cy="8" r="3" />
    <path d="M2.5 19a6.5 6.5 0 0 1 13 0" />
    <path d="M16 6.2a3 3 0 0 1 0 5.8M21.5 19a5.5 5.5 0 0 0-4.5-5.4" />
  </svg>
);

export const ClipboardIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <rect x="5" y="4.5" width="14" height="16" rx="1.5" />
    <rect x="9" y="3" width="6" height="3" rx="1" />
    <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
  </svg>
);

export const GridIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2" />
    <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.2" />
    <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.2" />
    <rect x="13" y="13" width="7.5" height="7.5" rx="1.2" />
  </svg>
);

export const AlbumIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

export const TagIcon = (props) => (
  <svg {...base} {...props} aria-hidden="true">
    <path d="M11.5 3.5H5a1.5 1.5 0 0 0-1.5 1.5v6.5L12 20l8.5-8.5Z" />
    <circle cx="8" cy="8" r="1.4" />
  </svg>
);
