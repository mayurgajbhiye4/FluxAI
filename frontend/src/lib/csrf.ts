import { apiFetch } from './api';

// Get CSRF token from cookie (returns string, never a Promise)
export function getCsrfToken(): string {
  return (
    document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1] || ''
  );
}

// Wrapper for apiFetch that injects CSRF token into headers
export async function fetchWithCSRF(
  endpoint: string,
  options: RequestInit = {}
) {
  return apiFetch(endpoint, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      'X-CSRFToken': getCsrfToken(),
      'Content-Type': 'application/json',
    },
  });
} 