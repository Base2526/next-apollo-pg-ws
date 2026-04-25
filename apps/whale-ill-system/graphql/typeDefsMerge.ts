import { baseTypeDefs } from "./typeDefs";
import { tokenTypeDefs } from "./tokens";
import { holderTypeDefs } from "./holders";
import { transferTypeDefs } from "./transfers";
import { exchangeFlowTypeDefs } from "./exchangeFlow";
import { signalTypeDefs } from "./signals";
import { labelTypeDefs } from "./labels";
import { analyticsTypeDefs } from "./analytics";

export const mergedTypeDefs = [
  baseTypeDefs,
  tokenTypeDefs,
  holderTypeDefs,
  transferTypeDefs,
  exchangeFlowTypeDefs,
  signalTypeDefs,
  labelTypeDefs,
  analyticsTypeDefs,
];
