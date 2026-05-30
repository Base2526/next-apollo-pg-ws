/**
 * Authentication utilities for JWT token management and validation
 */

interface JwtPayload {
  exp?: number;
  iat?: number;
  userId?: string;
  scope?: string;
  [key: string]: any;
}

/**
 * Decode JWT token without verification (client-side only)
 */
export function decodeJwt(token: string): JwtPayload | null {
  if (!token) return null;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch (error) {
    console.error('[decodeJwt] Error:', error);
    return null;
  }
}

/**
 * Check if JWT token is expired
 */
export function isJwtExpired(token: string): boolean {
  if (!token) return true;
  
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.exp) return true;
  
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp < now;
}

/**
 * Get authentication token from storage
 * - localStorage: auth_token (user)
 * - cookie: token (admin) or auth_token (user)
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Try localStorage first (user token)
  const localToken = localStorage.getItem('auth_token');
  if (localToken) return localToken;
  
  // Try cookies (admin token or user token)
  const cookies = document.cookie.split('; ');
  
  // Check for admin token
  const adminTokenCookie = cookies.find(c => c.startsWith('token='));
  if (adminTokenCookie) {
    return adminTokenCookie.split('=')[1];
  }
  
  // Check for user token in cookie
  const userTokenCookie = cookies.find(c => c.startsWith('auth_token='));
  if (userTokenCookie) {
    return userTokenCookie.split('=')[1];
  }
  
  return null;
}

/**
 * Check if current path is admin path
 */
export function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin');
}

/**
 * Check if current path is auth page (login/forgot-password)
 */
export function isAuthPage(pathname: string): boolean {
  const authPaths = ['/login', '/forgot-password', '/admin/login', '/admin/forgot-password'];
  return authPaths.some(path => pathname.startsWith(path));
}

/**
 * Get correct login path based on current pathname
 */
export function getLoginPath(pathname: string): string {
  return isAdminPath(pathname) ? '/admin/login' : '/login';
}

/**
 * Clear all authentication data
 */
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  
  // Clear localStorage
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  localStorage.removeItem('token');
  localStorage.removeItem('lotto_admin_token');
  
  // Clear cookies
  document.cookie = 'auth_token=; Max-Age=0; path=/;';
  document.cookie = 'token=; Max-Age=0; path=/;';
}

/**
 * Force logout and redirect to correct login page
 */
export function forceLogout(pathname?: string): void {
  const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '/');
  
  // Don't redirect if already on auth page
  if (isAuthPage(currentPath)) {
    return;
  }
  
  clearAuth();
  
  const loginPath = getLoginPath(currentPath);
  const redirectUrl = new URL(loginPath, window.location.origin);
  
  // Preserve return path for non-auth pages
  if (!isAuthPage(currentPath) && currentPath !== '/') {
    redirectUrl.searchParams.set('redirect', currentPath);
  }
  
  window.location.href = redirectUrl.toString();
}

/**
 * Check token validity on app load
 */
export function checkTokenOnLoad(): boolean {
  if (typeof window === 'undefined') return false;
  
  const token = getAuthToken();
  if (!token) return false;
  
  if (isJwtExpired(token)) {
    console.warn('[Auth] Token expired on load, forcing logout');
    forceLogout(window.location.pathname);
    return false;
  }
  
  return true;
}
