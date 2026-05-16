/**
 * GraphQL Resolvers for Lotto System Enhancements
 * Features: Draw Generator, Result Management, Winner Calculation, Reports
 */

import { queryLottoDb } from "../lib/db";

// ============================================
// HELPER: Require Admin Auth
// ============================================
function requireAdmin(context: any) {
  const { req } = context;
  const token = req?.headers?.authorization?.replace('Bearer ', '') || req?.cookies?.token;
  if (!token) throw new Error('Unauthorized: Admin access required');
  
  const jwt = require('jsonwebtoken');
  const decoded = jwt.verify(token, process.env.LOTTO_JWT_SECRET || 'changeme');
  if (!decoded || decoded.role !== 'admin') {
    throw new Error('Forbidden: Admin role required');
  }
  return decoded;
}

// ============================================
// QUERIES
// ============================================

export const lottoEnhancementQueries = {
  /**
   * Get draws with result info for admin management
   */
  async adminDraws(
    _parent: any,
    args: { filter?: any; pagination?: any },
    context: any
  ) {
    requireAdmin(context);
    
    const { filter = {}, pagination = {} } = args;
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;
    
    console.log('[YEEKEE_ADMIN_DRAWS] Filter:', filter);
    
    // Build WHERE clause
    let whereConditions: string[] = ['d.is_active = true'];
    const params: any[] = [];
    let paramIndex = 1;
    
    if (filter.categoryCode) {
      whereConditions.push(`lc.code = $${paramIndex}`);
      params.push(filter.categoryCode);
      paramIndex++;
    }
    
    if (filter.dateFrom) {
      whereConditions.push(`d.draw_date >= $${paramIndex}`);
      params.push(filter.dateFrom);
      paramIndex++;
    }
    
    if (filter.dateTo) {
      whereConditions.push(`d.draw_date <= $${paramIndex}`);
      params.push(filter.dateTo);
      paramIndex++;
    }
    
    if (filter.resultStatus) {
      whereConditions.push(`d.result_status = $${paramIndex}`);
      params.push(filter.resultStatus);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM lotto_draws d
      LEFT JOIN lotto_categories lc ON d.category_id = lc.id
      ${whereClause}
    `;
    const countResult = await queryLottoDb(countQuery, params);
    const total = parseInt(countResult[0]?.total || '0');
    
    // Fetch items with summary
    params.push(pageSize);
    params.push(offset);
    
    const itemsQuery = `
      SELECT 
        d.id,
        d.code,
        d.draw_date,
        d.round_no,
        d.name_th,
        d.open_at,
        d.close_at,
        d.status,
        d.result_status,
        d.result_number,
        lc.code as category_code,
        lc.name_th as category_name,
        COUNT(DISTINCT o.id) FILTER (WHERE o.status IN ('approved', 'confirmed')) as total_orders,
        COALESCE(SUM(oi.price) FILTER (WHERE o.status IN ('approved', 'confirmed')), 0) as total_sales,
        COUNT(CASE WHEN oi.is_winner = true AND o.status IN ('approved', 'confirmed') THEN 1 END) as total_winners,
        COALESCE(SUM(CASE WHEN oi.is_winner = true AND o.status IN ('approved', 'confirmed') THEN oi.win_amount ELSE 0 END), 0) as total_payout,
        COALESCE(SUM(oi.price) FILTER (WHERE o.status IN ('approved', 'confirmed')), 0) - COALESCE(SUM(CASE WHEN oi.is_winner = true AND o.status IN ('approved', 'confirmed') THEN oi.win_amount ELSE 0 END), 0) as profit
      FROM lotto_draws d
      LEFT JOIN lotto_categories lc ON d.category_id = lc.id
      LEFT JOIN lotto_orders o ON o.draw_id = d.id
      LEFT JOIN lotto_order_items oi ON oi.order_id = o.id
      ${whereClause}
      GROUP BY d.id, d.code, d.draw_date, d.round_no, d.name_th, d.open_at, d.close_at, d.status, d.result_status, d.result_number, lc.code, lc.name_th
      ORDER BY d.draw_date DESC, d.round_no DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const items = await queryLottoDb(itemsQuery, params);
    
    return {
      total,
      items: items.map((item: any) => ({
        id: item.id,
        code: item.code,
        categoryCode: item.category_code,
        drawDate: item.draw_date,
        roundNo: item.round_no,
        nameTh: item.name_th,
        openAt: item.open_at,
        closeAt: item.close_at,
        status: item.status,
        resultStatus: item.result_status,
        resultNumber: item.result_number,
        totalOrders: parseInt(item.total_orders || '0'),
        totalSales: parseFloat(item.total_sales || '0'),
        totalWinners: parseInt(item.total_winners || '0'),
        totalPayout: parseFloat(item.total_payout || '0'),
        profit: parseFloat(item.profit || '0')
      }))
    };
  },

  /**
   * Get lottery report for date range
   */
  async lottoReport(_parent: any, args: { filter: any }, context: any) {
    requireAdmin(context);
    
    const { filter } = args;
    console.log('[YEEKEE_REPORT] Filter:', filter);
    
    // Validate date range
    if (!filter.dateFrom || !filter.dateTo) {
      throw new Error('dateFrom and dateTo are required');
    }
    
    // Build WHERE clause
    let whereConditions: string[] = [];
    const params: any[] = [filter.dateFrom, filter.dateTo];
    let paramIndex = 3;
    
    whereConditions.push('d.draw_date >= $1');
    whereConditions.push('d.draw_date <= $2');
    
    if (filter.categoryCode) {
      whereConditions.push(`lc.code = $${paramIndex}`);
      params.push(filter.categoryCode);
      paramIndex++;
    }
    
    const whereClause = 'WHERE ' + whereConditions.join(' AND ');
    
    // Fetch draw reports using the view
    const drawReportsQuery = `
      SELECT *
      FROM v_draw_summary
      ${whereClause}
      ORDER BY draw_date DESC, round_no DESC
    `;
    
    const drawReports = await queryLottoDb(drawReportsQuery, params);
    
    // Calculate daily summaries
    const dailySummariesQuery = `
      SELECT 
        d.draw_date as date,
        lc.code as category_code,
        COUNT(DISTINCT d.id) as total_draws,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(oi.price), 0) as total_sales,
        COUNT(CASE WHEN oi.is_winner = true THEN 1 END) as total_winners,
        COALESCE(SUM(CASE WHEN oi.is_winner = true THEN oi.win_amount ELSE 0 END), 0) as total_payout,
        COALESCE(SUM(oi.price), 0) - COALESCE(SUM(CASE WHEN oi.is_winner = true THEN oi.win_amount ELSE 0 END), 0) as profit
      FROM lotto_draws d
      LEFT JOIN lotto_categories lc ON d.category_id = lc.id
      LEFT JOIN lotto_orders o ON o.draw_id = d.id
      LEFT JOIN lotto_order_items oi ON oi.order_id = o.id
      ${whereClause}
      GROUP BY d.draw_date, lc.code
      ORDER BY d.draw_date DESC, lc.code
    `;
    
    const dailySummaries = await queryLottoDb(dailySummariesQuery, params);
    
    // Calculate grand totals
    const grandTotals = {
      totalDraws: drawReports.length,
      totalOrders: drawReports.reduce((sum: number, r: any) => sum + parseInt(r.total_orders || '0'), 0),
      totalSales: drawReports.reduce((sum: number, r: any) => sum + parseFloat(r.total_sales || '0'), 0),
      totalWinners: drawReports.reduce((sum: number, r: any) => sum + parseInt(r.total_winners || '0'), 0),
      totalPayout: drawReports.reduce((sum: number, r: any) => sum + parseFloat(r.total_payout || '0'), 0),
      profit: drawReports.reduce((sum: number, r: any) => sum + parseFloat(r.profit || '0'), 0),
      profitMargin: 0
    };
    
    if (grandTotals.totalSales > 0) {
      grandTotals.profitMargin = (grandTotals.profit / grandTotals.totalSales) * 100;
    }
    
    return {
      dailySummaries: dailySummaries.map((s: any) => ({
        date: s.date,
        categoryCode: s.category_code,
        totalDraws: parseInt(s.total_draws || '0'),
        totalOrders: parseInt(s.total_orders || '0'),
        totalSales: parseFloat(s.total_sales || '0'),
        totalWinners: parseInt(s.total_winners || '0'),
        totalPayout: parseFloat(s.total_payout || '0'),
        profit: parseFloat(s.profit || '0')
      })),
      drawReports: drawReports.map((r: any) => ({
        drawId: r.draw_id,
        drawCode: r.draw_code,
        drawDate: r.draw_date,
        roundNo: r.round_no,
        categoryCode: r.category_code,
        categoryName: r.category_name,
        resultNumber: r.result_number,
        resultStatus: r.draw_result_status,
        totalOrders: parseInt(r.total_orders || '0'),
        totalItems: parseInt(r.total_items || '0'),
        totalSales: parseFloat(r.total_sales || '0'),
        totalWinners: parseInt(r.total_winners || '0'),
        totalPayout: parseFloat(r.total_payout || '0'),
        profit: parseFloat(r.profit || '0')
      })),
      grandTotals
    };
  },

  /**
   * Get daily report for specific date
   */
  async dailyReport(
    _parent: any,
    args: { date: string; categoryCode?: string },
    context: any
  ) {
    requireAdmin(context);
    
    console.log('[YEEKEE_DAILY_REPORT] Date:', args.date, 'Category:', args.categoryCode);
    
    const params: any[] = [args.date];
    let whereClause = 'WHERE d.draw_date = $1';
    
    if (args.categoryCode) {
      whereClause += ' AND lc.code = $2';
      params.push(args.categoryCode);
    }
    
    const query = `
      SELECT *
      FROM v_draw_summary
      ${whereClause}
      ORDER BY round_no ASC
    `;
    
    const reports = await queryLottoDb(query, params);
    
    return reports.map((r: any) => ({
      drawId: r.draw_id,
      drawCode: r.draw_code,
      drawDate: r.draw_date,
      roundNo: r.round_no,
      categoryCode: r.category_code,
      categoryName: r.category_name,
      resultNumber: r.result_number,
      resultStatus: r.draw_result_status,
      totalOrders: parseInt(r.total_orders || '0'),
      totalItems: parseInt(r.total_items || '0'),
      totalSales: parseFloat(r.total_sales || '0'),
      totalWinners: parseInt(r.total_winners || '0'),
      totalPayout: parseFloat(r.total_payout || '0'),
      profit: parseFloat(r.profit || '0')
    }));
  },

  /**
   * Get detailed information about a specific draw
   */
  async lottoDraw(_parent: any, args: { id: number }, context: any) {
    requireAdmin(context);
    
    console.log('[LOTTO_DRAW_DETAIL] Draw ID:', args.id);
    
    try {
      const result = await queryLottoDb(
        `SELECT * FROM get_draw_detail($1)`,
        [args.id]
      );
      
      if (result.length === 0) {
        return null;
      }
      
      const draw = result[0];
      
      // Get live summary from lotto_orders (override stale data from draw table)
      const summaryResult = await queryLottoDb(
        `SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(o.total_amount), 0) as total_bet_amount,
          COALESCE(SUM(o.total_win), 0) as total_winning_amount,
          COUNT(*) FILTER (WHERE COALESCE(o.total_win, 0) > 0) as total_winners
        FROM lotto_orders o
        WHERE o.draw_id = $1
          AND o.status IN ('approved', 'confirmed')`,
        [args.id]
      );
      
      const summary = summaryResult[0];
      const liveTotalOrders = parseInt(summary.total_orders || '0');
      const liveTotalBetAmount = parseFloat(summary.total_bet_amount || '0');
      const liveTotalWinningAmount = parseFloat(summary.total_winning_amount || '0');
      const liveTotalWinners = parseInt(summary.total_winners || '0');
      const liveProfitLoss = liveTotalBetAmount - liveTotalWinningAmount;
      
      // Debug log
      console.log('[GET_DRAW_DETAIL_SUMMARY_SQL]', {
        drawId: args.id,
        approvedOrderCount: liveTotalOrders,
        approvedTotalAmount: liveTotalBetAmount,
        totalWinningAmount: liveTotalWinningAmount,
        totalWinners: liveTotalWinners,
        profitLoss: liveProfitLoss,
        storedTotalOrders: draw.total_orders,
        storedTotalBetAmount: draw.total_bet_amount
      });
      
      // Parse result_details JSON if available
      let resultDetails = null;
      if (draw.result_details) {
        const details = typeof draw.result_details === 'string' 
          ? JSON.parse(draw.result_details) 
          : draw.result_details;
        
        resultDetails = {
          main6: details.main_6 || [],
          front3: details.front_3 || [],
          back3: details.back_3 || [],
          bottom2: details.bottom_2 || []
        };
      }
      
      return {
        id: draw.id,
        code: draw.code,
        categoryCode: draw.category_code,
        categoryName: draw.category_name,
        drawDate: draw.draw_date,
        roundNo: draw.round_no,
        nameTh: draw.name_th,
        openAt: draw.open_at,
        closeAt: draw.close_at,
        status: draw.status,
        resultStatus: draw.result_status,
        resultNumber: draw.result_number,
        resultDetails: resultDetails,
        totalOrders: liveTotalOrders,
        totalBetAmount: liveTotalBetAmount,
        totalWinningAmount: liveTotalWinningAmount,
        totalWinners: liveTotalWinners,
        profitLoss: liveProfitLoss,
        canSetResult: draw.can_set_result || false,
        canCalculate: draw.can_calculate || false,
        canPay: draw.can_pay || false,
        isPaid: draw.is_paid || false,
        lastCalculatedAt: draw.last_calculated_at,
        calculationCount: draw.calculation_count || 0,
        resultModifiedAfterCalc: draw.result_modified_after_calc || false
      };
    } catch (error: any) {
      console.error('[LOTTO_DRAW_DETAIL] Error:', error);
      throw new Error(`Failed to get draw detail: ${error.message}`);
    }
  }
};

// ============================================
// MUTATIONS
// ============================================

export const lottoEnhancementMutations = {
  /**
   * Unified draw generation for all lottery categories
   */
  async generateLottoDraws(
    _parent: any,
    args: { input: any },
    context: any
  ) {
    requireAdmin(context);
    
    const { input } = args;
    console.log('[LOTTO_GENERATE] Input:', input);
    
    // Route to appropriate generator based on category
    if (input.categoryCode === 'YEEKEE_VIP') {
      return lottoEnhancementMutations.generateYeeKeeVipDraws(_parent, args, context);
    } else if (input.categoryCode === 'THAI_GOVERNMENT') {
      return lottoEnhancementMutations.generateThaiLottoDraws(_parent, args, context);
    } else {
      throw new Error(`Unsupported category: ${input.categoryCode}`);
    }
  },

  /**
   * Generate YEEKEE_VIP draws using database function
   */
  async generateYeeKeeVipDraws(
    _parent: any,
    args: { input: any },
    context: any
  ) {
    requireAdmin(context);
    
    const { input } = args;
    console.log('[YEEKEE_GENERATE] Input:', input);
    
    if (input.categoryCode !== 'YEEKEE_VIP') {
      throw new Error('This mutation is only for YEEKEE_VIP category');
    }
    
    try {
      const result = await queryLottoDb(
        `SELECT * FROM generate_yeekee_vip_draws($1, $2)`,
        [input.startDate, input.endDate]
      );
      
      const row = result[0];
      console.log('[YEEKEE_GENERATE] Result:', row);
      
      return {
        success: true,
        message: row.message,
        generatedCount: row.generated_count,
        skippedCount: 0,
        startDate: input.startDate,
        endDate: input.endDate,
        createdDraws: [],
        skippedDraws: []
      };
    } catch (error: any) {
      console.error('[YEEKEE_GENERATE] Error:', error);
      throw new Error(`Failed to generate draws: ${error.message}`);
    }
  },

  /**
   * Generate Thai Government Lottery draws
   */
  async generateThaiLottoDraws(
    _parent: any,
    args: { input: any },
    context: any
  ) {
    requireAdmin(context);
    
    const { input } = args;
    console.log('[THAI_GENERATE] Input:', input);
    
    if (input.categoryCode !== 'THAI_GOVERNMENT') {
      throw new Error('This mutation is only for THAI_GOVERNMENT category');
    }
    
    try {
      // Default to auto mode (1st and 16th) unless explicitly set to false
      const autoGenerate = input.autoGenerate !== false;
      
      const result = await queryLottoDb(
        `SELECT * FROM generate_thai_lottery_draws($1, $2, $3)`,
        [input.startDate, input.endDate, autoGenerate]
      );
      
      const row = result[0];
      console.log('[THAI_GENERATE] Result:', row);
      
      // Parse JSONB arrays
      const createdDraws = row.created_draws || [];
      const skippedDraws = row.skipped_draws || [];
      
      return {
        success: row.generated_count > 0 || row.skipped_count > 0,
        message: row.message,
        generatedCount: row.generated_count,
        skippedCount: row.skipped_count,
        startDate: input.startDate,
        endDate: input.endDate,
        createdDraws: createdDraws.map((d: any) => ({
          date: d.date,
          code: d.code,
          nameTh: d.name_th,
          reason: null
        })),
        skippedDraws: skippedDraws.map((d: any) => ({
          date: d.date,
          code: null,
          nameTh: null,
          reason: d.reason
        }))
      };
    } catch (error: any) {
      console.error('[THAI_GENERATE] Error:', error);
      throw new Error(`Failed to generate Thai lottery draws: ${error.message}`);
    }
  },

  /**
   * Save draw result and trigger winner calculation
   */
  async saveDrawResult(
    _parent: any,
    args: { input: any },
    context: any
  ) {
    requireAdmin(context);
    
    const { input } = args;
    console.log('[YEEKEE_RESULT_SAVE] Input:', input);
    
    try {
      // Update draw with result
      await queryLottoDb(
        `UPDATE lotto_draws 
         SET result_number = $1,
             result_status = 'resulted',
             status = 'RESULTED',
             resulted_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [input.resultNumber, input.drawId]
      );
      
      // Calculate winners
      const winnerResult = await queryLottoDb(
        `SELECT * FROM calculate_draw_winners($1)`,
        [input.drawId]
      );
      
      const winnerRow = winnerResult[0];
      console.log('[YEEKEE_RESULT_SAVE] Winner calculation:', winnerRow);
      
      // Fetch updated draw info
      const drawQuery = `
        SELECT 
          d.*,
          lc.code as category_code,
          COUNT(DISTINCT o.id) as total_orders,
          COALESCE(SUM(oi.price), 0) as total_sales,
          COUNT(CASE WHEN oi.is_winner = true THEN 1 END) as total_winners,
          COALESCE(SUM(CASE WHEN oi.is_winner = true THEN oi.win_amount ELSE 0 END), 0) as total_payout,
          COALESCE(SUM(oi.price), 0) - COALESCE(SUM(CASE WHEN oi.is_winner = true THEN oi.win_amount ELSE 0 END), 0) as profit
        FROM lotto_draws d
        LEFT JOIN lotto_categories lc ON d.category_id = lc.id
        LEFT JOIN lotto_orders o ON o.draw_id = d.id
        LEFT JOIN lotto_order_items oi ON oi.order_id = o.id
        WHERE d.id = $1
        GROUP BY d.id, lc.code
      `;
      
      const drawResult = await queryLottoDb(drawQuery, [input.drawId]);
      const draw = drawResult[0];
      
      return {
        success: true,
        message: 'Result saved and winners calculated successfully',
        draw: {
          id: draw.id,
          code: draw.code,
          categoryCode: draw.category_code,
          drawDate: draw.draw_date,
          roundNo: draw.round_no,
          nameTh: draw.name_th,
          openAt: draw.open_at,
          closeAt: draw.close_at,
          status: draw.status,
          resultStatus: draw.result_status,
          resultNumber: draw.result_number,
          totalOrders: parseInt(draw.total_orders || '0'),
          totalSales: parseFloat(draw.total_sales || '0'),
          totalWinners: parseInt(draw.total_winners || '0'),
          totalPayout: parseFloat(draw.total_payout || '0'),
          profit: parseFloat(draw.profit || '0')
        },
        winnersCalculated: true,
        totalPayout: parseFloat(winnerRow.total_payout || '0')
      };
    } catch (error: any) {
      console.error('[YEEKEE_RESULT_SAVE] Error:', error);
      throw new Error(`Failed to save result: ${error.message}`);
    }
  },

  /**
   * Calculate winners for a draw (can be run manually)
   */
  async calculateDrawWinners(
    _parent: any,
    args: { drawId: number },
    context: any
  ) {
    requireAdmin(context);
    
    console.log('[YEEKEE_CALCULATE] DrawId:', args.drawId);
    
    try {
      const result = await queryLottoDb(
        `SELECT * FROM calculate_draw_winners($1)`,
        [args.drawId]
      );
      
      const row = result[0];
      console.log('[YEEKEE_CALCULATE] Result:', row);
      
      return {
        success: true,
        message: row.message,
        drawId: args.drawId,
        updatedOrders: row.updated_orders,
        updatedItems: row.updated_items,
        totalPayout: parseFloat(row.total_payout || '0')
      };
    } catch (error: any) {
      console.error('[YEEKEE_CALCULATE] Error:', error);
      throw new Error(`Failed to calculate winners: ${error.message}`);
    }
  },

  /**
   * Safely recalculate winners (for result corrections)
   */
  async recalculateDrawWinners(
    _parent: any,
    args: { drawId: number },
    context: any
  ) {
    const admin = requireAdmin(context);
    
    console.log('[RECALCULATE_WINNERS] DrawId:', args.drawId, 'Admin:', admin.userId);
    
    try {
      const result = await queryLottoDb(
        `SELECT * FROM recalculate_draw_winners($1, $2)`,
        [args.drawId, admin.userId]
      );
      
      const row = result[0];
      console.log('[RECALCULATE_WINNERS] Result:', row);
      
      if (row.warning) {
        console.warn('[RECALCULATE_WINNERS] Warning:', row.warning);
      }
      
      return {
        success: row.success,
        message: row.warning ? `${row.message} - ${row.warning}` : row.message,
        drawId: args.drawId,
        updatedOrders: row.updated_orders || 0,
        updatedItems: row.updated_items || 0,
        totalPayout: parseFloat(row.total_payout || '0')
      };
    } catch (error: any) {
      console.error('[RECALCULATE_WINNERS] Error:', error);
      throw new Error(`Failed to recalculate winners: ${error.message}`);
    }
  },

  /**
   * Delete draw result (reset to pending state)
   * Allows admin to remove incorrect results before paying winners
   */
  async deleteDrawResult(
    _parent: any,
    args: { drawId: number },
    context: any
  ) {
    const admin = requireAdmin(context);
    
    console.log('[DELETE_DRAW_RESULT] DrawId:', args.drawId, 'Admin:', admin.userId);
    
    try {
      // Check draw details with proper table aliases
      const checkQuery = `
        SELECT 
          d.id,
          d.is_paid,
          d.result_status,
          d.status,
          d.close_at,
          d.last_calculated_at,
          d.result_number,
          lc.code AS category_code
        FROM lotto_draws d
        JOIN lotto_categories lc ON d.category_id = lc.id
        WHERE d.id = $1
      `;
      const checkResult = await queryLottoDb(checkQuery, [args.drawId]);
      
      if (checkResult.length === 0) {
        return {
          success: false,
          message: 'Draw not found'
        };
      }
      
      const draw = checkResult[0];
      
      // Debug logging
      console.log("[DELETE_DRAW_RESULT_DEBUG]", {
        drawId: args.drawId,
        categoryCode: draw.category_code,
        closeAt: draw.close_at,
        isPaid: draw.is_paid,
        lastCalculatedAt: draw.last_calculated_at,
        resultStatus: draw.result_status,
        status: draw.status
      });
      
      if (draw.is_paid) {
        return {
          success: false,
          message: 'Cannot delete result: Draw is already paid. Create adjustment transaction instead.'
        };
      }
      
      // Delete from lotto_draw_results (Thai Government multi-field results)
      await queryLottoDb(
        `DELETE FROM lotto_draw_results WHERE draw_id = $1`,
        [args.drawId]
      );
      
      // Determine new status based on close time
      const now = new Date();
      const closeAt = new Date(draw.close_at);
      const newStatus = closeAt > now ? 'OPEN' : 'CLOSED';
      
      console.log("[DELETE_DRAW_RESULT] Setting status:", {
        now: now.toISOString(),
        closeAt: closeAt.toISOString(),
        newStatus
      });
      
      // Reset draw result
      await queryLottoDb(
        `UPDATE lotto_draws 
         SET result_number = NULL,
             result_status = 'pending',
             status = $1,
             result_modified_after_calc = CASE 
               WHEN last_calculated_at IS NOT NULL THEN TRUE 
               ELSE FALSE 
             END,
             resulted_at = NULL,
             updated_at = NOW()
         WHERE id = $2`,
        [newStatus, args.drawId]
      );
      
      // Audit log with correct column names
      const previousResultJson = draw.result_number ? JSON.stringify({ resultNumber: draw.result_number }) : null;
      
      await queryLottoDb(
        `INSERT INTO lotto_result_audit_log (
           draw_id, 
           admin_user_id, 
           action, 
           previous_result, 
           new_result,
           was_calculated, 
           was_paid,
           notes,
           created_at
         ) VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, NOW())`,
        [
          args.drawId, 
          admin.userId, 
          'DELETE_RESULT', 
          previousResultJson,
          draw.last_calculated_at !== null,
          draw.is_paid === true,
          `Draw result deleted by admin. Previous result: ${draw.result_number || 'none'}`
        ]
      );
      
      console.log('[DELETE_DRAW_RESULT] Success: Result deleted and draw reset to pending');
      
      return {
        success: true,
        message: 'Result deleted successfully. Draw status reset to pending.'
      };
    } catch (error: any) {
      console.error('[DELETE_DRAW_RESULT] Error:', error);
      throw new Error(`Failed to delete result: ${error.message}`);
    }
  },

  /**
   * Update Thai Government lottery result with multiple fields
   */
  async updateThaiGovernmentResult(
    _parent: any,
    args: { input: any },
    context: any
  ) {
    const admin = requireAdmin(context);
    
    const { drawId, mainNumber, front3, back3, bottom2 } = args.input;
    
    console.log('[THAI_GOVT_RESULT] DrawId:', drawId, 'MainNumber:', mainNumber, 'Admin:', admin.userId);
    
    try {
      const result = await queryLottoDb(
        `SELECT * FROM save_thai_government_result($1, $2, $3, $4, $5, $6)`,
        [drawId, admin.userId, mainNumber, front3, back3, bottom2]
      );
      
      const row = result[0];
      
      if (!row.success) {
        return {
          success: false,
          message: row.message,
          draw: null
        };
      }
      
      // Fetch updated draw detail
      const drawResult = await queryLottoDb(
        `SELECT * FROM get_draw_detail($1)`,
        [drawId]
      );
      
      if (drawResult.length === 0) {
        return {
          success: true,
          message: row.message,
          draw: null
        };
      }
      
      const draw = drawResult[0];
      
      // Parse result_details JSON if available
      let resultDetails = null;
      if (draw.result_details) {
        const details = typeof draw.result_details === 'string' 
          ? JSON.parse(draw.result_details) 
          : draw.result_details;
        
        resultDetails = {
          main6: details.main_6 || [],
          front3: details.front_3 || [],
          back3: details.back_3 || [],
          bottom2: details.bottom_2 || []
        };
      }
      
      return {
        success: true,
        message: row.message,
        draw: {
          id: draw.id,
          code: draw.code,
          categoryCode: draw.category_code,
          categoryName: draw.category_name,
          drawDate: draw.draw_date,
          roundNo: draw.round_no,
          nameTh: draw.name_th,
          openAt: draw.open_at,
          closeAt: draw.close_at,
          status: draw.status,
          resultStatus: draw.result_status,
          resultNumber: draw.result_number,
          resultDetails: resultDetails,
          totalOrders: parseInt(draw.total_orders || '0'),
          totalBetAmount: parseFloat(draw.total_bet_amount || '0'),
          totalWinningAmount: parseFloat(draw.total_winning_amount || '0'),
          totalWinners: parseInt(draw.total_winners || '0'),
          profitLoss: parseFloat(draw.profit_loss || '0'),
          canSetResult: draw.can_set_result || false,
          canCalculate: draw.can_calculate || false,
          canPay: draw.can_pay || false,
          isPaid: draw.is_paid || false,
          lastCalculatedAt: draw.last_calculated_at,
          calculationCount: draw.calculation_count || 0,
          resultModifiedAfterCalc: draw.result_modified_after_calc || false
        }
      };
    } catch (error: any) {
      console.error('[THAI_GOVT_RESULT] Error:', error);
      throw new Error(`Failed to update Thai Government result: ${error.message}`);
    }
  },

  /**
   * Import historical results from CSV
   */
  async importHistoricalResults(
    _parent: any,
    args: { input: any },
    context: any
  ) {
    requireAdmin(context);
    
    console.log('[YEEKEE_HISTORY_IMPORT] Starting import...');
    
    const { input } = args;
    const lines = input.csvData.split('\n').filter((line: string) => line.trim());
    
    let importedCount = 0;
    const errors: string[] = [];
    
    for (let i = 1; i < lines.length; i++) { // Skip header
      const parts = lines[i].split(',').map((s: string) => s.trim());
      if (parts.length < 3) {
        errors.push(`Line ${i + 1}: Invalid format`);
        continue;
      }
      
      const [date, roundNo, resultNumber] = parts;
      
      try {
        // Find draw
        const drawQuery = `
          SELECT d.id
          FROM lotto_draws d
          JOIN lotto_categories lc ON d.category_id = lc.id
          WHERE d.draw_date = $1
            AND d.round_no = $2
            AND lc.code = 'YEEKEE_VIP'
        `;
        
        const drawResult = await queryLottoDb(drawQuery, [date, parseInt(roundNo)]);
        
        if (drawResult.length === 0) {
          errors.push(`Line ${i + 1}: Draw not found for ${date} round ${roundNo}`);
          continue;
        }
        
        const drawId = drawResult[0].id;
        
        // Update result
        await queryLottoDb(
          `UPDATE lotto_draws 
           SET result_number = $1,
               result_status = 'resulted',
               status = 'RESULTED',
               resulted_at = NOW(),
               updated_at = NOW()
           WHERE id = $2`,
          [resultNumber, drawId]
        );
        
        // Calculate winners
        await queryLottoDb(`SELECT * FROM calculate_draw_winners($1)`, [drawId]);
        
        importedCount++;
      } catch (error: any) {
        errors.push(`Line ${i + 1}: ${error.message}`);
      }
    }
    
    console.log('[YEEKEE_HISTORY_IMPORT] Completed:', { importedCount, errorCount: errors.length });
    
    return {
      success: errors.length === 0,
      message: `Imported ${importedCount} results${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      importedCount,
      errors
    };
  },

  /**
   * Save manual result for specific draw
   */
  async saveManualResult(
    _parent: any,
    args: { input: any },
    context: any
  ) {
    requireAdmin(context);
    
    const { input } = args;
    console.log('[YEEKEE_MANUAL_RESULT] Input:', input);
    
    try {
      // Find draw
      const drawQuery = `
        SELECT d.id
        FROM lotto_draws d
        JOIN lotto_categories lc ON d.category_id = lc.id
        WHERE d.draw_date = $1
          AND lc.code = $2
          ${input.roundNo ? 'AND d.round_no = $3' : ''}
      `;
      
      const params = [input.date, input.categoryCode];
      if (input.roundNo) params.push(input.roundNo);
      
      const drawResult = await queryLottoDb(drawQuery, params);
      
      if (drawResult.length === 0) {
        throw new Error('Draw not found');
      }
      
      const drawId = drawResult[0].id;
      
      // Use saveDrawResult logic
      return await lottoEnhancementMutations.saveDrawResult(
        _parent,
        { input: { drawId, resultNumber: input.resultNumber } },
        context
      );
    } catch (error: any) {
      console.error('[YEEKEE_MANUAL_RESULT] Error:', error);
      throw new Error(`Failed to save manual result: ${error.message}`);
    }
  },

  /**
   * Update draw result (alternative to saveDrawResult)
   */
  async updateDrawResult(
    _parent: any,
    args: { input: any },
    context: any
  ) {
    requireAdmin(context);
    
    const { input } = args;
    console.log('[UPDATE_DRAW_RESULT] Input:', input);
    
    // Use existing saveDrawResult logic
    return await lottoEnhancementMutations.saveDrawResult(_parent, { input }, context);
  },

  /**
   * Pay winners for a specific draw
   */
  async payDrawWinners(
    _parent: any,
    args: { drawId: number },
    context: any
  ) {
    requireAdmin(context);
    
    const adminUser = context.user; // Assuming admin user info is in context
    const adminUserId = adminUser?.id || null;
    
    console.log('[PAY_DRAW_WINNERS] Draw ID:', args.drawId, 'Admin:', adminUserId);
    
    try {
      const result = await queryLottoDb(
        `SELECT * FROM pay_draw_winners($1, $2)`,
        [args.drawId, adminUserId]
      );
      
      const row = result[0];
      console.log('[PAY_DRAW_WINNERS] Result:', row);
      
      // Get transaction IDs (simplified - returning summary)
      const transactions: string[] = [];
      if (row.paid_orders > 0) {
        transactions.push(`${row.paid_orders} orders paid`);
      }
      
      return {
        success: true,
        message: row.message,
        drawId: args.drawId,
        paidOrders: row.paid_orders,
        paidAmount: parseFloat(row.paid_amount || '0'),
        transactions
      };
    } catch (error: any) {
      console.error('[PAY_DRAW_WINNERS] Error:', error);
      throw new Error(`Failed to pay winners: ${error.message}`);
    }
  }
};
