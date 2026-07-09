import { useEffect, useState } from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { Pagination } from "../../components/common/Pagination";
import { AdminTable, AdminTableHeadCell, AdminTableCell } from "../../components/admin/AdminTable";
import { ClipboardIcon } from "../../components/common/icons";
import * as adminApi from "../../api/adminApi";
import { extractErrorMessage } from "../../api/axiosInstance";
import { useCatalogParams } from "../../hooks/useCatalogParams";

const requestKeyFor = (params, refreshIndex) => JSON.stringify([params, refreshIndex]);

const ACTION_LABELS = {
  user_role_changed: "Changed user role",
  user_activated: "Reactivated user",
  user_suspended: "Suspended user",
  song_published: "Published song",
  song_unpublished: "Unpublished song",
  song_deleted_by_admin: "Deleted song",
  artist_created: "Created artist",
  artist_updated: "Updated artist",
  artist_deleted: "Deleted artist",
  album_created: "Created album",
  album_updated: "Updated album",
  album_deleted: "Deleted album",
  genre_created: "Created genre",
  genre_updated: "Updated genre",
  genre_deleted: "Deleted genre",
};

const describeAction = (action) => ACTION_LABELS[action] || action;

const describeMetadata = (log) => {
  const meta = log.metadata;
  if (!meta || typeof meta !== "object") return null;
  const parts = Object.entries(meta).map(([key, value]) => `${key}: ${value}`);
  return parts.join(", ");
};

export default function AdminAuditLogsPage() {
  const { params, updateParams, setPage } = useCatalogParams({ action: "", targetType: "" });
  const [result, setResult] = useState({ key: null, status: "loading", items: [], pagination: null, error: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const key = requestKeyFor(params, refreshIndex);

    adminApi
      .listAuditLogs(
        { action: params.action || undefined, targetType: params.targetType || undefined, page: params.page },
        { signal: controller.signal }
      )
      .then((res) => {
        setResult({ key, status: "success", items: res.data.items, pagination: res.data.pagination, error: "" });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setResult({ key, status: "error", items: [], pagination: null, error: extractErrorMessage(err) });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.action, params.targetType, params.page, refreshIndex]);

  const isLoading = result.key !== requestKeyFor(params, refreshIndex);
  const reload = () => setRefreshIndex((i) => i + 1);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="Every administrative action, newest first." />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={params.targetType}
          onChange={(event) => updateParams({ targetType: event.target.value })}
          aria-label="Filter by target type"
          className="h-10 rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface px-3 text-sm text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
        >
          <option value="">All target types</option>
          <option value="user">Users</option>
          <option value="song">Songs</option>
          <option value="artist">Artists</option>
          <option value="album">Albums</option>
          <option value="genre">Genres</option>
        </select>

        <select
          value={params.action}
          onChange={(event) => updateParams({ action: event.target.value })}
          aria-label="Filter by action"
          className="h-10 rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface px-3 text-sm text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
        >
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner label="Loading audit logs" size="lg" />
        </div>
      )}

      {!isLoading && result.status === "error" && <ErrorState message={result.error} onRetry={reload} />}

      {!isLoading && result.status === "success" && result.items.length === 0 && (
        <EmptyState icon={ClipboardIcon} title="No audit log entries yet" description="Administrative actions will appear here." />
      )}

      {!isLoading && result.status === "success" && result.items.length > 0 && (
        <div className="space-y-4">
          <AdminTable caption="Audit logs">
            <thead>
              <tr>
                <AdminTableHeadCell>Timestamp</AdminTableHeadCell>
                <AdminTableHeadCell>Administrator</AdminTableHeadCell>
                <AdminTableHeadCell>Action</AdminTableHeadCell>
                <AdminTableHeadCell>Target</AdminTableHeadCell>
                <AdminTableHeadCell>Details</AdminTableHeadCell>
              </tr>
            </thead>
            <tbody>
              {result.items.map((log) => (
                <tr key={log.id}>
                  <AdminTableCell className="whitespace-nowrap text-xs text-rockstar-text-secondary">
                    {new Date(log.createdAt).toLocaleString()}
                  </AdminTableCell>
                  <AdminTableCell>
                    {log.admin ? (
                      <span className="text-sm text-rockstar-text-primary">{log.admin.fullName}</span>
                    ) : (
                      <span className="text-sm text-rockstar-text-secondary">Unknown</span>
                    )}
                  </AdminTableCell>
                  <AdminTableCell className="font-medium text-rockstar-text-primary">
                    {describeAction(log.action)}
                  </AdminTableCell>
                  <AdminTableCell className="text-xs text-rockstar-text-secondary">
                    {log.targetType} #{log.targetId}
                  </AdminTableCell>
                  <AdminTableCell className="text-xs text-rockstar-text-secondary">
                    {describeMetadata(log) || "—"}
                  </AdminTableCell>
                </tr>
              ))}
            </tbody>
          </AdminTable>
          <Pagination pagination={result.pagination} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
