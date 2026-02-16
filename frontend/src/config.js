const getApiUrl = () => {
  // When running in development with Vite's proxy, requests to /api will be proxied to the backend.
  // In a production build, this might be handled differently (e.g., by the web server).
  // We use VITE_API_URL to decide if we are in a dev environment where the proxy is active.
  if (import.meta.env.VITE_API_URL) {
    return "/api";
  }
  // Fallback for scenarios where Vite proxy is not active or VITE_API_URL is not set
  return `http://${window.location.hostname}:5000`;
};

const getFrontendUrl = () => {
  if (import.meta.env.VITE_FRONTEND_URL)
    return import.meta.env.VITE_FRONTEND_URL;
  return `http://${window.location.hostname}:5173`;
};

export const API_URL = getApiUrl();
export const FRONTEND_URL = getFrontendUrl();
