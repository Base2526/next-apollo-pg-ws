export const runtime = "nodejs";

import { ApolloServer } from "@apollo/server";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { NextRequest } from "next/server";

import { mergedResolvers, mergedTypeDefs } from "../../../graphql";
import { ensureWhaleSchema } from "../../../lib/db";

type Context = {
  req: NextRequest;
  isAdmin: boolean;
};

const schema = makeExecutableSchema({
  typeDefs: mergedTypeDefs,
  resolvers: mergedResolvers,
});

const server = new ApolloServer({
  schema,
  introspection: process.env.NODE_ENV !== "production",
  csrfPrevention: false,
});

let initPromise: Promise<void> | null = null;

function ensureInit() {
  if (!initPromise) {
    initPromise = ensureWhaleSchema().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

async function createContext(req: NextRequest): Promise<Context> {
  const adminToken = process.env.WHALE_ADMIN_TOKEN || "";
  const provided =
    req.headers.get("x-whale-admin-token") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  return {
    req,
    isAdmin: Boolean(adminToken) && provided === adminToken,
  };
}

const handler = startServerAndCreateNextHandler<NextRequest>(server, {
  context: async (req) => {
    await ensureInit();
    return createContext(req);
  },
});

export { handler as GET, handler as POST, handler as OPTIONS };
