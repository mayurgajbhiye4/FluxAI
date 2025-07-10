import { apiFetch } from './api';

// Get CSRF token from cookie (returns string, never a Promise)
export function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
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

// Async CSRF token getter for use in pages (returns Promise<string>)
export async function getCSRFToken(): Promise<string> {
  // Try cookie first
  const name = 'csrftoken';
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  if (cookieValue) return cookieValue;

  // Fallback: fetch from backend
  const response = await apiFetch('csrf_token/', {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch CSRF token');
  const data = await response.json();
  return data.csrfToken;
} 