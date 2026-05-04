import { NextResponse } from "next/server";
import { queryLottoDb } from "../../../lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "all";
  let where = "";
  let params: any[] = [];

  if (status === "pending") {
    where = "WHERE result_status = $1";
    params = ["pending"];
  } else if (status === "completed") {
    where = "WHERE result_status IN ($1, $2)";
    params = ["win", "lose"];
  }

  const sql = `
    SELECT * FROM lotto_orders
    ${where}
    ORDER BY created_at DESC
  `;

  const orders = await queryLottoDb(sql, params);
  return NextResponse.json({ orders });
}
