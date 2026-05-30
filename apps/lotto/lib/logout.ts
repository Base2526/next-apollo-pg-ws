import { clearAuth, getLoginPath } from './auth-utils';

export function logout() {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  
  // Clear all auth data
  clearAuth();
  
  // Redirect to correct login page
  const loginPath = getLoginPath(currentPath);
  window.location.href = loginPath;
}
