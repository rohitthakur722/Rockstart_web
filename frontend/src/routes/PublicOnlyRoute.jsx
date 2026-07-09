import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LoadingSpinner } from "../components/common/LoadingSpinner";

export function PublicOnlyRoute() {
  const { status } = useAuth();

  if (status === "checking") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-rockstar-atmosphere">
        <LoadingSpinner label="Checking your session" size="lg" />
      </div>
    );
  }

  if (status === "authenticated") {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}
