import { createClient } from 'graphql-ws';

export const lottoWsClient = typeof window !== "undefined"
  ? createClient({
      url: process.env.NEXT_PUBLIC_LOTTO_GRAPHQL_WS || process.env.LOTTO_GRAPHQL_WS || "ws://localhost:3002/graphql",
    })
  : null;
