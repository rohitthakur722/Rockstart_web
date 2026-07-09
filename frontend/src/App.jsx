import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { DevHealthBadge } from "./components/common/DevHealthBadge";
import { AuthProvider } from "./context/AuthProvider";
import { PersonalLibraryProvider } from "./context/PersonalLibraryProvider";
import { PlayerProvider } from "./context/PlayerProvider";
import { AppRouter } from "./routes/AppRouter";

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PersonalLibraryProvider>
          <PlayerProvider>
            <AppRouter />
            <DevHealthBadge />
          </PlayerProvider>
        </PersonalLibraryProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
