const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (window.location.protocol === "https:") {
    return "/api";
  }
  return "/api";
};

const getFrontendUrl = () => {
  if (import.meta.env.VITE_FRONTEND_URL) {
    return import.meta.env.VITE_FRONTEND_URL;
  }
  return window.location.origin;
};

export const API_URL = getApiUrl();
export const FRONTEND_URL = getFrontendUrl();

export const DEFAULT_API_HEADERS = {
  "ngrok-skip-browser-warning": "true",
};

export const getApiHeaders = (extraHeaders = {}) => ({
  ...DEFAULT_API_HEADERS,
  ...extraHeaders,
});
