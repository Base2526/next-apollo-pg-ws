export type WhaleTokenRow = {
  id: string;
  chain: string;
  token_address: string;
  symbol: string;
  name: string;
  decimals: number;
  total_supply: number | null;
};

export type ScanContext = {
  scanId: string;
  startedAt: string;
};
