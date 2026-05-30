import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/admin/login", "/admin/forgot-password", "/_next", "/favicon.ico", "/api/graphql"];

/**
 * Simple JWT expiration check (decode payload and check exp)
 */
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (!payload.exp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (error) {
    return true;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  
  // Allow homepage without auth
  if (pathname === '/') {
    return NextResponse.next();
  }
  
  // Determine if admin or user path
  const isAdminPath = pathname.startsWith('/admin');
  
  // Get appropriate token
  let token: string | undefined;
  if (isAdminPath) {
    // Admin uses 'token' cookie
    token = request.cookies.get("token")?.value;
  } else {
    // User uses 'auth_token' cookie or localStorage (can't read localStorage in middleware)
    token = request.cookies.get("auth_token")?.value;
  }
  
  // Check if token exists and is not expired
  if (!token || isTokenExpired(token)) {
    const loginPath = isAdminPath ? '/admin/login' : '/login';
    const loginUrl = new URL(loginPath, request.url);
    
    // Preserve redirect path for non-auth pages
    if (pathname !== '/' && !PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
      loginUrl.searchParams.set('redirect', pathname);
    }
    
    return NextResponse.redirect(loginUrl);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api/graphql).*)"],
};
