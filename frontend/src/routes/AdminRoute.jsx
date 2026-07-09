import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LoadingSpinner } from "../components/common/LoadingSpinner";

// Guards every /admin/* route. Role is always re-verified against the
// backend on every request anyway (authenticate.middleware.js re-reads the
// user row fresh each time) — this guard exists purely so an ordinary user
// never even sees an admin page render before the 403 would arrive, not as
// the actual security boundary.
export function AdminRoute() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "checking") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-rockstar-background">
        <LoadingSpinner label="Checking your session" size="lg" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}
