/**
 * Refund Service
 * Handles automatic and manual refunds for expired pending orders
 */

import { queryLottoDb } from '../lib/db';

interface RefundResult {
  orderId: number;
  orderCode: string;
  userId: string;
  drawId: number;
  categoryCode: string;
  closeAt: Date;
  amount: number;
  oldStatus: string;
  newStatus: string;
  success: boolean;
  error?: string;
}

interface RefundSummary {
  totalProcessed: number;
  totalRefunded: number;
  totalAmount: number;
  results: RefundResult[];
  errors: string[];
}

/**
 * Refund a single order
 * @param orderId - Order ID to refund
 * @param reason - Reason for refund
 * @param adminUserId - Optional admin user ID who initiated the refund
 * @returns RefundResult
 */
export async function refundOrder(
  orderId: number,
  reason: string,
  adminUserId?: string
): Promise<RefundResult> {
  const now = new Date();

  try {
    // Step 1: Lock order first (no joins to avoid FOR UPDATE error)
    const orders = await queryLottoDb(
      `SELECT 
        id,
        order_no,
        user_id,
        draw_id,
        category_code,
        total_amount,
        status,
        result_status
      FROM lotto_orders
      WHERE id = $1
      FOR UPDATE`,
      [orderId]
    );

    if (!orders || orders.length === 0) {
      throw new Error(`Order ${orderId} not found`);
    }

    const order = orders[0];

    // Step 2: Get draw info separately (no lock needed)
    const draws = await queryLottoDb(
      `SELECT code, close_at
       FROM lotto_draws
       WHERE id = $1`,
      [order.draw_id]
    );
    const draw = draws && draws.length > 0 ? draws[0] : null;

    // Step 3: Lock user and get credit
    const users = await queryLottoDb(
      `SELECT id, credit
       FROM lotto_users
       WHERE id = $1
       FOR UPDATE`,
      [order.user_id]
    );

    if (!users || users.length === 0) {
      throw new Error(`User ${order.user_id} not found`);
    }

    const user = users[0];

    // Validate order can be refunded
    if (order.status === 'refunded') {
      throw new Error(`Order ${order.order_no} is already refunded`);
    }

    if (order.status === 'approved') {
      throw new Error(`Order ${order.order_no} is already approved and cannot be refunded`);
    }

    const amount = parseFloat(order.total_amount || 0);
    const userCredit = parseFloat(user.credit || 0);
    const balanceBefore = userCredit;
    const balanceAfter = userCredit + amount;

    // Debug log with parameter types
    console.log('[ADMIN_REFUND_ORDER_DEBUG]', {
      orderId: order.id,
      orderIdType: typeof order.id,
      orderCode: order.order_no,
      userId: order.user_id,
      userIdType: typeof order.user_id,
      drawId: order.draw_id,
      statusBefore: order.status,
      resultStatusBefore: order.result_status,
      closeAt: draw?.close_at,
      now,
      nowType: typeof now,
      refundAmount: amount,
      amountType: typeof amount,
      reason,
      reasonType: typeof reason,
      adminUserId,
      adminUserIdType: typeof adminUserId,
    });

    // Update order status - EXPLICIT parameter order
    await queryLottoDb(
      `UPDATE lotto_orders 
       SET status = $1::varchar,
           result_status = $2::varchar,
           refunded_at = $3::timestamptz,
           refund_reason = $4::text,
           updated_at = $5::timestamptz
       WHERE id = $6::integer`,
      ['refunded', 'refunded', now, reason, now, orderId]
    );

    // Update user credit - EXPLICIT casts
    await queryLottoDb(
      `UPDATE lotto_users 
       SET credit = credit + $1::numeric,
           updated_at = $2::timestamptz
       WHERE id = $3::uuid`,
      [amount, now, order.user_id]
    );

    // Create credit transaction - EXPLICIT casts for all parameters
    await queryLottoDb(
      `INSERT INTO lotto_credit_transactions 
       (user_id, type, amount, direction, balance_before, balance_after, ref_type, ref_id, status, note, created_by, created_at)
       VALUES ($1::uuid, $2::varchar, $3::numeric, $4::varchar, $5::numeric, $6::numeric, $7::varchar, $8::integer, $9::varchar, $10::text, $11::uuid, $12::timestamptz)`,
      [
        order.user_id,
        'BET_REFUND',
        amount,
        'IN',
        balanceBefore,
        balanceAfter,
        'ORDER',
        orderId,
        'COMPLETED',
        `คืนเงินโพยหมดเวลาแต่ยังไม่ได้รับโพย: ${reason}`,
        adminUserId || null,
        now,
      ]
    );

    console.log(`[REFUND_SUCCESS] Order ${order.order_no} refunded: ${amount} ฿ → user ${order.user_id}`);

    return {
      orderId: order.id,
      orderCode: order.order_no,
      userId: order.user_id,
      drawId: order.draw_id,
      categoryCode: order.category_code,
      closeAt: draw?.close_at || now,
      amount,
      oldStatus: order.status,
      newStatus: 'refunded',
      success: true,
    };
  } catch (error: any) {
    console.error(`[REFUND_ERROR] Order ${orderId}:`, error.message);
    
    return {
      orderId,
      orderCode: '',
      userId: '',
      drawId: 0,
      categoryCode: '',
      closeAt: now,
      amount: 0,
      oldStatus: '',
      newStatus: '',
      success: false,
      error: error.message,
    };
  }
}

