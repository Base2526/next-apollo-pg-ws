import { Pool } from "pg";

export const lottoDbPool = new Pool({
  connectionString: process.env.LOTTO_DATABASE_URL,
});

export async function queryLottoDb(text: string, params?: any[]): Promise<any[]> {
  const res = await lottoDbPool.query(text, params);
  return res.rows;
}
