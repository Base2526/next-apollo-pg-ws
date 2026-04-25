import GraphQLJSON from "graphql-type-json";
import { tokenResolvers } from "./tokens";
import { holderResolvers } from "./holders";
import { transferResolvers } from "./transfers";
import { exchangeFlowResolvers } from "./exchangeFlow";
import { signalResolvers } from "./signals";
import { labelResolvers } from "./labels";
import { analyticsResolvers } from "./analytics";

function mergeResolvers(base: any, extra: any) {
  return {
    ...base,
    ...extra,
    Query: {
      ...(base?.Query || {}),
      ...(extra?.Query || {}),
    },
    Mutation: {
      ...(base?.Mutation || {}),
      ...(extra?.Mutation || {}),
    },
  };
}

let merged = {
  JSON: GraphQLJSON,
  Query: {
    _whaleHealth: () => "ok",
  },
  Mutation: {
    _whaleMutationHealth: () => "ok",
  },
};

for (const resolver of [
  tokenResolvers,
  holderResolvers,
  transferResolvers,
  exchangeFlowResolvers,
  signalResolvers,
  labelResolvers,
  analyticsResolvers,
]) {
  merged = mergeResolvers(merged, resolver);
}

export const mergedResolvers = merged;
