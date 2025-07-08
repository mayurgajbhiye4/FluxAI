const API_BASE_URL = import.meta.env.VITE_API_URL;

export function apiFetch(endpoint: string, options?: RequestInit) {
  // Ensure no double slashes when joining base URL and endpoint
  const url = `${API_BASE_URL?.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  return fetch(url, options);
} 