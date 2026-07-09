import { Link } from "react-router-dom";
import { Button } from "../components/common/Button";
import { MusicNoteIcon } from "../components/common/icons";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-rockstar-atmosphere px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rockstar-surface-elevated text-rockstar-tan">
        <MusicNoteIcon width={26} height={26} aria-hidden="true" />
      </span>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-rockstar-tan">404</p>
        <h1 className="text-2xl font-semibold text-rockstar-text-primary">Track not found</h1>
        <p className="max-w-sm text-sm text-rockstar-text-secondary">
          The page you're looking for doesn't exist or may have moved.
        </p>
      </div>
      <Button as={Link} to="/">
        Back to Rockstar
      </Button>
    </div>
  );
}
