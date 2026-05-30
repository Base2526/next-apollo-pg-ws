


import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { forceLogout } from "./auth-utils";





const httpLink = new HttpLink({ uri: "/api/graphql" });

// Error handling link for token expiration
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      const message = err.message || '';
      const extensions = err.extensions || {};
      const code = extensions.code;
      
      // Check for token expiration indicators
      const isTokenExpired = 
        code === 'UNAUTHENTICATED' ||
        message.includes('jwt expired') ||
        message.includes('TokenExpiredError') ||
        message.includes('Invalid token') ||
        message.includes('[Auth] Invalid token');
      
      if (isTokenExpired) {
        console.error('[Apollo] Token expired or invalid:', message);
        
        // Prevent multiple redirects
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          
          // Don't redirect if already on login page
          if (!currentPath.includes('/login') && !currentPath.includes('/forgot-password')) {
            forceLogout(currentPath);
          }
        }
        break;
      }
    }
  }
  
  if (networkError) {
    const netError = networkError as any;
    // Check for 401 Unauthorized
    if (netError.statusCode === 401) {
      console.error('[Apollo] 401 Unauthorized, forcing logout');
      
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/login') && !currentPath.includes('/forgot-password')) {
          forceLogout(currentPath);
        }
      }
    }
  }
});

const authLink = new ApolloLink((operation, forward) => {
  let token = "";
  if (typeof window !== "undefined") {
    // Try localStorage first (user token)
    token = localStorage.getItem("auth_token") || "";
    
    // If no token in localStorage, try cookies (admin token)
    if (!token) {
      const cookies = document.cookie.split('; ');
      const tokenCookie = cookies.find(c => c.startsWith('token='));
      if (tokenCookie) {
        token = tokenCookie.split('=')[1];
      }
    }
  } else if (typeof document === "undefined") {
    // On server, try to read from cookies if needed (not implemented here)
    token = "";
  }
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }));
  return forward(operation);
});

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log("[Lotto GraphQL HTTP] /api/graphql");
}


export const apolloClient = new ApolloClient({
  link: ApolloLink.from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
});
