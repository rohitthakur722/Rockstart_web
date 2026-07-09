import { useState } from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { EmptyState } from "../../components/common/EmptyState";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { Button } from "../../components/common/Button";
import { PlaylistCard } from "../../components/personal/PlaylistCard";
import { CreatePlaylistModal } from "../../components/personal/CreatePlaylistModal";
import { PlaylistIcon, PlusIcon } from "../../components/common/icons";
import { usePersonalLibrary } from "../../hooks/usePersonalLibrary";

export default function PlaylistsPage() {
  const { playlists, playlistsLoading } = usePersonalLibrary();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Playlists"
        description="Collections you build around your music."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon width={16} height={16} aria-hidden="true" />
            New playlist
          </Button>
        }
      />

      {playlistsLoading ? (
        <div className="flex justify-center py-12" role="status" aria-live="polite">
          <LoadingSpinner label="Loading playlists" size="lg" />
        </div>
      ) : playlists.length === 0 ? (
        <EmptyState
          icon={PlaylistIcon}
          title="No playlists yet"
          description="Create your first playlist to start organizing your favorite songs."
          actionLabel="New playlist"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {playlists.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      )}

      <CreatePlaylistModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
