import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/common/PageHeader";
import { Button } from "../../components/common/Button";
import { SearchIcon, DeviceIcon } from "../../components/common/icons";
import { cn } from "../../utils/cn";
import { useCatalogParams } from "../../hooks/useCatalogParams";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import SongsTab from "./SongsTab";
import AlbumsTab from "./AlbumsTab";
import ArtistsTab from "./ArtistsTab";
import { SONGS_SORT_OPTIONS, ALBUMS_SORT_OPTIONS, ARTISTS_SORT_OPTIONS } from "./sortOptions";

const TABS = [
  { value: "songs", label: "Songs", sortOptions: SONGS_SORT_OPTIONS, defaultSort: "createdAt" },
  { value: "albums", label: "Albums", sortOptions: ALBUMS_SORT_OPTIONS, defaultSort: "createdAt" },
  { value: "artists", label: "Artists", sortOptions: ARTISTS_SORT_OPTIONS, defaultSort: "name" },
];

export default function LibraryPage() {
  const { params, updateParams, setPage } = useCatalogParams({
    tab: "songs",
    search: "",
    sort: "createdAt",
    order: "desc",
  });

  const activeTab = TABS.find((t) => t.value === params.tab) || TABS[0];

  const [searchInput, setSearchInput] = useState(params.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);

  // Resync the visible search text when the tab changes (e.g. via Back/Forward)
  // without deriving it in an Effect — adjusting state during render for a
  // "value changed since last render" comparison is the pattern React's docs
  // recommend instead of an Effect that only mirrors a prop/param.
  const [syncedTab, setSyncedTab] = useState(params.tab);
  if (params.tab !== syncedTab) {
    setSyncedTab(params.tab);
    setSearchInput(params.search);
  }

  useEffect(() => {
    if (debouncedSearch !== params.search) {
      updateParams({ search: debouncedSearch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const handleTabChange = (tabValue) => {
    const tab = TABS.find((t) => t.value === tabValue);
    updateParams({ tab: tabValue, sort: tab.defaultSort, order: "desc" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Library"
        description="Everything in the Rockstar catalog, in one place."
        actions={
          <>
            <Button as={Link} to="/library/device" variant="secondary" size="sm">
              <DeviceIcon width={16} height={16} aria-hidden="true" />
              Scan Device Music
            </Button>
            <Button as={Link} to="/library/upload" size="sm">
              Upload Music
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Library sections"
          className="flex w-fit gap-1 rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface p-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`tab-${tab.value}`}
              aria-selected={activeTab.value === tab.value}
              aria-controls={`tabpanel-${tab.value}`}
              onClick={() => handleTabChange(tab.value)}
              className={cn(
                "rounded-[calc(var(--radius-field)-4px)] px-4 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-rockstar-tan",
                activeTab.value === tab.value
                  ? "bg-rockstar-surface-elevated text-rockstar-tan-light"
                  : "text-rockstar-text-secondary hover:text-rockstar-text-primary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <label className="relative">
            <span className="sr-only">Search {activeTab.label.toLowerCase()}</span>
            <SearchIcon
              aria-hidden="true"
              width={16}
              height={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rockstar-text-secondary"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={`Search ${activeTab.label.toLowerCase()}…`}
              className="h-9 w-full rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface pl-9 pr-3 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary focus-visible:outline-2 focus-visible:outline-rockstar-tan sm:w-52"
            />
          </label>
          <select
            value={params.sort}
            onChange={(event) => updateParams({ sort: event.target.value })}
            aria-label={`Sort ${activeTab.label.toLowerCase()}`}
            className="h-9 rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface px-3 text-sm text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
          >
            {activeTab.sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div role="tabpanel" id={`tabpanel-${activeTab.value}`} aria-labelledby={`tab-${activeTab.value}`}>
        {activeTab.value === "songs" && <SongsTab params={params} setPage={setPage} />}
        {activeTab.value === "albums" && <AlbumsTab params={params} setPage={setPage} />}
        {activeTab.value === "artists" && <ArtistsTab params={params} setPage={setPage} />}
      </div>
    </div>
  );
}