/**
 * Find and refund all expired pending orders
 * @returns RefundSummary
 */
export async function refundExpiredPendingOrders(): Promise<RefundSummary> {
  const now = new Date();
  
  console.log('[REFUND_EXPIRED_PENDING_ORDERS] Starting scan...', { now });

  const summary: RefundSummary = {
    totalProcessed: 0,
    totalRefunded: 0,
    totalAmount: 0,
    results: [],
    errors: [],
  };

  try {
    // Find all orders with:
    // - status = 'pending_confirm' (not yet approved)
    // - draw.close_at < NOW() (draw betting window closed)
    const expiredOrders = await queryLottoDb(
      `SELECT 
        o.id,
        o.order_no,
        o.user_id,
        o.draw_id,
        o.category_code,
        o.total_amount,
        o.status,
        o.result_status,
        o.created_at,
        d.code as draw_code,
        d.close_at,
        d.round_no,
        d.draw_date,
        c.name_th as category_name
      FROM lotto_orders o
      INNER JOIN lotto_draws d ON d.id = o.draw_id
      LEFT JOIN lotto_categories c ON c.code = o.category_code
      WHERE o.status = 'pending_confirm'
        AND d.close_at < $1
      ORDER BY d.close_at ASC, o.created_at ASC`,
      [now]
    );

    console.log(`[REFUND_EXPIRED_PENDING_ORDERS] Found ${expiredOrders.length} expired orders`);

    summary.totalProcessed = expiredOrders.length;

    // Process each order
    for (const order of expiredOrders) {
      const reason = `งวด/รอบปิดรับแล้วแต่ยังไม่ได้รับโพย (ปิดรับ: ${order.close_at})`;
      
      const result = await refundOrder(order.id, reason);
      
      summary.results.push(result);

      if (result.success) {
        summary.totalRefunded++;
        summary.totalAmount += result.amount;
      } else {
        summary.errors.push(`Order ${order.order_no}: ${result.error}`);
      }
    }

    console.log('[REFUND_EXPIRED_PENDING_ORDERS] Completed', {
      totalProcessed: summary.totalProcessed,
      totalRefunded: summary.totalRefunded,
      totalAmount: summary.totalAmount,
      errors: summary.errors.length,
    });

    return summary;
  } catch (error: any) {
    console.error('[REFUND_EXPIRED_PENDING_ORDERS] Fatal error:', error.message);
    summary.errors.push(`Fatal error: ${error.message}`);
    return summary;
  }
}

/**
 * Schedule automatic refund job (call this from a cron or scheduler)
 */
export async function scheduleAutoRefund() {
  console.log('[AUTO_REFUND_JOB] Starting...');
  
  try {
    const summary = await refundExpiredPendingOrders();
    
    if (summary.totalRefunded > 0) {
      console.log(`[AUTO_REFUND_JOB] Successfully refunded ${summary.totalRefunded} orders, total: ${summary.totalAmount} ฿`);
    } else {
      console.log('[AUTO_REFUND_JOB] No expired orders to refund');
    }

    if (summary.errors.length > 0) {
      console.warn('[AUTO_REFUND_JOB] Errors encountered:', summary.errors);
    }

    return summary;
  } catch (error: any) {
    console.error('[AUTO_REFUND_JOB] Failed:', error.message);
    throw error;
  }
}
