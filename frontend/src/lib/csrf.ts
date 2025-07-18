  import { apiFetch } from './api';

  // Get CSRF token from cookie (returns string, never a Promise)
  export function getCsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  // Wrapper for apiFetch that injects CSRF token into headers
  export async function fetchWithCSRF(
    endpoint: string,
    options: RequestInit = {},
    csrfToken?: string
  ) {
    return apiFetch(endpoint, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        'X-CSRFToken': csrfToken || '',
        'Content-Type': 'application/json',
      },
    });
  }

  // Async CSRF token getter for use in pages (returns Promise<string>)
  export async function getCSRFToken(): Promise<string> {
    // Always fetch from backend
    const response = await apiFetch('csrf_token/', {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch CSRF token');
    const data = await response.json();
    return data.csrfToken;
  } 