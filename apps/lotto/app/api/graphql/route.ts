// Standalone GraphQL API for lotto (no proxy)
// Pattern copied from apps/web, using lotto's own schema/resolvers/db
import { ApolloServer } from "@apollo/server";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { NextRequest } from "next/server";
import { typeDefs } from "../../../graphql/typeDefs";
import { resolvers } from "../../../graphql/resolvers";
import { lottoEnhancementsTypeDefs } from "../../../graphql/typeDefs.enhancements";
import { 
  lottoEnhancementQueries, 
  lottoEnhancementMutations 
} from "../../../graphql/resolvers.enhancements";

export const runtime = "nodejs";

// Merge typeDefs
const mergedTypeDefs = [typeDefs, lottoEnhancementsTypeDefs];

// Merge resolvers
const mergedResolvers = {
  Query: {
    ...resolvers.Query,
    ...lottoEnhancementQueries
  },
  Mutation: {
    ...resolvers.Mutation,
    ...lottoEnhancementMutations
  }
};

const schema = makeExecutableSchema({ typeDefs: mergedTypeDefs, resolvers: mergedResolvers });
const server = new ApolloServer({
  schema,
  introspection: process.env.NODE_ENV !== "production",
  csrfPrevention: false,
});

const handler = startServerAndCreateNextHandler<NextRequest>(server, {
  context: async (req) => ({
    req: {
      headers: req.headers,
      cookies: Object.fromEntries(
        req.headers.get('cookie')?.split('; ').map(c => c.split('=')) || []
      )
    }
  })
});

export { handler as GET, handler as POST };