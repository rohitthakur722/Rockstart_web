import { useEffect, useState } from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { Pagination } from "../../components/common/Pagination";
import { Button } from "../../components/common/Button";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { AdminTable, AdminTableHeadCell, AdminTableCell } from "../../components/admin/AdminTable";
import { RoleBadge, UserStatusBadge } from "../../components/admin/UserStatusBadge";
import { SearchIcon, UsersIcon } from "../../components/common/icons";
import * as adminApi from "../../api/adminApi";
import { extractErrorMessage } from "../../api/axiosInstance";
import { useAuth } from "../../hooks/useAuth";
import { useCatalogParams } from "../../hooks/useCatalogParams";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

const requestKeyFor = (params, refreshIndex) => JSON.stringify([params, refreshIndex]);

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { params, updateParams, setPage } = useCatalogParams({ search: "", role: "", status: "" });
  const [searchInput, setSearchInput] = useState(params.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [result, setResult] = useState({ key: null, status: "loading", items: [], pagination: null, error: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [pendingAction, setPendingAction] = useState(null); // { type: "role"|"status", user, nextValue }

  useEffect(() => {
    if (debouncedSearch !== params.search) updateParams({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    const key = requestKeyFor(params, refreshIndex);

    adminApi
      .listUsers(
        { search: params.search || undefined, role: params.role || undefined, status: params.status || undefined, page: params.page },
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
  }, [params.search, params.role, params.status, params.page, refreshIndex]);

  const isLoading = result.key !== requestKeyFor(params, refreshIndex);
  const reload = () => setRefreshIndex((i) => i + 1);

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.type === "role") {
      await adminApi.changeUserRole(pendingAction.user.id, pendingAction.nextValue);
    } else {
      await adminApi.changeUserStatus(pendingAction.user.id, pendingAction.nextValue);
    }
    setPendingAction(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Manage roles and account status." />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block max-w-xs flex-1">
          <span className="sr-only">Search users</span>
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
            placeholder="Search name, username, email…"
            className="h-10 w-full rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface pl-9 pr-3 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
          />
        </label>

        <select
          value={params.role}
          onChange={(event) => updateParams({ role: event.target.value })}
          aria-label="Filter by role"
          className="h-10 rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface px-3 text-sm text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>

        <select
          value={params.status}
          onChange={(event) => updateParams({ status: event.target.value })}
          aria-label="Filter by status"
          className="h-10 rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface px-3 text-sm text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner label="Loading users" size="lg" />
        </div>
      )}

      {!isLoading && result.status === "error" && <ErrorState message={result.error} onRetry={reload} />}

      {!isLoading && result.status === "success" && result.items.length === 0 && (
        <EmptyState icon={UsersIcon} title="No users match these filters" description="Try a different search or filter." />
      )}

      {!isLoading && result.status === "success" && result.items.length > 0 && (
        <div className="space-y-4">
          <AdminTable caption="Users">
            <thead>
              <tr>
                <AdminTableHeadCell>Name</AdminTableHeadCell>
                <AdminTableHeadCell>Role</AdminTableHeadCell>
                <AdminTableHeadCell>Status</AdminTableHeadCell>
                <AdminTableHeadCell>Uploads</AdminTableHeadCell>
                <AdminTableHeadCell>Playlists</AdminTableHeadCell>
                <AdminTableHeadCell>Joined</AdminTableHeadCell>
                <AdminTableHeadCell>Actions</AdminTableHeadCell>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => {
                const isSelf = String(item.id) === String(currentUser?.id);
                return (
                  <tr key={item.id}>
                    <AdminTableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-rockstar-text-primary">
                          {item.fullName} {isSelf && <span className="text-xs text-rockstar-text-secondary">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-rockstar-text-secondary">
                          @{item.username} · {item.email}
                        </p>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>
                      <RoleBadge role={item.role} />
                    </AdminTableCell>
                    <AdminTableCell>
                      <UserStatusBadge isActive={item.isActive} />
                    </AdminTableCell>
                    <AdminTableCell>{item.uploadCount}</AdminTableCell>
                    <AdminTableCell>{item.playlistCount}</AdminTableCell>
                    <AdminTableCell>{new Date(item.createdAt).toLocaleDateString()}</AdminTableCell>
                    <AdminTableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isSelf}
                          onClick={() =>
                            setPendingAction({
                              type: "role",
                              user: item,
                              nextValue: item.role === "admin" ? "user" : "admin",
                            })
                          }
                        >
                          {item.role === "admin" ? "Demote" : "Promote"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSelf}
                          className={item.isActive ? "text-rockstar-error hover:bg-rockstar-error/10" : undefined}
                          onClick={() =>
                            setPendingAction({ type: "status", user: item, nextValue: !item.isActive })
                          }
                        >
                          {item.isActive ? "Suspend" : "Reactivate"}
                        </Button>
                      </div>
                    </AdminTableCell>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
          <Pagination pagination={result.pagination} onPageChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        title={
          pendingAction?.type === "role"
            ? `${pendingAction.nextValue === "admin" ? "Promote" : "Demote"} ${pendingAction.user.fullName}?`
            : `${pendingAction?.nextValue ? "Reactivate" : "Suspend"} ${pendingAction?.user.fullName}?`
        }
        description={
          pendingAction?.type === "role"
            ? pendingAction.nextValue === "admin"
              ? "This grants full administrator access, including user management and catalog moderation."
              : "This removes administrator access. Their existing sessions will be signed out."
            : pendingAction?.nextValue
              ? "This restores account access immediately."
              : "This is a suspension, not a deletion — the account and its data remain intact and can be reactivated later. Their active sessions will be signed out immediately."
        }
        confirmLabel={
          pendingAction?.type === "role"
            ? pendingAction.nextValue === "admin"
              ? "Promote to admin"
              : "Demote to user"
            : pendingAction?.nextValue
              ? "Reactivate account"
              : "Suspend account"
        }
        danger={pendingAction?.type === "status" ? !pendingAction.nextValue : pendingAction?.nextValue !== "admin"}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
