import { NextResponse } from "next/server";
import { queryLottoDb } from "../../../lib/db";

// GET /api/slips?status=all|pending|resulted
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "all";
    let where = [];
    let params: any[] = [];
    if (status === "pending") {
      where.push("(d.result_status IS NULL OR d.result_status != 'resulted')");
    } else if (status === "resulted") {
      where.push("d.result_status = 'resulted'");
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // Main query: orders + draw info
    const orders = await queryLottoDb(
      `SELECT o.*, d.draw_date, d.status as draw_status, d.result_status as draw_result_status, d.resulted_at
       FROM lotto_orders o
       LEFT JOIN lotto_draws d ON o.draw_id = d.id
       ${whereClause}
       ORDER BY o.created_at DESC`,
      params
    );
    // Attach items
    for (const order of orders) {
      order.items = await queryLottoDb(
        `SELECT * FROM lotto_order_items WHERE order_id = $1`,
        [order.id]
      );
    }
    // Summary
    const summaryRows = await queryLottoDb(
      `SELECT
        COALESCE(SUM(o.total_amount),0) as total_amount,
        COUNT(o.id) as total_count,
        SUM(CASE WHEN d.result_status IS NULL OR d.result_status != 'resulted' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN d.result_status = 'resulted' THEN 1 ELSE 0 END) as resulted_count
      FROM lotto_orders o LEFT JOIN lotto_draws d ON o.draw_id = d.id`,
      []
    );
    const summary = summaryRows[0] || {};
    return NextResponse.json({
      summary: {
        totalAmount: Number(summary.total_amount || 0),
        totalCount: Number(summary.total_count || 0),
        pendingCount: Number(summary.pending_count || 0),
        resultedCount: Number(summary.resulted_count || 0),
      },
      slips: orders.map(o => ({
        id: o.id,
        orderNo: o.order_no || o.id,
        drawDate: o.draw_date,
        drawStatus: o.draw_status,
        resultStatus: o.result_status,
        totalAmount: o.total_amount,
        createdAt: o.created_at,
        status: o.status,
        items: (o.items || []).map((item: any) => ({
          betTypeCode: item.bet_type_code,
          betTypeName: item.bet_type_name,
          number: item.number,
          price: item.price,
          payoutRate: item.payout_rate,
          possibleWin: item.possible_win,
          generatedFrom: item.generated_from
        }))
      }))
    });
  } catch (e) {
    return NextResponse.json({ error: true }, { status: 500 });
  }
}
