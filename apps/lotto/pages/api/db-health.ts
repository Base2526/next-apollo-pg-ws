import { NextApiRequest, NextApiResponse } from "next";
import { lottoDbPool } from "../../lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await lottoDbPool.query("SELECT 1");
    res.status(200).json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
