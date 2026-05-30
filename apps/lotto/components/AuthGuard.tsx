"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { checkTokenOnLoad, isAuthPage } from '../lib/auth-utils';

/**
 * Global auth guard component
 * Checks token validity on first load and redirects if expired
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  useEffect(() => {
    // Skip check for auth pages
    if (isAuthPage(pathname)) {
      return;
    }
    
    // Skip check for homepage (public)
    if (pathname === '/') {
      return;
    }
    
    // Check token validity on mount
    checkTokenOnLoad();
  }, [pathname]);
  
  return <>{children}</>;
}
