// Access token lives only in memory — never localStorage/sessionStorage.
let accessToken = null;
let sessionExpiredHandler = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const clearAccessToken = () => {
  accessToken = null;
};

// Registered by AuthContext so the axios interceptor (a plain module, outside
// React) can notify it when a silent refresh fails and the session is over.
export const setSessionExpiredHandler = (handler) => {
  sessionExpiredHandler = handler;
};

export const notifySessionExpired = () => {
  sessionExpiredHandler?.();
};
