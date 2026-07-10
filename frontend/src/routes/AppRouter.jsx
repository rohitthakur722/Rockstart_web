import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { AuthLayout } from "../layouts/AuthLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { PublicOnlyRoute } from "./PublicOnlyRoute";
import { AdminRoute } from "./AdminRoute";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import LandingPage from "../pages/LandingPage";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";
import HomePage from "../pages/home/HomePage";
import LibraryPage from "../pages/library/LibraryPage";
import MyUploadsPage from "../pages/library/MyUploadsPage";
import UploadMusicPage from "../pages/library/UploadMusicPage";
import DeviceLibraryPage from "../pages/library/DeviceLibraryPage";
import SongDetailPage from "../pages/library/SongDetailPage";
import ArtistDetailPage from "../pages/library/ArtistDetailPage";
import AlbumDetailPage from "../pages/library/AlbumDetailPage";
import PlaylistsPage from "../pages/playlists/PlaylistsPage";
import PlaylistDetailPage from "../pages/playlists/PlaylistDetailPage";
import LikedPage from "../pages/liked/LikedPage";
import PlayerPage from "../pages/player/PlayerPage";
import HistoryPage from "../pages/history/HistoryPage";
import ProfilePage from "../pages/profile/ProfilePage";
import SettingsPage from "../pages/settings/SettingsPage";
import NotFoundPage from "../pages/NotFoundPage";

// Admin pages are only ever loaded by administrators — lazy-loading keeps
// them out of the bundle every ordinary user downloads.
const AdminDashboardPage = lazy(() => import("../pages/admin/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("../pages/admin/AdminUsersPage"));
const AdminMusicPage = lazy(() => import("../pages/admin/AdminMusicPage"));
const AdminArtistsPage = lazy(() => import("../pages/admin/AdminArtistsPage"));
const AdminAlbumsPage = lazy(() => import("../pages/admin/AdminAlbumsPage"));
const AdminGenresPage = lazy(() => import("../pages/admin/AdminGenresPage"));
const AdminAuditLogsPage = lazy(() => import("../pages/admin/AdminAuditLogsPage"));

function AdminPageFallback() {
  return (
    <div className="flex justify-center py-16">
      <LoadingSpinner label="Loading" size="lg" />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/uploads" element={<MyUploadsPage />} />
            <Route path="/library/upload" element={<UploadMusicPage />} />
            <Route path="/library/device" element={<DeviceLibraryPage />} />
            <Route path="/songs/:songId" element={<SongDetailPage />} />
            <Route path="/artists/:artistId" element={<ArtistDetailPage />} />
            <Route path="/albums/:albumId" element={<AlbumDetailPage />} />
            <Route path="/playlists" element={<PlaylistsPage />} />
            <Route path="/playlists/:playlistId" element={<PlaylistDetailPage />} />
            <Route path="/liked" element={<LikedPage />} />
            <Route path="/player" element={<PlayerPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route
              path="/admin"
              element={
                <Suspense fallback={<AdminPageFallback />}>
                  <AdminDashboardPage />
                </Suspense>
              }
            />
            <Route
              path="/admin/users"
              element={
                <Suspense fallback={<AdminPageFallback />}>
                  <AdminUsersPage />
                </Suspense>
              }
            />
            <Route
              path="/admin/music"
              element={
                <Suspense fallback={<AdminPageFallback />}>
                  <AdminMusicPage />
                </Suspense>
              }
            />
            <Route
              path="/admin/artists"
              element={
                <Suspense fallback={<AdminPageFallback />}>
                  <AdminArtistsPage />
                </Suspense>
              }
            />
            <Route
              path="/admin/albums"
              element={
                <Suspense fallback={<AdminPageFallback />}>
                  <AdminAlbumsPage />
                </Suspense>
              }
            />
            <Route
              path="/admin/genres"
              element={
                <Suspense fallback={<AdminPageFallback />}>
                  <AdminGenresPage />
                </Suspense>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <Suspense fallback={<AdminPageFallback />}>
                  <AdminAuditLogsPage />
                </Suspense>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
