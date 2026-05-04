


import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from "@apollo/client";





const httpLink = new HttpLink({ uri: "/api/graphql" });

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
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
