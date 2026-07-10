import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { DevHealthBadge } from "./components/common/DevHealthBadge";
import { AuthProvider } from "./context/AuthProvider";
import { PreferenceProvider } from "./context/PreferenceProvider";
import { PersonalLibraryProvider } from "./context/PersonalLibraryProvider";
import { DeviceLibraryProvider } from "./context/DeviceLibraryProvider";
import { PlayerProvider } from "./context/PlayerProvider";
import { AppRouter } from "./routes/AppRouter";

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PreferenceProvider>
          <PersonalLibraryProvider>
            <DeviceLibraryProvider>
              <PlayerProvider>
                <AppRouter />
                <DevHealthBadge />
              </PlayerProvider>
            </DeviceLibraryProvider>
          </PersonalLibraryProvider>
        </PreferenceProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
