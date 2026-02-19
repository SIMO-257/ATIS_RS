const getApiUrl = () => {
  if (window.location.protocol === "https:") {
    return "/api";
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
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
