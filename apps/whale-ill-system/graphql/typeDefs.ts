export const baseTypeDefs = /* GraphQL */ `
  scalar JSON

  enum WhaleWalletLabelType {
    exchange
    team
    treasury
    vesting
    lp
    staking
    bridge
    burn
    smart_money
    unknown
  }

  enum WhaleSignalType {
    accumulation
    distribution
    exchange_inflow_spike
    exchange_outflow_spike
    concentration_risk
    unlock_risk
  }

  enum WhaleSignalState {
    accumulation
    neutral
    distribution
  }

  type WhaleToken {
    id: ID!
    chain: String!
    token_address: String!
    symbol: String!
    name: String!
    decimals: Int!
    total_supply: Float
    circulating_supply: Float
    created_at: String!
    updated_at: String!
  }

  type WhaleWalletLabel {
    id: ID!
    chain: String!
    wallet_address: String!
    label_type: WhaleWalletLabelType!
    label_name: String
    confidence_score: Float
    source: String
    created_at: String!
    updated_at: String!
  }

  type SmartMoneyWallet {
    id: ID!
    chain: String!
    wallet_address: String!
    strategy_tag: String
    win_rate: Float
    avg_return_30d: Float
    risk_score: Float
    confidence_score: Float
    is_active: Boolean!
    source: String
    created_at: String!
    updated_at: String!
  }

  type WhaleHolderSnapshot {
    id: ID!
    token_id: ID!
    chain: String!
    wallet_address: String!
    balance: Float!
    pct_supply: Float!
    snapshot_at: String!
    created_at: String!
    label: WhaleWalletLabel
  }

  type WhaleTransfer {
    id: ID!
    token_id: ID!
    chain: String!
    tx_hash: String!
    log_index: Int!
    block_number: Float!
    block_time: String!
    from_address: String!
    to_address: String!
    amount_raw: String
    amount_decimal: Float
    usd_value: Float
    from_label_type: WhaleWalletLabelType
    to_label_type: WhaleWalletLabelType
    is_exchange_in: Boolean!
    is_exchange_out: Boolean!
    is_internal_like: Boolean!
    created_at: String!
  }

  type WhaleExchangeFlow {
    token_id: ID!
    stat_date: String!
    exchange_inflow: Float!
    exchange_outflow: Float!
    netflow: Float!
  }

  type WhaleHolderChangePoint {
    token_id: ID!
    stat_date: String!
    holder_count: Int!
    whale_holder_count: Int!
  }

  type WhaleConcentration {
    token_id: ID!
    snapshot_at: String!
    top10: Float!
    top20: Float!
    top50: Float!
  }

  type WhaleSignal {
    id: ID!
    token_id: ID!
    signal_type: WhaleSignalType!
    signal_score: Float!
    signal_reason: String
    signal_date: String!
    metadata_json: JSON
    created_at: String!
  }

  type WhaleUnlockEvent {
    id: ID!
    token_id: ID!
    unlock_date: String!
    amount: Float!
    pct_supply: Float
    source: String
    note: String
    created_at: String!
    updated_at: String!
  }

  type WhaleAccumulationSummary {
    token: WhaleToken!
    whaleNetflow1d: Float!
    whaleNetflow7d: Float!
    exchangeNetflow1d: Float!
    exchangeNetflow7d: Float!
    holderGrowth7d: Int!
    whaleHolderGrowth7d: Int!
    top10Concentration: Float!
    top20Concentration: Float!
    signalState: WhaleSignalState!
    explanation: String!
  }

  input WhaleTransferFilterInput {
    isExchangeIn: Boolean
    isExchangeOut: Boolean
    isInternalLike: Boolean
    minUsdValue: Float
    fromLabelTypes: [WhaleWalletLabelType!]
    toLabelTypes: [WhaleWalletLabelType!]
  }

  input UpsertWhaleTokenInput {
    id: ID
    chain: String!
    token_address: String!
    symbol: String!
    name: String!
    decimals: Int!
    total_supply: Float
    circulating_supply: Float
  }

  input UpsertWhaleWalletLabelInput {
    id: ID
    chain: String!
    wallet_address: String!
    label_type: WhaleWalletLabelType!
    label_name: String
    confidence_score: Float
    source: String
  }

  input UpsertSmartMoneyWalletInput {
    id: ID
    chain: String!
    wallet_address: String!
    strategy_tag: String
    win_rate: Float
    avg_return_30d: Float
    risk_score: Float
    confidence_score: Float
    is_active: Boolean = true
    source: String
    label_name: String
  }

  input InsertWhaleHolderSnapshotInput {
    token_id: ID!
    chain: String!
    wallet_address: String!
    balance: Float!
    pct_supply: Float!
    snapshot_at: String!
  }

  input InsertWhaleTransferInput {
    token_id: ID!
    chain: String!
    tx_hash: String!
    log_index: Int!
    block_number: Float!
    block_time: String!
    from_address: String!
    to_address: String!
    amount_raw: String
    amount_decimal: Float
    usd_value: Float
    from_label_type: WhaleWalletLabelType
    to_label_type: WhaleWalletLabelType
    is_exchange_in: Boolean
    is_exchange_out: Boolean
    is_internal_like: Boolean
  }

  input UpsertWhaleUnlockEventInput {
    id: ID
    token_id: ID!
    unlock_date: String!
    amount: Float!
    pct_supply: Float
    source: String
    note: String
  }

  type WhaleRecomputeResult {
    token_id: ID!
    date: String!
    signals_written: Int!
    stats_updated: Boolean!
  }

  type Query {
    _whaleHealth: String
  }

  type Mutation {
    _whaleMutationHealth: String
  }
`;
