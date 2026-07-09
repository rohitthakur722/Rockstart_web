import { useEffect, useState } from "react";
import { Button } from "../common/Button";
import { LoadingSpinner } from "../common/LoadingSpinner";
import { ErrorState } from "../common/ErrorState";
import { ConfirmDialog } from "../common/ConfirmDialog";
import * as preferenceApi from "../../api/preferenceApi";
import { extractErrorMessage } from "../../api/axiosInstance";

function SessionRow({ session, onRevoke }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-[var(--radius-field)] border border-rockstar-border px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm text-rockstar-text-primary">
          {session.deviceSummary}
          {session.isCurrent && (
            <span className="ml-2 rounded-full border border-rockstar-tan/40 px-2 py-0.5 text-xs text-rockstar-tan">
              Current session
            </span>
          )}
        </p>
        <p className="truncate text-xs text-rockstar-text-secondary">
          Signed in {new Date(session.createdAt).toLocaleString()}
        </p>
      </div>
      {!session.isCurrent && (
        <Button variant="ghost" size="sm" className="shrink-0 text-rockstar-error hover:bg-rockstar-error/10" onClick={onRevoke}>
          Revoke
        </Button>
      )}
    </li>
  );
}

export function ActiveSessionsCard() {
  const [state, setState] = useState({ status: "loading", sessions: [], error: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [revokeTargetId, setRevokeTargetId] = useState(null);
  const [revokeOthersOpen, setRevokeOthersOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    preferenceApi
      .listSessions()
      .then((res) => {
        if (!cancelled) setState({ status: "success", sessions: res.data.sessions, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", sessions: [], error: extractErrorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshIndex]);

  const reload = () => setRefreshIndex((i) => i + 1);

  const handleRevoke = async () => {
    await preferenceApi.revokeSession(revokeTargetId);
    setRevokeTargetId(null);
    reload();
  };

  const handleRevokeOthers = async () => {
    await preferenceApi.revokeOtherSessions();
    setRevokeOthersOpen(false);
    reload();
  };

  const otherSessionsCount = state.sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-rockstar-text-primary">Active Sessions</h3>
          <p className="text-sm text-rockstar-text-secondary">Devices currently signed in to your account.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={otherSessionsCount === 0}
          onClick={() => setRevokeOthersOpen(true)}
        >
          Sign out other sessions
        </Button>
      </div>

      {state.status === "loading" && (
        <div className="flex justify-center py-6">
          <LoadingSpinner label="Loading sessions" />
        </div>
      )}

      {state.status === "error" && <ErrorState message={state.error} onRetry={reload} />}

      {state.status === "success" && (
        <ul className="space-y-2">
          {state.sessions.map((session) => (
            <SessionRow key={session.id} session={session} onRevoke={() => setRevokeTargetId(session.id)} />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={revokeTargetId !== null}
        onClose={() => setRevokeTargetId(null)}
        title="Revoke this session?"
        description="That device will be signed out immediately."
        confirmLabel="Revoke session"
        onConfirm={handleRevoke}
      />

      <ConfirmDialog
        open={revokeOthersOpen}
        onClose={() => setRevokeOthersOpen(false)}
        title="Sign out other sessions?"
        description="Every session except this one will be signed out immediately."
        confirmLabel="Sign out other sessions"
        onConfirm={handleRevokeOthers}
      />
    </div>
  );
}
