import { useCallback, useEffect, useRef, useState } from "react";
import * as authApi from "../api/authApi";
import { setAccessToken, clearAccessToken, setSessionExpiredHandler } from "../services/authTokenStore";
import { AuthContext } from "./AuthContext";

// "checking" -> "authenticated" | "unauthenticated"
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("checking");
  const hasRestoredSession = useRef(false);

  const handleSessionExpired = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(handleSessionExpired);
  }, [handleSessionExpired]);

  useEffect(() => {
    if (hasRestoredSession.current) return;
    hasRestoredSession.current = true;

    authApi
      .refresh()
      .then((res) => {
        setAccessToken(res.data.accessToken);
        setUser(res.data.user);
        setStatus("authenticated");
      })
      .catch(() => {
        clearAccessToken();
        setUser(null);
        setStatus("unauthenticated");
      });
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await authApi.login(credentials);
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    setStatus("authenticated");
    return res.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await authApi.register(payload);
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    setStatus("authenticated");
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearAccessToken();
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const updateCurrentUser = useCallback((updatedUser) => {
    setUser((prev) => (prev ? { ...prev, ...updatedUser } : updatedUser));
  }, []);

  const value = {
    user,
    status,
    isAuthenticated: status === "authenticated",
    login,
    register,
    logout,
    updateCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
