import { NextResponse } from "next/server";
import { queryLottoDb } from "../../../lib/db";

export async function GET() {
  const sql = `
    SELECT
      SUM(total_amount) as total_amount,
      COUNT(*) FILTER (WHERE result_status = 'pending') as pending_count,
      SUM(total_win) FILTER (WHERE result_status = 'win') as win_total,
      SUM(total_win) FILTER (WHERE result_status = 'lose') as lose_total
    FROM lotto_orders
  `;
  const [summary] = await queryLottoDb(sql);
  return NextResponse.json(summary);
}
