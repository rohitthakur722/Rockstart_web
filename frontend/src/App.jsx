import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { DevHealthBadge } from "./components/common/DevHealthBadge";
import { AuthProvider } from "./context/AuthProvider";
import { PreferenceProvider } from "./context/PreferenceProvider";
import { PersonalLibraryProvider } from "./context/PersonalLibraryProvider";
import { PlayerProvider } from "./context/PlayerProvider";
import { AppRouter } from "./routes/AppRouter";

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PreferenceProvider>
          <PersonalLibraryProvider>
            <PlayerProvider>
              <AppRouter />
              <DevHealthBadge />
            </PlayerProvider>
          </PersonalLibraryProvider>
        </PreferenceProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
