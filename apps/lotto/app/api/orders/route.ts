
import { NextResponse } from "next/server";
import { queryLottoDb } from "../../../lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") || "all";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "20", 10)));
    const search = url.searchParams.get("search") || "";
    const drawId = url.searchParams.get("drawId") || "";
    const status = url.searchParams.get("status") || "";

    let where = [];
    let params = [];
    // Filtering logic for tabs
    if (tab === "pending") {
      where.push("(o.result_status = 'pending' OR d.status != 'resulted')");
    } else if (tab === "resulted") {
      where.push("(o.result_status IN ('resulted','won','lost') OR d.status = 'resulted')");
    }
    if (search) { where.push(`o.order_no ILIKE $${params.length + 1}`); params.push(`%${search}%`); }
    if (drawId) { where.push(`o.draw_id = $${params.length + 1}`); params.push(drawId); }
    if (status) { where.push(`o.status = $${params.length + 1}`); params.push(status); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Count total for pagination
    const countRows = await queryLottoDb(
      `SELECT COUNT(*) FROM lotto_orders o LEFT JOIN lotto_draws d ON o.draw_id = d.id ${whereClause}`,
      params
    );
    const total = parseInt(countRows[0]?.count || "0", 10);
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Main query with summary fields
    const orders = await queryLottoDb(
      `SELECT o.*, d.draw_date, d.status as draw_status FROM lotto_orders o LEFT JOIN lotto_draws d ON o.draw_id = d.id ${whereClause} ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
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
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.result_status = 'pending' OR d.status != 'resulted' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN o.result_status = 'pending' OR d.status != 'resulted' THEN o.total_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN o.result_status IN ('resulted','won','lost') OR d.status = 'resulted' THEN 1 ELSE 0 END) as resulted_count,
        SUM(CASE WHEN o.result_status IN ('resulted','won','lost') OR d.status = 'resulted' THEN o.total_amount ELSE 0 END) as resulted_amount,
        SUM(COALESCE(o.win_amount,0)) as win_amount
      FROM lotto_orders o LEFT JOIN lotto_draws d ON o.draw_id = d.id ${whereClause}`,
      params
    );
    const summary = summaryRows[0] || {};

    return NextResponse.json({
      summary: {
        totalAmount: Number(summary.total_amount || 0),
        totalOrders: Number(summary.total_orders || 0),
        pendingCount: Number(summary.pending_count || 0),
        resultedCount: Number(summary.resulted_count || 0),
        pendingAmount: Number(summary.pending_amount || 0),
        resultedAmount: Number(summary.resulted_amount || 0),
        winAmount: Number(summary.win_amount || 0),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      orders: orders.map(o => ({
        id: o.id,
        orderNo: o.order_no,
        drawId: o.draw_id,
        drawDate: o.draw_date,
        drawStatus: o.draw_status,
        status: o.status,
        resultStatus: o.result_status,
        totalAmount: o.total_amount,
        winAmount: o.win_amount,
        createdAt: o.created_at,
        checkedAt: o.checked_at,
        items: (o.items || []).map((item: any) => ({
          id: item.id,
          betTypeCode: item.bet_type_code,
          betTypeName: item.bet_type_name,
          number: item.number,
          price: item.price,
          payoutRate: item.payout_rate,
          possibleWin: item.possible_win,
          resultStatus: item.result_status,
          winAmount: item.win_amount,
          matchedResult: item.matched_result,
          generatedFrom: item.generated_from
        }))
      }))
    });
  } catch (e) {
    return NextResponse.json({ error: true }, { status: 500 });
  }
}
