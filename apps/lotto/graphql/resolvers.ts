import { queryLottoDb } from "../lib/db";
import { v4 as uuidv4 } from "uuid";
import * as bcrypt from "bcryptjs";
export const runtime = "nodejs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// =============================
// AUTH HELPER
// =============================
function requireAdmin(context: any) {
  // You can enhance this to check context.admin or decode token, etc.
  const { req } = context;
  const token = req?.headers?.authorization?.replace('Bearer ', '') || req?.cookies?.token;
  if (!token) throw new Error('Unauthorized');
  const decoded = require('jsonwebtoken').verify(token, process.env.LOTTO_JWT_SECRET || 'changeme');
  if (!decoded || decoded.role !== 'admin') throw new Error('Unauthorized');
}

// =============================
// LOTTO QUERIES
// =============================
const lottoQuery = {
  async currentLottoDraw() {
    const rows = await queryLottoDb(
      `SELECT * FROM lotto_draws WHERE status = 'open' ORDER BY draw_date DESC LIMIT 1`
    );
    return rows[0] || null;
  },
  async activeDraw(_parent: any, args: { categoryCode: string }) {
    const { categoryCode } = args;
    
    // Get category ID
    const categoryRows = await queryLottoDb(
      `SELECT id FROM lotto_categories WHERE code = $1 AND is_active = true`,
      [categoryCode]
    );
    
    if (!categoryRows || categoryRows.length === 0) {
      return null;
    }
    
    const categoryId = categoryRows[0].id;
    
    // Find draw that is currently accepting bets
    // Requirements: 
    // 1. Category matches and is active
    // 2. Draw is active
    // 3. Status is not CANCELLED or RESULTED
    // 4. Current time is within betting window (open_at <= now < close_at)
    const activeDraws = await queryLottoDb(
      `SELECT d.*, 
              lc.code as category_code,
              (NOW() >= d.open_at AND NOW() < d.close_at AND d.is_active = true AND d.status NOT IN ('CANCELLED', 'RESULTED')) as is_accepting_bets
       FROM lotto_draws d
       LEFT JOIN lotto_categories lc ON d.category_id = lc.id
       WHERE d.category_id = $1 
         AND d.is_active = true
         AND d.status NOT IN ('CANCELLED', 'RESULTED')
         AND NOW() >= d.open_at
         AND NOW() < d.close_at
       ORDER BY d.close_at ASC
       LIMIT 1`,
      [categoryId]
    );
    
    if (activeDraws && activeDraws.length > 0) {
      return activeDraws[0];
    }
    
    // If no draw currently accepting bets, return next future draw
    const futureDraws = await queryLottoDb(
      `SELECT d.*, 
              lc.code as category_code,
              (NOW() >= d.open_at AND NOW() < d.close_at AND d.is_active = true AND d.status NOT IN ('CANCELLED', 'RESULTED')) as is_accepting_bets
       FROM lotto_draws d
       LEFT JOIN lotto_categories lc ON d.category_id = lc.id
       WHERE d.category_id = $1 
         AND d.is_active = true
         AND d.open_at > NOW()
         AND d.open_at > NOW()
       ORDER BY d.open_at ASC
       LIMIT 1`,
      [categoryId]
    );
    
    return futureDraws && futureDraws.length > 0 ? futureDraws[0] : null;
  },
  async drawById(_parent: any, args: { id: number }) {
    // Format timestamps as ISO strings like yeeKeeRounds does
    // This ensures consistent parsing on the frontend
    const query = `SELECT d.id, d.category_id, d.code, 
                          d.draw_date::text as draw_date, 
                          d.draw_period, 
                          d.round_no, 
                          d.name_th,
                          to_char(d.open_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as open_at,
                          to_char(d.close_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as close_at,
                          d.status, 
                          d.is_active,
                          lc.code as category_code,
                          (NOW() >= d.open_at AND NOW() < d.close_at AND d.is_active = true AND d.status NOT IN ('CANCELLED', 'RESULTED')) as is_accepting_bets
                   FROM lotto_draws d
                   LEFT JOIN lotto_categories lc ON d.category_id = lc.id
                   WHERE d.id = $1`;
    const draws = await queryLottoDb(query, [args.id]);
    const result = draws[0] || null;
    
    // Debug log to verify timestamp format
    if (result) {
      console.log('[drawById] Result:', {
        id: result.id,
        round_no: result.round_no,
        open_at: result.open_at,
        close_at: result.close_at,
        category_code: result.category_code
      });
    } else {
      console.warn('[drawById] No draw found for id:', args.id);
    }
    
    return result;
  },
  async lottoDraws(_parent: any, args: { categoryCode?: string, month?: number, year?: number }) {
    let query = `SELECT d.*, 
                        lc.code as category_code,
                        (NOW() >= d.open_at AND NOW() < d.close_at AND d.is_active = true AND d.status NOT IN ('CANCELLED', 'RESULTED')) as is_accepting_bets
                 FROM lotto_draws d
                 LEFT JOIN lotto_categories lc ON d.category_id = lc.id
                 WHERE d.is_active = true`;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (args.categoryCode) {
      query += ` AND lc.code = $${paramIndex}`;
      params.push(args.categoryCode);
      paramIndex++;
    }
    
    if (args.year && args.month) {
      query += ` AND EXTRACT(YEAR FROM d.draw_date) = $${paramIndex}`;
      params.push(args.year);
      paramIndex++;
      query += ` AND EXTRACT(MONTH FROM d.draw_date) = $${paramIndex}`;
      params.push(args.month);
      paramIndex++;
    } else if (args.year) {
      query += ` AND EXTRACT(YEAR FROM d.draw_date) = $${paramIndex}`;
      params.push(args.year);
      paramIndex++;
    }
    
    query += ` ORDER BY d.draw_date ASC`;
    
    return await queryLottoDb(query, params);
  },
  async yeeKeeRounds(_parent: any, args: { date?: string }) {
    try {
      const { date } = args;
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      console.log('[yeeKeeRounds] ========== START ==========');
      console.log('[yeeKeeRounds] Query params:', { date, targetDate });
      
      // Get YEEKEE_VIP category ID
      console.log('[yeeKeeRounds] Querying category...');
      const categoryRows = await queryLottoDb(
        `SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP' AND is_active = true`,
        []
      );
      
      console.log('[yeeKeeRounds] Category rows:', categoryRows);
      
      if (!categoryRows || categoryRows.length === 0) {
        console.warn('[yeeKeeRounds] No YEEKEE_VIP category found!');
        return [];
      }
      
      const categoryId = categoryRows[0].id;
      
      console.log('[yeeKeeRounds] Category ID:', categoryId);
      
      // Get all rounds for the date
      console.log('[yeeKeeRounds] Querying rounds with params:', [categoryId, targetDate]);
      const rounds = await queryLottoDb(
        `SELECT d.id, d.category_id, d.code, d.draw_date::text as draw_date, d.draw_period, 
                d.round_no, d.name_th, 
                to_char(d.open_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as open_at,
                to_char(d.close_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as close_at,
                d.status, d.is_active, d.is_date_overridden,
                lc.code as category_code,
                (NOW() >= d.open_at AND NOW() < d.close_at AND d.is_active = true AND d.status NOT IN ('CANCELLED', 'RESULTED')) as is_accepting_bets
         FROM lotto_draws d
         LEFT JOIN lotto_categories lc ON d.category_id = lc.id
         WHERE d.category_id = $1 
           AND d.draw_date = $2
           AND d.is_active = true
         ORDER BY d.round_no ASC`,
        [categoryId, targetDate]
      );
      
      console.log('[yeeKeeRounds] Query result:', { 
        count: rounds?.length || 0, 
        firstThree: rounds?.slice(0, 3),
        params: [categoryId, targetDate]
      });
      console.log('[yeeKeeRounds] ========== END ==========');
      
      return rounds;
    } catch (error) {
      console.error('[yeeKeeRounds] ERROR:', error);
      throw error;
    }
  },
  async lottoCategories() {
    return await queryLottoDb(
      `SELECT * FROM lotto_categories WHERE is_active = true ORDER BY display_order ASC, id ASC`
    );
  },
  async lottoBetTypes(_parent: any, args: { categoryCode?: string }) {
    let query = `SELECT bt.*, lc.code as category_code 
                 FROM lotto_bet_types bt
                 LEFT JOIN lotto_categories lc ON bt.category_id = lc.id
                 WHERE bt.is_active = true`;
    const params: any[] = [];
    
    if (args.categoryCode) {
      query += ` AND lc.code = $1`;
      params.push(args.categoryCode);
    }
    
    query += ` ORDER BY bt.display_order ASC, bt.id ASC`;
    
    return await queryLottoDb(query, params);
  },
  async lottoOrder(_parent: any, { orderNo }: { orderNo: string }) {
    const orders = await queryLottoDb(
      `SELECT * FROM lotto_orders WHERE order_no = $1`,
      [orderNo]
    );
    if (!orders[0]) return null;
    const items = await queryLottoDb(
      `SELECT * FROM lotto_order_items WHERE order_id = $1`,
      [orders[0].id]
    );
    return { ...orders[0], items };
  },
  async lottoOrders(_parent: any, args: any) {
    let where = [];
    let params = [];
    if (args.status) { where.push(`status = $${params.length + 1}`); params.push(args.status); }
    if (args.orderNo) { where.push(`order_no ILIKE $${params.length + 1}`); params.push(`%${args.orderNo}%`); }
    if (args.drawDate) { where.push(`draw_date = $${params.length + 1}`); params.push(args.drawDate); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orders = await queryLottoDb(
      `SELECT * FROM lotto_orders ${whereClause} ORDER BY created_at DESC`,
      params
    );
    for (const order of orders) {
      order.items = await queryLottoDb(
        `SELECT * FROM lotto_order_items WHERE order_id = $1`,
        [order.id]
      );
    }
    return orders;
  },
  
  // USER'S OWN SLIPS
  async mySlips(_parent: any, _args: any, context: any) {
    const currentUser = getUserFromContext(context);
    if (!currentUser) {
      throw new Error("กรุณาเข้าสู่ระบบเพื่อดูรายการโพยหวย");
    }
    
    const userId = currentUser.userId;
    
    // Query orders with joins to draws, categories, and bet types
    const orders = await queryLottoDb(
      `SELECT 
        o.id,
        o.order_no,
        o.total_amount,
        o.result_status,
        o.created_at,
        d.draw_date,
        d.name_th as draw_name_th,
        c.code as category_code,
        c.name_th as category_name_th
      FROM lotto_orders o
      LEFT JOIN lotto_draws d ON d.id = o.draw_id
      LEFT JOIN lotto_categories c ON c.code = o.category_code
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC`,
      [userId]
    );
    
    // For each order, fetch items with bet type names
    for (const order of orders) {
      const items = await queryLottoDb(
        `SELECT 
          i.id,
          i.bet_type_code,
          i.number,
          i.price,
          i.payout_rate,
          i.possible_win,
          i.generated_from,
          bt.name_th as bet_type_name
        FROM lotto_order_items i
        LEFT JOIN lotto_bet_types bt ON bt.code = i.bet_type_code
        WHERE i.order_id = $1
        ORDER BY i.id`,
        [order.id]
      );
      
      order.items = items.map((item: any) => ({
        id: item.id,
        betTypeCode: item.bet_type_code,
        betTypeName: item.bet_type_name,
        number: item.number,
        price: parseFloat(item.price),
        payoutRate: parseFloat(item.payout_rate),
        possibleWin: parseFloat(item.possible_win),
        generatedFrom: item.generated_from,
      }));
    }
    
    return orders.map((order: any) => ({
      id: order.id,
      orderNo: order.order_no,
      totalAmount: parseFloat(order.total_amount),
      resultStatus: order.result_status,
      createdAt: order.created_at,
      drawDate: order.draw_date,
      drawNameTh: order.draw_name_th,
      categoryCode: order.category_code,
      categoryNameTh: order.category_name_th,
      items: order.items,
    }));
  },
};

// =============================
// ADMIN QUERIES
// =============================
const adminQuery = {
  // ==========================
  // USERS
  // ==========================
  async adminUsers(_parent: any, { filter = {}, pagination = {} }: any, context: any) {
    requireAdmin(context);
    
    const { search, status, role } = filter;
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;
    
    // Build WHERE clause
    let whereConditions = [];
    let params: any[] = [];
    let paramIndex = 1;
    
    if (search) {
      whereConditions.push(`(u.phone ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (status) {
      whereConditions.push(`u.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    if (role) {
      whereConditions.push(`u.role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Count total
    const countQuery = `SELECT COUNT(*) as count FROM lotto_users u ${whereClause}`;
    const countResult = await queryLottoDb(countQuery, params);
    const total = parseInt(countResult[0]?.count || 0, 10);
    
    // Fetch users with order stats
    const usersQuery = `
      SELECT 
        u.id,
        u.phone,
        u.name,
        u.status,
        u.role,
        u.created_at,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_bet_amount
      FROM lotto_users u
      LEFT JOIN lotto_orders o ON o.user_id = u.id
      ${whereClause}
      GROUP BY u.id, u.phone, u.name, u.status, u.role, u.created_at
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const usersResult = await queryLottoDb(usersQuery, [...params, pageSize, offset]);
    
    return {
      total,
      items: usersResult.map((row: any) => ({
        id: row.id,
        phone: row.phone,
        name: row.name,
        email: null,
        credit: 0,
        status: row.status,
        role: row.role,
        createdAt: row.created_at ? (row.created_at.toISOString ? row.created_at.toISOString() : row.created_at) : null,
        lastLoginAt: null,
        totalOrders: parseInt(row.total_orders || 0, 10),
        totalBetAmount: parseFloat(row.total_bet_amount || 0),
      })),
    };
  },

  async adminUser(_parent: any, { id }: { id: string }, context: any) {
    requireAdmin(context);
    
    // Fetch user with stats
    const userQuery = `
      SELECT 
        u.id,
        u.phone,
        u.name,
        u.status,
        u.role,
        u.created_at,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_bet_amount
      FROM lotto_users u
      LEFT JOIN lotto_orders o ON o.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id, u.phone, u.name, u.status, u.role, u.created_at
    `;
    
    const userResult = await queryLottoDb(userQuery, [id]);
    
    if (!userResult || userResult.length === 0) {
      return null;
    }
    
    const user = userResult[0];
    
    // Fetch user's slips
    const slipsQuery = `
      SELECT 
        o.id,
        o.order_no,
        o.user_id,
        o.total_amount,
        o.total_win,
        o.result_status,
        o.status,
        o.created_at,
        o.checked_at,
        o.draw_id,
        o.category_code,
        u.phone as user_phone,
        u.name as user_name,
        d.name_th as draw_name,
        d.draw_date,
        c.name_th as category_name
      FROM lotto_orders o
      LEFT JOIN lotto_users u ON u.id = o.user_id
      LEFT JOIN lotto_draws d ON d.id = o.draw_id
      LEFT JOIN lotto_categories c ON c.code = o.category_code
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
      LIMIT 50
    `;
    
    const slipsResult = await queryLottoDb(slipsQuery, [id]);
    
    // Fetch items for each slip
    const slipsWithItems = await Promise.all(
      slipsResult.map(async (slip: any) => {
        const itemsQuery = `
          SELECT 
            i.id,
            i.bet_type_code,
            i.number,
            i.price,
            i.payout_rate,
            i.possible_win,
            i.generated_from,
            bt.name_th as bet_type_name
          FROM lotto_order_items i
          LEFT JOIN lotto_bet_types bt ON bt.code = i.bet_type_code
          WHERE i.order_id = $1
          ORDER BY i.id
        `;
        
        const items = await queryLottoDb(itemsQuery, [slip.id]);
        
        return {
          id: slip.id,
          orderNo: slip.order_no,
          userId: slip.user_id,
          userPhone: slip.user_phone,
          userName: slip.user_name,
          categoryCode: slip.category_code,
          categoryName: slip.category_name,
          drawId: slip.draw_id,
          drawName: slip.draw_name,
          drawDate: slip.draw_date ? (slip.draw_date.toISOString ? slip.draw_date.toISOString() : slip.draw_date) : null,
          totalAmount: parseFloat(slip.total_amount || 0),
          totalWin: parseFloat(slip.total_win || 0),
          resultStatus: slip.result_status,
          status: slip.status,
          createdAt: slip.created_at ? (slip.created_at.toISOString ? slip.created_at.toISOString() : slip.created_at) : null,
          checkedAt: slip.checked_at ? (slip.checked_at.toISOString ? slip.checked_at.toISOString() : slip.checked_at) : null,
          items: items.map((item: any) => ({
            id: item.id,
            betTypeCode: item.bet_type_code,
            betTypeName: item.bet_type_name,
            number: item.number,
            amount: parseFloat(item.price),
            payoutRate: parseFloat(item.payout_rate),
            possibleWin: parseFloat(item.possible_win || 0),
            generatedFrom: item.generated_from,
          })),
        };
      })
    );
    
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: null,
      credit: 0,
      status: user.status,
      role: user.role,
      createdAt: user.created_at ? (user.created_at.toISOString ? user.created_at.toISOString() : user.created_at) : null,
      lastLoginAt: null,
      totalOrders: parseInt(user.total_orders || 0, 10),
      totalBetAmount: parseFloat(user.total_bet_amount || 0),
      slips: slipsWithItems,
    };
  },

  // ==========================
  // SLIPS
  // ==========================
  async adminSlips(_parent: any, { filter = {}, pagination = {} }: any, context: any) {

    console.log("[adminSlips] Filter:", filter, "Pagination:", pagination);
    requireAdmin(context);
    
    const { categoryCode, dateFrom, dateTo, resultStatus, userPhone } = filter;
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;
    
    // Build WHERE clause
    let whereConditions = [];
    let params: any[] = [];
    let paramIndex = 1;
    
    if (categoryCode) {
      whereConditions.push(`o.category_code = $${paramIndex}`);
      params.push(categoryCode);
      paramIndex++;
    }
    
    if (dateFrom) {
      whereConditions.push(`o.created_at >= $${paramIndex}::timestamp`);
      params.push(dateFrom);
      paramIndex++;
    }
    
    if (dateTo) {
      whereConditions.push(`o.created_at <= $${paramIndex}::timestamp + interval '1 day'`);
      params.push(dateTo);
      paramIndex++;
    }
    
    if (resultStatus) {
      whereConditions.push(`o.result_status = $${paramIndex}`);
      params.push(resultStatus);
      paramIndex++;
    }
    
    if (userPhone) {
      whereConditions.push(`u.phone ILIKE $${paramIndex}`);
      params.push(`%${userPhone}%`);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    // Get total count
    const countResult = await queryLottoDb(
      `SELECT COUNT(*) as total
       FROM lotto_orders o
       LEFT JOIN lotto_users u ON u.id = o.user_id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.total || '0');
    
    // Get orders with pagination
    const orders = await queryLottoDb(
      `SELECT 
        o.id,
        o.order_no,
        o.user_id,
        o.total_amount,
        o.total_win,
        o.result_status,
        o.status,
        o.created_at,
        o.checked_at,
        o.draw_id,
        o.category_code,
        u.phone as user_phone,
        u.name as user_name,
        d.name_th as draw_name,
        d.draw_date,
        c.name_th as category_name
      FROM lotto_orders o
      LEFT JOIN lotto_users u ON u.id = o.user_id
      LEFT JOIN lotto_draws d ON d.id = o.draw_id
      LEFT JOIN lotto_categories c ON c.code = o.category_code
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );
    
    // Fetch items for each order
    for (const order of orders) {
      const items = await queryLottoDb(
        `SELECT 
          i.id,
          i.bet_type_code,
          i.number,
          i.price,
          i.payout_rate,
          i.possible_win,
          i.generated_from,
          bt.name_th as bet_type_name
        FROM lotto_order_items i
        LEFT JOIN lotto_bet_types bt ON bt.code = i.bet_type_code
        WHERE i.order_id = $1
        ORDER BY i.id`,
        [order.id]
      );
      
      order.items = items.map((item: any) => ({
        id: item.id,
        betTypeCode: item.bet_type_code,
        betTypeName: item.bet_type_name,
        number: item.number,
        amount: parseFloat(item.price),
        payoutRate: parseFloat(item.payout_rate),
        possibleWin: parseFloat(item.possible_win || 0),
        generatedFrom: item.generated_from,
      }));
    }
    
    const items = orders.map((order: any) => ({
      id: order.id,
      orderNo: order.order_no,
      userId: order.user_id,
      userPhone: order.user_phone,
      userName: order.user_name,
      categoryCode: order.category_code,
      categoryName: order.category_name,
      drawId: order.draw_id,
      drawName: order.draw_name,
      drawDate: order.draw_date ? (order.draw_date.toISOString ? order.draw_date.toISOString() : order.draw_date) : null,
      totalAmount: parseFloat(order.total_amount || 0),
      totalWin: parseFloat(order.total_win || 0),
      resultStatus: order.result_status,
      status: order.status,
      createdAt: order.created_at ? (order.created_at.toISOString ? order.created_at.toISOString() : order.created_at) : null,
      checkedAt: order.checked_at ? (order.checked_at.toISOString ? order.checked_at.toISOString() : order.checked_at) : null,
      items: order.items,
    }));
    
    return { total, items };
  },

  // ==========================
  // DASHBOARD
  // ==========================
  async adminDashboard(_parent: any, _args: any, context: any) {
    requireAdmin(context);
    
    // 1. Total Users
    const totalUsersResult = await queryLottoDb(`SELECT COUNT(*) as count FROM lotto_users`);
    const totalUsers = parseInt(totalUsersResult[0]?.count || 0, 10);
    
    // 2. Total Slips
    const totalSlipsResult = await queryLottoDb(`SELECT COUNT(*) as count FROM lotto_orders`);
    const totalSlips = parseInt(totalSlipsResult[0]?.count || 0, 10);
    
    // 3. Total Bet Amount
    const totalBetAmountResult = await queryLottoDb(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM lotto_orders`
    );
    const totalBetAmount = parseFloat(totalBetAmountResult[0]?.total || 0);
    
    // 4. Today Bets
    const todayBetsResult = await queryLottoDb(
      `SELECT COALESCE(SUM(total_amount), 0) as total 
       FROM lotto_orders 
       WHERE DATE(created_at) = CURRENT_DATE`
    );
    const todayBets = parseFloat(todayBetsResult[0]?.total || 0);
    
    // 5. Bets Per Day (last 7 days)
    const betsPerDayResult = await queryLottoDb(
      `SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COUNT(*) as total_slips
       FROM lotto_orders
       WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC
       LIMIT 7`
    );
    const betsPerDay = betsPerDayResult.map((row: any) => ({
      date: row.date ? (row.date.toISOString ? row.date.toISOString().split('T')[0] : row.date) : '',
      totalAmount: parseFloat(row.total_amount || 0),
      totalSlips: parseInt(row.total_slips || 0, 10),
    }));
    
    // 6. Users Growth (last 7 days)
    const usersGrowthResult = await queryLottoDb(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_users
       FROM lotto_users
       WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC
       LIMIT 7`
    );
    const usersGrowth = usersGrowthResult.map((row: any) => ({
      date: row.date ? (row.date.toISOString ? row.date.toISOString().split('T')[0] : row.date) : '',
      totalUsers: parseInt(row.total_users || 0, 10),
    }));
    
    // 7. Recent Slips (last 10)
    const recentSlipsResult = await queryLottoDb(
      `SELECT 
        o.id,
        o.order_no,
        o.total_amount,
        o.result_status,
        o.created_at,
        u.phone as user_phone,
        c.name_th as category_name
       FROM lotto_orders o
       LEFT JOIN lotto_users u ON u.id = o.user_id
       LEFT JOIN lotto_categories c ON c.code = o.category_code
       ORDER BY o.created_at DESC
       LIMIT 10`
    );
    const recentSlips = recentSlipsResult.map((row: any) => ({
      id: row.id,
      orderNo: row.order_no || `#${row.id}`,
      userPhone: row.user_phone,
      categoryName: row.category_name,
      totalAmount: parseFloat(row.total_amount || 0),
      resultStatus: row.result_status,
      createdAt: row.created_at ? (row.created_at.toISOString ? row.created_at.toISOString() : row.created_at) : null,
    }));
    
    // 8. Recent Logs (last 10) - fallback if logs table doesn't exist
    let recentLogs: any[] = [];
    try {
      const recentLogsResult = await queryLottoDb(
        `SELECT id, action, user_phone, created_at 
         FROM logs 
         ORDER BY created_at DESC 
         LIMIT 10`
      );
      recentLogs = recentLogsResult.map((row: any) => ({
        id: row.id,
        action: row.action,
        userPhone: row.user_phone,
        createdAt: row.created_at ? (row.created_at.toISOString ? row.created_at.toISOString() : row.created_at) : null,
      }));
    } catch (err) {
      // If logs table doesn't exist, return empty array
      console.warn('[adminDashboard] logs table not found, returning empty array');
      recentLogs = [];
    }
    
    return {
      totalUsers,
      totalSlips,
      totalBetAmount,
      todayBets,
      betsPerDay,
      usersGrowth,
      recentSlips,
      recentLogs,
    };
  },

  // ==========================
  // LOGS
  // ==========================
  async adminLogs(_parent: any, { filter = {}, pagination = { page: 1, pageSize: 20 } }: any, context: any) {
    requireAdmin(context);
    
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;
    
    // Build filter conditions
    const conditions = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.action) {
      conditions.push(`l.action = $${paramIndex++}`);
      params.push(filter.action);
    }

    if (filter.entityType) {
      conditions.push(`l.entity_type = $${paramIndex++}`);
      params.push(filter.entityType);
    }

    if (filter.userPhone) {
      conditions.push(`u.phone LIKE $${paramIndex++}`);
      params.push(`%${filter.userPhone}%`);
    }

    if (filter.dateFrom) {
      conditions.push(`l.created_at >= $${paramIndex++}`);
      params.push(filter.dateFrom);
    }

    if (filter.dateTo) {
      conditions.push(`l.created_at <= $${paramIndex++}`);
      params.push(filter.dateTo + ' 23:59:59');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await queryLottoDb(
      `SELECT COUNT(*) as count 
       FROM lotto_activity_logs l
       LEFT JOIN lotto_users u ON l.user_id = u.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.count || 0);

    // Get logs with user info
    const logs = await queryLottoDb(
      `SELECT 
        l.id,
        l.action,
        l.entity_type,
        l.entity_id,
        l.message,
        l.user_id,
        l.ip_address,
        l.user_agent,
        l.metadata,
        l.created_at,
        u.phone as user_phone,
        u.name as user_name
       FROM lotto_activity_logs l
       LEFT JOIN lotto_users u ON l.user_id = u.id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pageSize, offset]
    );

    return {
      total,
      items: logs.map((log: any) => ({
        id: log.id,
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
        message: log.message,
        userId: log.user_id,
        userPhone: log.user_phone,
        userName: log.user_name,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        metadata: log.metadata ? JSON.stringify(log.metadata) : null,
        createdAt: log.created_at ? log.created_at.toISOString() : null,
      })),
    };
  },

  async adminLog(_parent: any, { id }: { id: string }, context: any) {
    requireAdmin(context);
    
    const logs = await queryLottoDb(
      `SELECT 
        l.id,
        l.action,
        l.entity_type,
        l.entity_id,
        l.message,
        l.user_id,
        l.ip_address,
        l.user_agent,
        l.metadata,
        l.created_at,
        u.phone as user_phone,
        u.name as user_name
       FROM lotto_activity_logs l
       LEFT JOIN lotto_users u ON l.user_id = u.id
       WHERE l.id = $1`,
      [id]
    );

    if (!logs || logs.length === 0) {
      return null;
    }

    const log = logs[0];
    return {
      id: log.id,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      message: log.message,
      userId: log.user_id,
      userPhone: log.user_phone,
      userName: log.user_name,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      metadata: log.metadata ? JSON.stringify(log.metadata, null, 2) : null,
      createdAt: log.created_at ? log.created_at.toISOString() : null,
    };
  },
};

// =============================
// AUTH HELPER
// =============================
function getUserFromContext(context: any): { userId: string, phone: string, role: string } | null {
  const req = context.req;
  const token = req?.headers?.get?.('authorization')?.replace('Bearer ', '') || req?.cookies?.auth_token;
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, process.env.LOTTO_JWT_SECRET || 'changeme');
    // userId is UUID string
    return { userId: decoded.userId, phone: decoded.phone, role: decoded.role };
  } catch (err) {
    console.error('[Auth] Invalid token:', err);
    return null;
  }
}

// =============================
// MUTATIONS
// =============================
const mutation = {
  async login(_parent: any, { phone, password }: { phone: string, password: string }) {
    console.log("Bcrpt test : ",bcrypt.hashSync('test', 10));
    console.log("Bcrpt Somkid058848391 : ",bcrypt.hashSync('Somkid058848391@', 10));

    // Normalize phone
    const normPhone = phone.replace(/\D/g, '');
    if (!normPhone.match(/^\d{9,15}$/)) {
      return { success: false, message: "เบอร์โทรศัพท์ไม่ถูกต้อง" };
    }
    const users = await queryLottoDb(
      `SELECT * FROM lotto_users WHERE phone = $1 LIMIT 1`,
      [normPhone]
    );
    const user = users[0];
    if (!user || user.status !== 'active') {
      return { success: false, message: "เบอร์หรือรหัสผ่านไม่ถูกต้อง" };
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return { success: false, message: "เบอร์หรือรหัสผ่านไม่ถูกต้อง" };
    }
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role },
      process.env.LOTTO_JWT_SECRET || "changeme",
      { expiresIn: "7d" }
    );
    return {
      success: true,
      message: "เข้าสู่ระบบสำเร็จ",
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
      }
    };
  },

  async forgotPassword(_parent: any, { phone }: { phone: string }) {
    // Normalize phone
    const normPhone = phone.replace(/\D/g, '');
    if (!normPhone.match(/^\d{9,15}$/)) {
      return { success: false, message: "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง" };
    }
    const users = await queryLottoDb(
      `SELECT * FROM lotto_users WHERE phone = $1 LIMIT 1`,
      [normPhone]
    );
    const user = users[0];
    if (user) {
      // Generate secure token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(rawToken, 10);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
      await queryLottoDb(
        `INSERT INTO lotto_password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );
      // TODO: send SMS or email with reset link containing rawToken (not implemented)
    }
    // Always return generic message
    return {
      success: true,
      message: "ถ้ามีเบอร์นี้ในระบบ ระบบจะส่งวิธีตั้งรหัสผ่านใหม่ให้"
    };
  },

  async createLottoOrder(_parent: any, { input }: any, context: any) {
    // Require authentication
    const currentUser = getUserFromContext(context);
    if (!currentUser) {
      throw new Error("กรุณาเข้าสู่ระบบก่อนส่งโพย");
    }
    
    // MANDATORY DEBUG: Log input received with all possible field variants
    console.group("[BACKEND_YEEKEE_INPUT_DEBUG]");
    console.log("Full input:", JSON.stringify(input, null, 2));
    console.log("input.draw_id:", input.draw_id);
    console.log("input.drawId:", input.drawId);
    console.log("input.category_code:", input.category_code);
    console.log("input.categoryCode:", input.categoryCode);
    console.log("input.round_no:", input.round_no);
    console.log("input.draw_date:", input.draw_date);
    console.log("input.items length:", input.items?.length);
    console.log("userId:", currentUser.userId);
    console.log("Server timezone:", Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log("Server time:", new Date().toISOString());
    console.groupEnd();
    
    const { draw_id, items, category_code } = input;
    const userId = currentUser.userId;
    
    // Validate draw_id is a number
    if (!draw_id || typeof draw_id !== 'number' || isNaN(draw_id)) {
      console.error("[BACKEND_ERROR] Invalid draw_id:", { draw_id, type: typeof draw_id });
      throw new Error("Invalid draw_id: must be a valid number");
    }
    
    // Validate draw exists and is open for betting
    // For YEEKEE_VIP: Use SQL timezone-safe comparison
    const drawRows = await queryLottoDb(
      `SELECT d.id, d.category_id, d.code, d.draw_date, d.draw_period, d.round_no,
              d.name_th, d.open_at, d.close_at, d.status, d.is_active,
              lc.code as category_code,
              (NOW() < d.close_at) as is_open_sql,
              NOW() as db_now
       FROM lotto_draws d
       LEFT JOIN lotto_categories lc ON d.category_id = lc.id
       WHERE d.id = $1`,
      [draw_id]
    );
    
    if (!drawRows || drawRows.length === 0) {
      console.error("[BACKEND_ERROR] Draw not found:", { draw_id });
      throw new Error("ไม่พบข้อมูลงวดหวย");
    }
    
    const draw = drawRows[0];
    
    // MANDATORY DEBUG: Comprehensive draw state logging
    console.group("[BACKEND_YEEKEE_DRAW_DEBUG]");
    console.log("Draw loaded successfully:");
    console.log("  draw.id:", draw.id);
    console.log("  draw.category_code:", draw.category_code);
    console.log("  draw.round_no:", draw.round_no);
    console.log("  draw.draw_date:", draw.draw_date);
    console.log("  draw.open_at (raw):", draw.open_at);
    console.log("  draw.close_at (raw):", draw.close_at);
    console.log("  draw.status:", draw.status);
    console.log("  draw.is_active:", draw.is_active);
    console.log("  draw.db_now (raw):", draw.db_now);
    console.log("  draw.is_open_sql:", draw.is_open_sql);
    console.log("Parsed timestamps:");
    console.log("  close_at (Date):", draw.close_at ? new Date(draw.close_at) : null);
    console.log("  close_at (ISO):", draw.close_at ? new Date(draw.close_at).toISOString() : null);
    console.log("  close_at (Local):", draw.close_at ? new Date(draw.close_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : null);
    console.log("  db_now (Date):", draw.db_now ? new Date(draw.db_now) : null);
    console.log("  db_now (ISO):", draw.db_now ? new Date(draw.db_now).toISOString() : null);
    console.log("  db_now (Local):", draw.db_now ? new Date(draw.db_now).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : null);
    console.log("Comparison results:");
    console.log("  SQL: NOW() < close_at?:", draw.is_open_sql);
    console.log("  JS: close_at > Date.now()?:", draw.close_at ? (new Date(draw.close_at).getTime() > Date.now()) : null);
    console.log("  JS: close_at - Date.now() (ms):", draw.close_at ? (new Date(draw.close_at).getTime() - Date.now()) : null);
    console.log("  JS: close_at - Date.now() (minutes):", draw.close_at ? ((new Date(draw.close_at).getTime() - Date.now()) / 60000).toFixed(2) : null);
    console.groupEnd();
    
    // Validate draw belongs to category if provided
    if (category_code && draw.category_code !== category_code) {
      console.error("[BACKEND_ERROR] Category mismatch:", { expected: category_code, actual: draw.category_code });
      throw new Error(`งวดหวยนี้ไม่ใช่ของประเภท ${category_code}`);
    }
    
    // Validate draw is active
    if (!draw.is_active) {
      console.error("[BACKEND_ERROR] Draw not active");
      throw new Error("งวดหวยนี้ไม่เปิดใช้งาน");
    }
    
    // ====================================================================
    // CATEGORY-SPECIFIC VALIDATION
    // ====================================================================
    
    // YEEKEE_VIP specific validation - USE SQL COMPARISON ONLY
    if (draw.category_code === 'YEEKEE_VIP') {
      // COPYABLE DEBUG: Complete YEEKEE state for analysis
      console.log("[BACKEND_YEEKEE_SUBMIT_DEBUG_COPY]", JSON.stringify({
        input: {
          draw_id: input.draw_id,
          category_code: input.category_code,
          items_count: input.items?.length
        },
        drawId: draw.id,
        loadedDraw: {
          id: draw.id,
          round_no: draw.round_no,
          draw_date: draw.draw_date,
          open_at: draw.open_at,
          close_at: draw.close_at,
          status: draw.status,
          is_active: draw.is_active,
          is_open_sql: draw.is_open_sql
        },
        dbNow: draw.db_now,
        serverNow: new Date().toISOString(),
        closeAt: draw.close_at,
        isOpen: draw.is_open_sql,
        validation: "SQL timezone-safe: NOW() < close_at"
      }, null, 2));
      
      console.group('[BACKEND_YEEKEE_VALIDATION]');
      console.log('Starting YEEKEE_VIP specific validation...');
      console.log('Input draw_id:', draw_id);
      console.log('Loaded draw:', {
        id: draw.id,
        round_no: draw.round_no,
        draw_date: draw.draw_date,
        open_at: draw.open_at,
        close_at: draw.close_at,
        status: draw.status,
        is_active: draw.is_active,
        is_open_sql: draw.is_open_sql,
        db_now: draw.db_now
      });
      
      // Must have round_no (1-88)
      if (!draw.round_no || draw.round_no < 1 || draw.round_no > 88) {
        console.error("[VALIDATION_FAILED] Invalid round_no:", draw.round_no);
        console.groupEnd();
        throw new Error("รอบหวยไม่ถูกต้อง (ต้องเป็น 1-88)");
      }
      console.log('✓ round_no valid:', draw.round_no);
      
      // Must have close_at
      if (!draw.close_at) {
        console.error("[VALIDATION_FAILED] Missing close_at");
        console.groupEnd();
        throw new Error("ข้อมูลเวลารอบนี้ไม่ครบ กรุณาติดต่อผู้ดูแล");
      }
      console.log('✓ close_at exists:', draw.close_at);
      
      // Use SQL comparison (timezone-safe) - IGNORE status field
      console.log('Checking if round is open...');
      console.log('  SQL calculation: NOW() < close_at');
      console.log('  Result (is_open_sql):', draw.is_open_sql);
      console.log('  db_now:', draw.db_now);
      console.log('  close_at:', draw.close_at);
      console.log('  NOTE: YEEKEE_VIP ignores status field, only uses close_at');
      
      if (!draw.is_open_sql) {
        console.error("[VALIDATION_FAILED] Round is closed (is_open_sql = false)");
        
        // COPYABLE DEBUG before throw
        console.log("[DRAW_CLOSED_THROW_DEBUG]", JSON.stringify({
          input: {
            draw_id: input.draw_id,
            category_code: input.category_code
          },
          selectedDraw: {
            id: draw.id,
            round_no: draw.round_no,
            close_at: draw.close_at,
            status: draw.status,
            is_open_sql: draw.is_open_sql
          },
          closeAtRaw: draw.close_at,
          dbNow: draw.db_now,
          serverNow: new Date().toISOString(),
          closeAtLocal: new Date(draw.close_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
          dbNowLocal: new Date(draw.db_now).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
        }, null, 2));
        
        console.groupEnd();
        throw new Error(`รอบที่ ${draw.round_no} ปิดรับแทงแล้ว กรุณาเลือกรอบใหม่`);
      }
      
      console.log('✓ Round is open (is_open_sql = true)');
      console.log('✅ All YEEKEE_VIP validations passed!');
      console.groupEnd();
    } else {
      // ====================================================================
      // NON-YEEKEE (Thai Government, etc.) - USE STATUS + CLOSE_AT
      // ====================================================================
      
      // Validate draw status is OPEN
      if (draw.status !== 'OPEN') {
        console.log("[DRAW_CLOSED_THROW_SOURCE]", {
          file: "resolvers.ts createLottoOrder",
          reason: "status not OPEN",
          categoryCode: draw.category_code,
          drawId: draw.id,
          status: draw.status
        });
        
        // COPYABLE DEBUG before throw
        console.log("[DRAW_CLOSED_THROW_DEBUG]", JSON.stringify({
          input: {
            draw_id: input.draw_id,
            category_code: input.category_code
          },
          selectedDraw: {
            id: draw.id,
            status: draw.status,
            close_at: draw.close_at
          },
          closeAtRaw: draw.close_at,
          now: new Date().toISOString()
        }, null, 2));
        
        throw new Error("ปิดรับแทงงวดนี้แล้ว");
      }
      
      // Non-YEEKEE: Validate draw hasn't closed yet (check close_at with JS)
      if (draw.close_at) {
        const closeTime = new Date(draw.close_at);
        const now = new Date();
        if (closeTime <= now) {
          console.log("[DRAW_CLOSED_THROW_SOURCE]", {
            file: "resolvers.ts createLottoOrder non-YEEKEE",
            reason: "closeTime <= now (JS comparison)",
            categoryCode: draw.category_code,
            drawId: draw.id,
            closeAt: draw.close_at,
            closeTime: closeTime.toISOString(),
            now: now.toISOString()
          });
          
          // COPYABLE DEBUG before throw
          console.log("[DRAW_CLOSED_THROW_DEBUG]", JSON.stringify({
            input: {
              draw_id: input.draw_id,
              category_code: input.category_code
            },
            selectedDraw: {
              id: draw.id,
              status: draw.status,
              close_at: draw.close_at
            },
            closeAtRaw: draw.close_at,
            closeTime: closeTime.toISOString(),
            now: now.toISOString()
          }, null, 2));
          
          throw new Error("ปิดรับแทงงวดนี้แล้ว");
        }
      }
    }
    
    // ====================================================================
    // CONTINUE WITH ORDER CREATION (all validations passed)
    // ====================================================================
    
    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("Items are required");
    }
    
    // Validate category if provided
    let categoryId = null;
    if (category_code) {
      const categoryRows = await queryLottoDb(
        `SELECT id FROM lotto_categories WHERE code = $1 AND is_active = true`,
        [category_code]
      );
      if (!categoryRows || categoryRows.length === 0) {
        throw new Error(`Invalid category: ${category_code} not found or inactive`);
      }
      categoryId = categoryRows[0].id;
    }
    
    // Load bet types from DB for validation (filtered by category if provided)
    let betTypesQuery = `SELECT bt.*, lc.code as category_code 
                         FROM lotto_bet_types bt
                         LEFT JOIN lotto_categories lc ON bt.category_id = lc.id
                         WHERE bt.is_active = true`;
    const betTypesParams: any[] = [];
    
    if (categoryId) {
      betTypesQuery += ` AND bt.category_id = $1`;
      betTypesParams.push(categoryId);
    }
    
    const betTypesRows = await queryLottoDb(betTypesQuery, betTypesParams);
    const betTypesMap = new Map(betTypesRows.map((bt: any) => [bt.code, bt]));
    
    // Calculate total and validate items against DB config
    let total = 0;
    for (const item of items) {
      if (!item.bet_type_code || !item.number) {
        throw new Error("Invalid item: bet_type_code and number are required");
      }
      
      // Validate bet type exists and is active
      const betType = betTypesMap.get(item.bet_type_code);
      if (!betType) {
        throw new Error(`Invalid bet type: ${item.bet_type_code} not found or inactive`);
      }
      
      // Validate bet type belongs to selected category
      if (category_code && betType.category_code !== category_code) {
        throw new Error(`Bet type ${item.bet_type_code} does not belong to category ${category_code}`);
      }
      
      // Validate number length matches digit_count from DB
      if (item.number.length !== betType.digit_count) {
        throw new Error(`Invalid number length for ${betType.name_th}: expected ${betType.digit_count} digits, got ${item.number.length}`);
      }
      
      // Validate price is within min/max from DB
      const price = parseFloat(item.price);
      if (isNaN(price) || price < betType.min_bet || price > betType.max_bet) {
        throw new Error(`Invalid price for ${betType.name_th}: must be between ${betType.min_bet} and ${betType.max_bet}`);
      }
      
      total += price;
    }
    
    // ========================================
    // CREDIT DEDUCTION - CRITICAL SECTION
    // ========================================
    
    // Lock user row and check credit (FOR UPDATE ensures row lock)
    const userRows = await queryLottoDb(
      `SELECT id, credit FROM lotto_users WHERE id = $1 FOR UPDATE`,
      [userId]
    );
    
    if (!userRows || userRows.length === 0) {
      throw new Error("ไม่พบข้อมูลผู้ใช้");
    }
    
    const userCredit = parseFloat(userRows[0].credit || 0);
    
    // Check if user has enough credit
    if (userCredit < total) {
      throw new Error(`เครดิตไม่พอ คุณมีเครดิต ${userCredit.toFixed(2)} บาท แต่ต้องการ ${total.toFixed(2)} บาท กรุณาฝากเงินเพิ่ม`);
    }
    
    const balanceBefore = userCredit;
    const balanceAfter = userCredit - total;
    
    // Deduct credit from user
    await queryLottoDb(
      `UPDATE lotto_users SET credit = credit - $1 WHERE id = $2`,
      [total, userId]
    );
    
    console.log(`[createLottoOrder] User ${userId} credit deducted: ${total} (${balanceBefore} -> ${balanceAfter})`);
    
    // ========================================
    // CREATE ORDER
    // ========================================
    
    const order_no = uuidv4().slice(0, 8).toUpperCase();
    
    // Insert order with category_code and user_id
    const orderRows = await queryLottoDb(
      `INSERT INTO lotto_orders (order_no, draw_id, total_amount, status, category_code, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [order_no, draw_id, total, 'pending', category_code || null, userId]
    );
    const order = orderRows[0];
    
    if (!order) {
      throw new Error("Failed to create order");
    }
    
    // Insert order items with DB payout_rate
    for (const item of items) {
      const betType = betTypesMap.get(item.bet_type_code);
      const price = parseFloat(item.price);
      const payoutRate = betType.payout_rate;
      const possibleWin = price * payoutRate;
      
      // DEBUG: Log item data before insert to catch varchar overflow
      console.log("[CREATE_ORDER_ITEM_DEBUG]", JSON.stringify({
        order_id: order.id,
        bet_type_code: item.bet_type_code,
        bet_type_code_length: item.bet_type_code?.length,
        number: item.number,
        number_length: item.number?.length,
        price,
        payout_rate: payoutRate,
        possible_win: possibleWin,
        generated_from: item.generated_from
      }, null, 2));
      
      await queryLottoDb(
        `INSERT INTO lotto_order_items (order_id, bet_type_code, number, price, payout_rate, possible_win, generated_from) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [order.id, item.bet_type_code, item.number, price, payoutRate, possibleWin, item.generated_from || null]
      );
    }
    
    // ========================================
    // CREATE CREDIT TRANSACTION
    // ========================================
    
    await queryLottoDb(
      `INSERT INTO lotto_credit_transactions 
       (user_id, type, amount, direction, balance_before, balance_after, ref_type, ref_id, status, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId,
        'BET_PURCHASE',
        total,
        'OUT',
        balanceBefore,
        balanceAfter,
        'ORDER',
        order.id,
        'COMPLETED',
        `Purchase lotto slip ${order_no}`
      ]
    );
    
    console.log(`[createLottoOrder] Credit transaction created for order ${order_no}`);
    
    // Fetch created items
    const orderItems = await queryLottoDb(
      `SELECT * FROM lotto_order_items WHERE order_id = $1`,
      [order.id]
    );
    
    // SUCCESS LOG
    console.group("[BACKEND_ORDER_SUCCESS]");
    console.log("✅ Order created successfully!");
    console.log("Order details:", {
      order_id: order.id,
      order_no: order_no,
      draw_id: draw_id,
      category_code: category_code,
      round_no: draw.round_no,
      total_amount: total,
      items_count: orderItems.length,
      user_id: userId
    });
    console.groupEnd();
    
    return { ...order, items: orderItems };
  },

  async updateLottoOrder(_parent: any, { input }: any) {
    // Update order and items in a transaction
    const { order_no, draw_id, status, items } = input;
    const orders = await queryLottoDb(`SELECT * FROM lotto_orders WHERE order_no = $1`, [order_no]);
    if (!orders[0]) throw new Error("Order not found");
    const order = orders[0];
    // Update order fields
    if (draw_id) await queryLottoDb(`UPDATE lotto_orders SET draw_id = $1 WHERE id = $2`, [draw_id, order.id]);
    if (status) await queryLottoDb(`UPDATE lotto_orders SET status = $1 WHERE id = $2`, [status, order.id]);
    // Update items if provided
    if (items) {
      await queryLottoDb(`DELETE FROM lotto_order_items WHERE order_id = $1`, [order.id]);
      let total = 0;
      for (const item of items) {
        if (!item.price || item.price < 1) throw new Error("Invalid price");
        total += item.price;
        await queryLottoDb(
          `INSERT INTO lotto_order_items (order_id, bet_type_code, number, price, payout_rate, possible_win, generated_from) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [order.id, item.bet_type_code, item.number, item.price, item.payout_rate || 0, item.possible_win || 0, item.generated_from || null]
        );
      }
      await queryLottoDb(`UPDATE lotto_orders SET total_amount = $1 WHERE id = $2`, [total, order.id]);
    }
    const updatedOrder = (await queryLottoDb(`SELECT * FROM lotto_orders WHERE id = $1`, [order.id]))[0];
    const updatedItems = await queryLottoDb(`SELECT * FROM lotto_order_items WHERE order_id = $1`, [order.id]);
    return { ...updatedOrder, items: updatedItems };
  },

  async deleteLottoOrder(_parent: any, { input }: any) {
    // Delete order and items in a transaction
    const { order_no } = input;
    const orders = await queryLottoDb(`SELECT * FROM lotto_orders WHERE order_no = $1`, [order_no]);
    if (!orders[0]) throw new Error("Order not found");
    const order = orders[0];
    await queryLottoDb(`DELETE FROM lotto_order_items WHERE order_id = $1`, [order.id]);
    await queryLottoDb(`DELETE FROM lotto_orders WHERE id = $1`, [order.id]);
    return true;
  },
  
  // =============================
  // ADMIN ACTIONS
  // =============================
  async approveSlip(_parent: any, { orderId }: { orderId: string }, context: any) {
    requireAdmin(context);
    
    const orderIdInt = parseInt(orderId, 10);
    if (isNaN(orderIdInt)) {
      throw new Error("Invalid order ID");
    }
    
    // Check if order exists
    const existingOrders = await queryLottoDb(
      `SELECT id, result_status FROM lotto_orders WHERE id = $1`,
      [orderIdInt]
    );
    
    if (!existingOrders || existingOrders.length === 0) {
      throw new Error("ไม่พบรายการโพยนี้");
    }
    
    const order = existingOrders[0];
    
    // Check if already approved
    if (order.result_status === 'approved') {
      throw new Error("รายการนี้รับโพยแล้ว");
    }
    
    // Check if cancelled or rejected
    if (order.result_status === 'cancelled' || order.result_status === 'rejected') {
      throw new Error("ไม่สามารถรับโพยที่ถูกยกเลิกหรือปฏิเสธแล้ว");
    }
    
    // Update to approved
    await queryLottoDb(
      `UPDATE lotto_orders 
       SET result_status = 'approved', 
           checked_at = NOW()
       WHERE id = $1`,
      [orderIdInt]
    );
    
    // Fetch updated order with all details
    const updatedOrders = await queryLottoDb(
      `SELECT 
        o.id,
        o.order_no,
        o.user_id,
        o.total_amount,
        o.total_win,
        o.result_status,
        o.status,
        o.created_at,
        o.checked_at,
        o.draw_id,
        o.category_code,
        u.phone as user_phone,
        u.name as user_name,
        d.name_th as draw_name,
        d.draw_date,
        c.name_th as category_name
      FROM lotto_orders o
      LEFT JOIN lotto_users u ON u.id = o.user_id
      LEFT JOIN lotto_draws d ON d.id = o.draw_id
      LEFT JOIN lotto_categories c ON c.code = o.category_code
      WHERE o.id = $1`,
      [orderIdInt]
    );
    
    const updatedOrder = updatedOrders[0];
    
    // Fetch items
    const items = await queryLottoDb(
      `SELECT 
        i.id,
        i.bet_type_code,
        i.number,
        i.price,
        i.payout_rate,
        i.possible_win,
        i.generated_from,
        bt.name_th as bet_type_name
      FROM lotto_order_items i
      LEFT JOIN lotto_bet_types bt ON bt.code = i.bet_type_code
      WHERE i.order_id = $1
      ORDER BY i.id`,
      [orderIdInt]
    );
    
    return {
      id: updatedOrder.id,
      orderNo: updatedOrder.order_no,
      userId: updatedOrder.user_id,
      userPhone: updatedOrder.user_phone,
      userName: updatedOrder.user_name,
      categoryCode: updatedOrder.category_code,
      categoryName: updatedOrder.category_name,
      drawId: updatedOrder.draw_id,
      drawName: updatedOrder.draw_name,
      drawDate: updatedOrder.draw_date ? (updatedOrder.draw_date.toISOString ? updatedOrder.draw_date.toISOString() : updatedOrder.draw_date) : null,
      totalAmount: parseFloat(updatedOrder.total_amount || 0),
      totalWin: parseFloat(updatedOrder.total_win || 0),
      resultStatus: updatedOrder.result_status,
      status: updatedOrder.status,
      createdAt: updatedOrder.created_at ? (updatedOrder.created_at.toISOString ? updatedOrder.created_at.toISOString() : updatedOrder.created_at) : null,
      checkedAt: updatedOrder.checked_at ? (updatedOrder.checked_at.toISOString ? updatedOrder.checked_at.toISOString() : updatedOrder.checked_at) : null,
      items: items.map((item: any) => ({
        id: item.id,
        betTypeCode: item.bet_type_code,
        betTypeName: item.bet_type_name,
        number: item.number,
        amount: parseFloat(item.price),
        payoutRate: parseFloat(item.payout_rate),
        possibleWin: parseFloat(item.possible_win || 0),
        generatedFrom: item.generated_from,
      })),
    };
  },

  // =============================
  // DEPOSIT MUTATIONS
  // =============================
  async createDeposit(_parent: any, { input }: any, context: any) {
    const currentUser = getUserFromContext(context);
    if (!currentUser) {
      throw new Error("กรุณาเข้าสู่ระบบ");
    }

    const {
      amount,
      method = 'BANK_TRANSFER',
      bankName,
      bankAccountNo,
      bankAccountName,
      transferAt,
      slipImageUrl,
      note
    } = input;

    // Validate amount
    if (!amount || amount <= 0) {
      throw new Error("จำนวนเงินต้องมากกว่า 0");
    }

    // Create deposit request
    const deposits = await queryLottoDb(
      `INSERT INTO lotto_deposits 
       (user_id, amount, method, bank_name, bank_account_no, bank_account_name, transfer_at, slip_image_url, note, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        currentUser.userId,
        amount,
        method,
        bankName || null,
        bankAccountNo || null,
        bankAccountName || null,
        transferAt || null,
        slipImageUrl || null,
        note || null,
        'PENDING'
      ]
    );

    const deposit = deposits[0];
    console.log(`[createDeposit] User ${currentUser.userId} requested deposit ${deposit.id} amount ${amount}`);

    return {
      id: deposit.id,
      userId: deposit.user_id,
      amount: parseFloat(deposit.amount),
      method: deposit.method,
      bankName: deposit.bank_name,
      bankAccountNo: deposit.bank_account_no,
      bankAccountName: deposit.bank_account_name,
      transferAt: deposit.transfer_at ? deposit.transfer_at.toISOString() : null,
      slipImageUrl: deposit.slip_image_url,
      note: deposit.note,
      status: deposit.status,
      approvedBy: deposit.approved_by,
      approvedAt: deposit.approved_at ? deposit.approved_at.toISOString() : null,
      rejectReason: deposit.reject_reason,
      createdAt: deposit.created_at.toISOString(),
    };
  },

  async approveDeposit(_parent: any, { id, adminNote }: { id: string; adminNote?: string }, context: any) {
    requireAdmin(context);
    const admin = getUserFromContext(context);

    // Lock deposit row
    const deposits = await queryLottoDb(
      `SELECT * FROM lotto_deposits WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (!deposits || deposits.length === 0) {
      throw new Error("ไม่พบรายการฝากเงินนี้");
    }

    const deposit = deposits[0];

    // Check if already approved
    if (deposit.status === 'APPROVED') {
      throw new Error("รายการนี้อนุมัติแล้ว");
    }

    // Check if rejected or cancelled
    if (deposit.status === 'REJECTED' || deposit.status === 'CANCELLED') {
      throw new Error("ไม่สามารถอนุมัติรายการที่ถูกปฏิเสธหรือยกเลิก");
    }

    const amount = parseFloat(deposit.amount);

    // Lock user row
    const users = await queryLottoDb(
      `SELECT id, credit FROM lotto_users WHERE id = $1 FOR UPDATE`,
      [deposit.user_id]
    );

    if (!users || users.length === 0) {
      throw new Error("ไม่พบข้อมูลผู้ใช้");
    }

    const balanceBefore = parseFloat(users[0].credit || 0);
    const balanceAfter = balanceBefore + amount;

    // Update user credit
    await queryLottoDb(
      `UPDATE lotto_users SET credit = credit + $1 WHERE id = $2`,
      [amount, deposit.user_id]
    );

    // Update deposit status
    await queryLottoDb(
      `UPDATE lotto_deposits 
       SET status = $1, approved_by = $2, approved_at = NOW(), admin_note = $3
       WHERE id = $4`,
      ['APPROVED', admin?.userId || null, adminNote || 'ยอดเข้าถูกต้อง', id]
    );

    // Create credit transaction
    await queryLottoDb(
      `INSERT INTO lotto_credit_transactions 
       (user_id, type, amount, direction, balance_before, balance_after, ref_type, ref_id, status, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        deposit.user_id,
        'DEPOSIT',
        amount,
        'IN',
        balanceBefore,
        balanceAfter,
        'DEPOSIT',
        deposit.id,
        'COMPLETED',
        adminNote || 'Deposit approved by admin'
      ]
    );

    console.log(`[approveDeposit] Admin ${admin?.userId} approved deposit ${id} amount ${amount} for user ${deposit.user_id}`);

    // Fetch updated deposit
    const updatedDeposits = await queryLottoDb(
      `SELECT * FROM lotto_deposits WHERE id = $1`,
      [id]
    );

    const updated = updatedDeposits[0];

    return {
      id: updated.id,
      userId: updated.user_id,
      amount: parseFloat(updated.amount),
      method: updated.method,
      bankName: updated.bank_name,
      bankAccountNo: updated.bank_account_no,
      bankAccountName: updated.bank_account_name,
      transferAt: updated.transfer_at ? updated.transfer_at.toISOString() : null,
      slipImageUrl: updated.slip_image_url,
      note: updated.note,
      adminNote: updated.admin_note,
      status: updated.status,
      approvedBy: updated.approved_by,
      approvedAt: updated.approved_at ? updated.approved_at.toISOString() : null,
      rejectReason: updated.reject_reason,
      createdAt: updated.created_at.toISOString(),
    };
  },

  async rejectDeposit(_parent: any, { id, adminNote }: { id: string, adminNote: string }, context: any) {
    requireAdmin(context);
    const admin = getUserFromContext(context);

    const deposits = await queryLottoDb(
      `SELECT * FROM lotto_deposits WHERE id = $1`,
      [id]
    );

    if (!deposits || deposits.length === 0) {
      throw new Error("ไม่พบรายการฝากเงินนี้");
    }

    const deposit = deposits[0];

    if (deposit.status === 'APPROVED') {
      throw new Error("ไม่สามารถปฏิเสธรายการที่อนุมัติแล้ว");
    }

    await queryLottoDb(
      `UPDATE lotto_deposits 
       SET status = $1, approved_by = $2, approved_at = NOW(), admin_note = $3
       WHERE id = $4`,
      ['REJECTED', admin?.userId || null, adminNote, id]
    );

    console.log(`[rejectDeposit] Admin ${admin?.userId} rejected deposit ${id}: ${adminNote}`);

    const updatedDeposits = await queryLottoDb(
      `SELECT * FROM lotto_deposits WHERE id = $1`,
      [id]
    );

    const updated = updatedDeposits[0];

    return {
      id: updated.id,
      userId: updated.user_id,
      amount: parseFloat(updated.amount),
      method: updated.method,
      bankName: updated.bank_name,
      bankAccountNo: updated.bank_account_no,
      bankAccountName: updated.bank_account_name,
      transferAt: updated.transfer_at ? updated.transfer_at.toISOString() : null,
      slipImageUrl: updated.slip_image_url,
      note: updated.note,
      adminNote: updated.admin_note,
      status: updated.status,
      approvedBy: updated.approved_by,
      approvedAt: updated.approved_at ? updated.approved_at.toISOString() : null,
      rejectReason: updated.reject_reason,
      createdAt: updated.created_at.toISOString(),
    };
  },

  // =============================
  // WITHDRAWAL MUTATIONS
  // =============================
  async createWithdrawal(_parent: any, { input }: any, context: any) {
    const currentUser = getUserFromContext(context);
    if (!currentUser) {
      throw new Error("กรุณาเข้าสู่ระบบ");
    }

    const {
      amount,
      bankAccountId,
      bankName,
      bankAccountNo,
      bankAccountName,
      note
    } = input;

    // Validate required fields
    if (!amount || amount <= 0) {
      throw new Error("จำนวนเงินต้องมากกว่า 0");
    }

    if (!bankName || !bankAccountNo || !bankAccountName) {
      throw new Error("กรุณาระบุข้อมูลบัญชีธนาคารให้ครบถ้วน");
    }

    // Lock user row and check credit
    const users = await queryLottoDb(
      `SELECT id, credit FROM lotto_users WHERE id = $1 FOR UPDATE`,
      [currentUser.userId]
    );

    if (!users || users.length === 0) {
      throw new Error("ไม่พบข้อมูลผู้ใช้");
    }

    const userCredit = parseFloat(users[0].credit || 0);

    if (userCredit < amount) {
      throw new Error(`ยอดถอนต้องไม่เกินเครดิตคงเหลือ (คุณมีเครดิต ${userCredit.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท)`);
    }

    const balanceBefore = userCredit;
    const balanceAfter = userCredit - amount;

    // Deduct credit immediately (reserve withdrawal amount)
    await queryLottoDb(
      `UPDATE lotto_users SET credit = credit - $1 WHERE id = $2`,
      [amount, currentUser.userId]
    );

    // Create withdrawal request with bank_account_id
    const withdrawals = await queryLottoDb(
      `INSERT INTO lotto_withdrawals 
       (user_id, amount, bank_account_id, bank_name, bank_account_no, bank_account_name, note, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        currentUser.userId,
        amount,
        bankAccountId || null,
        bankName,
        bankAccountNo,
        bankAccountName,
        note || null,
        'PENDING'
      ]
    );

    const withdrawal = withdrawals[0];

    // Create credit transaction with PENDING status
    await queryLottoDb(
      `INSERT INTO lotto_credit_transactions 
       (user_id, type, amount, direction, balance_before, balance_after, ref_type, ref_id, status, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        currentUser.userId,
        'WITHDRAW',
        amount,
        'OUT',
        balanceBefore,
        balanceAfter,
        'WITHDRAW',
        withdrawal.id,
        'PENDING',
        `Withdrawal request`
      ]
    );

    console.log(`[createWithdrawal] User ${currentUser.userId} requested withdrawal ${withdrawal.id} amount ${amount}`);

    return {
      id: withdrawal.id,
      userId: withdrawal.user_id,
      amount: parseFloat(withdrawal.amount),
      bankName: withdrawal.bank_name,
      bankAccountNo: withdrawal.bank_account_no,
      bankAccountName: withdrawal.bank_account_name,
      note: withdrawal.note,
      status: withdrawal.status,
      approvedBy: withdrawal.approved_by,
      approvedAt: withdrawal.approved_at ? withdrawal.approved_at.toISOString() : null,
      rejectReason: withdrawal.reject_reason,
      createdAt: withdrawal.created_at.toISOString(),
    };
  },

  async approveWithdrawal(_parent: any, { id, adminNote, adminAttachmentUrl }: { id: string, adminNote?: string, adminAttachmentUrl?: string }, context: any) {
    requireAdmin(context);
    const admin = getUserFromContext(context);

    const withdrawals = await queryLottoDb(
      `SELECT * FROM lotto_withdrawals WHERE id = $1`,
      [id]
    );

    if (!withdrawals || withdrawals.length === 0) {
      throw new Error("ไม่พบรายการถอนเงินนี้");
    }

    const withdrawal = withdrawals[0];

    if (withdrawal.status === 'APPROVED') {
      throw new Error("รายการนี้อนุมัติแล้ว");
    }

    if (withdrawal.status === 'REJECTED' || withdrawal.status === 'CANCELLED') {
      throw new Error("ไม่สามารถอนุมัติรายการที่ถูกปฏิเสธหรือยกเลิก");
    }

    // Update withdrawal status with admin note and attachment
    await queryLottoDb(
      `UPDATE lotto_withdrawals 
       SET status = $1, approved_by = $2, approved_at = NOW(), admin_note = $3, admin_attachment_url = $4
       WHERE id = $5`,
      ['APPROVED', admin?.userId || null, adminNote || null, adminAttachmentUrl || null, id]
    );

    // Update transaction status to COMPLETED
    await queryLottoDb(
      `UPDATE lotto_credit_transactions 
       SET status = $1
       WHERE ref_type = $2 AND ref_id = $3 AND status = $4`,
      ['COMPLETED', 'WITHDRAW', withdrawal.id, 'PENDING']
    );

    console.log(`[approveWithdrawal] Admin ${admin?.userId} approved withdrawal ${id}`);

    const updatedWithdrawals = await queryLottoDb(
      `SELECT * FROM lotto_withdrawals WHERE id = $1`,
      [id]
    );

    const updated = updatedWithdrawals[0];

    return {
      id: updated.id,
      userId: updated.user_id,
      amount: parseFloat(updated.amount),
      bankName: updated.bank_name,
      bankAccountNo: updated.bank_account_no,
      bankAccountName: updated.bank_account_name,
      note: updated.note,
      status: updated.status,
      approvedBy: updated.approved_by,
      approvedAt: updated.approved_at ? updated.approved_at.toISOString() : null,
      rejectReason: updated.reject_reason,
      createdAt: updated.created_at.toISOString(),
    };
  },

  async rejectWithdrawal(_parent: any, { id, adminNote }: { id: string, adminNote: string }, context: any) {
    requireAdmin(context);
    const admin = getUserFromContext(context);

    const withdrawals = await queryLottoDb(
      `SELECT * FROM lotto_withdrawals WHERE id = $1`,
      [id]
    );

    if (!withdrawals || withdrawals.length === 0) {
      throw new Error("ไม่พบรายการถอนเงินนี้");
    }

    const withdrawal = withdrawals[0];

    if (withdrawal.status === 'APPROVED') {
      throw new Error("ไม่สามารถปฏิเสธรายการที่อนุมัติแล้ว");
    }

    const amount = parseFloat(withdrawal.amount);

    // Refund credit to user (since we deducted on request)
    const users = await queryLottoDb(
      `SELECT credit FROM lotto_users WHERE id = $1 FOR UPDATE`,
      [withdrawal.user_id]
    );

    const balanceBefore = parseFloat(users[0].credit || 0);
    const balanceAfter = balanceBefore + amount;

    await queryLottoDb(
      `UPDATE lotto_users SET credit = credit + $1 WHERE id = $2`,
      [amount, withdrawal.user_id]
    );

    // Update withdrawal status with rejection reason
    await queryLottoDb(
      `UPDATE lotto_withdrawals 
       SET status = $1, approved_by = $2, approved_at = NOW(), admin_note = $3, reject_reason = $4
       WHERE id = $5`,
      ['REJECTED', admin?.userId || null, adminNote, adminNote, id]
    );

    // Update transaction status to REJECTED
    await queryLottoDb(
      `UPDATE lotto_credit_transactions 
       SET status = $1
       WHERE ref_type = $2 AND ref_id = $3 AND status = $4`,
      ['REJECTED', 'WITHDRAW', withdrawal.id, 'PENDING']
    );

    // Create refund transaction
    await queryLottoDb(
      `INSERT INTO lotto_credit_transactions 
       (user_id, type, amount, direction, balance_before, balance_after, ref_type, ref_id, status, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        withdrawal.user_id,
        'BET_REFUND',
        amount,
        'IN',
        balanceBefore,
        balanceAfter,
        'WITHDRAW',
        withdrawal.id,
        'COMPLETED',
        `Withdrawal rejected: ${adminNote}`
      ]
    );

    console.log(`[rejectWithdrawal] Admin ${admin?.userId} rejected withdrawal ${id} and refunded ${amount}`);

    const updatedWithdrawals = await queryLottoDb(
      `SELECT * FROM lotto_withdrawals WHERE id = $1`,
      [id]
    );

    const updated = updatedWithdrawals[0];

    return {
      id: updated.id,
      userId: updated.user_id,
      amount: parseFloat(updated.amount),
      bankName: updated.bank_name,
      bankAccountNo: updated.bank_account_no,
      bankAccountName: updated.bank_account_name,
      note: updated.note,
      status: updated.status,
      approvedBy: updated.approved_by,
      approvedAt: updated.approved_at ? updated.approved_at.toISOString() : null,
      rejectReason: updated.reject_reason,
      createdAt: updated.created_at.toISOString(),
    };
  },

  // =============================
  // BANK ACCOUNT MUTATIONS
  // =============================
  async createBankAccount(_parent: any, { input }: { input: any }, context: any) {
    const currentUser = getUserFromContext(context);
    if (!currentUser) {
      throw new Error("กรุณาเข้าสู่ระบบ");
    }

    const { accountName, bankName, accountNumber } = input;

    // Check if user has no accounts, make this one default
    const existingAccounts = await queryLottoDb(
      `SELECT COUNT(*) as count FROM user_bank_accounts WHERE user_id = $1`,
      [currentUser.userId]
    );

    const isFirstAccount = parseInt(existingAccounts[0].count) === 0;

    const newAccount = await queryLottoDb(
      `INSERT INTO user_bank_accounts (user_id, account_name, bank_name, account_number, is_default)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [currentUser.userId, accountName, bankName, accountNumber, isFirstAccount]
    );

    const acc = newAccount[0];
    return {
      id: acc.id,
      userId: acc.user_id,
      accountName: acc.account_name,
      bankName: acc.bank_name,
      accountNumber: acc.account_number,
      isDefault: acc.is_default,
      createdAt: acc.created_at.toISOString(),
      updatedAt: acc.updated_at.toISOString(),
    };
  },

  async updateBankAccount(_parent: any, { id, input }: { id: string, input: any }, context: any) {
    const currentUser = getUserFromContext(context);
    if (!currentUser) {
      throw new Error("กรุณาเข้าสู่ระบบ");
    }

    // Verify ownership
    const accounts = await queryLottoDb(
      `SELECT * FROM user_bank_accounts WHERE id = $1 AND user_id = $2`,
      [id, currentUser.userId]
    );

    if (!accounts || accounts.length === 0) {
      throw new Error("ไม่พบบัญชีธนาคาร");
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (input.accountName) {
      updates.push(`account_name = $${paramIndex++}`);
      values.push(input.accountName);
    }

    if (input.bankName) {
      updates.push(`bank_name = $${paramIndex++}`);
      values.push(input.bankName);
    }

    if (input.accountNumber) {
      updates.push(`account_number = $${paramIndex++}`);
      values.push(input.accountNumber);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id, currentUser.userId);

    const updatedAccount = await queryLottoDb(
      `UPDATE user_bank_accounts 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    const acc = updatedAccount[0];
    return {
      id: acc.id,
      userId: acc.user_id,
      accountName: acc.account_name,
      bankName: acc.bank_name,
      accountNumber: acc.account_number,
      isDefault: acc.is_default,
      createdAt: acc.created_at.toISOString(),
      updatedAt: acc.updated_at.toISOString(),
    };
  },

  async deleteBankAccount(_parent: any, { id }: { id: string }, context: any) {
    const currentUser = getUserFromContext(context);
    if (!currentUser) {
      throw new Error("กรุณาเข้าสู่ระบบ");
    }

    // Verify ownership
    const accounts = await queryLottoDb(
      `SELECT * FROM user_bank_accounts WHERE id = $1 AND user_id = $2`,
      [id, currentUser.userId]
    );

    if (!accounts || accounts.length === 0) {
      throw new Error("ไม่พบบัญชีธนาคาร");
    }

    const isDefault = accounts[0].is_default;

    // Delete the account
    await queryLottoDb(
      `DELETE FROM user_bank_accounts WHERE id = $1 AND user_id = $2`,
      [id, currentUser.userId]
    );

    // If deleted account was default, set first remaining account as default
    if (isDefault) {
      await queryLottoDb(
        `UPDATE user_bank_accounts 
         SET is_default = true 
         WHERE id = (
           SELECT id FROM user_bank_accounts 
           WHERE user_id = $1 
           ORDER BY created_at ASC 
           LIMIT 1
         )`,
        [currentUser.userId]
      );
    }

    return true;
  },

  async setDefaultBankAccount(_parent: any, { id }: { id: string }, context: any) {
    const currentUser = getUserFromContext(context);
    if (!currentUser) {
      throw new Error("กรุณาเข้าสู่ระบบ");
    }

    // Verify ownership
    const accounts = await queryLottoDb(
      `SELECT * FROM user_bank_accounts WHERE id = $1 AND user_id = $2`,
      [id, currentUser.userId]
    );

    if (!accounts || accounts.length === 0) {
      throw new Error("ไม่พบบัญชีธนาคาร");
    }

    // Unset all defaults for this user
    await queryLottoDb(
      `UPDATE user_bank_accounts SET is_default = false WHERE user_id = $1`,
      [currentUser.userId]
    );

    // Set new default
    await queryLottoDb(
      `UPDATE user_bank_accounts SET is_default = true WHERE id = $1`,
      [id]
    );

    return true;
  },
};

// =============================
// PROFILE QUERIES
// =============================
const profileQuery = {
  async currentUser(_parent: any, _args: any, context: any) {
    // Use auth helper
    const currentUser = getUserFromContext(context);
    if (!currentUser) return null;

    console.log("[currentUser] Authenticated user:", currentUser.userId);

    // Query user info - including credit column
    const users = await queryLottoDb(
      `SELECT id, name, phone, status, role, credit, created_at, updated_at FROM lotto_users WHERE id = $1 LIMIT 1`,
      [currentUser.userId]
    );
    const user = users[0];
    if (!user) return null;
    
    return {
      id: user.id,
      name: user.name || user.phone || null,
      phone: user.phone,
      email: null, // email column does not exist in DB
      createdAt: user.created_at ? user.created_at.toISOString() : null,
      status: user.status || 'active',
      credit: parseFloat(user.credit || 0), // Return actual credit from DB
      lastLogin: null, // last_login column does not exist in DB
      role: user.role || 'user',
      avatarUrl: null, // avatarUrl not implemented yet
    };
  },

  // =============================
  // DEPOSIT QUERIES
  // =============================
  async depositMethods(_parent: any, _args: any) {
    const methods = await queryLottoDb(
      `SELECT * FROM lotto_deposit_methods WHERE is_active = true ORDER BY display_order, id`,
      []
    );

    return methods.map((method: any) => ({
      id: method.id,
      code: method.code,
      nameTh: method.name_th,
      description: method.description,
      minAmount: parseFloat(method.min_amount || 0),
      maxAmount: parseFloat(method.max_amount || 0),
      bankName: method.bank_name,
      bankAccountNo: method.bank_account_no,
      bankAccountName: method.bank_account_name,
      qrImageUrl: method.qr_image_url,
      isActive: method.is_active,
      displayOrder: method.display_order || 0,
    }));
  },

  async myDeposits(_parent: any, { limit = 20, offset = 0 }: any, context: any) {
    const currentUser = getUserFromContext(context);
    if (!currentUser) {
      throw new Error("กรุณาเข้าสู่ระบบ");
    }

    const deposits = await queryLottoDb(
      `SELECT * FROM lotto_deposits 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [currentUser.userId, limit, offset]
    );

    return deposits.map((deposit: any) => ({
      id: deposit.id,
      userId: deposit.user_id,
      amount: parseFloat(deposit.amount),
      method: deposit.method,
      bankName: deposit.bank_name,
      bankAccountNo: deposit.bank_account_no,
      bankAccountName: deposit.bank_account_name,
      transferAt: deposit.transfer_at ? deposit.transfer_at.toISOString() : null,
      slipImageUrl: deposit.slip_image_url,
      note: deposit.note,
      adminNote: deposit.admin_note,
      status: deposit.status,
      approvedBy: deposit.approved_by,
      approvedAt: deposit.approved_at ? deposit.approved_at.toISOString() : null,
      rejectReason: deposit.reject_reason,
      createdAt: deposit.created_at.toISOString(),
    }));
  },

  async myWithdrawals(_parent: any, _args: any, context: any) {
    const currentUser = getUserFromContext(context);
    if (!currentUser) {
      throw new Error('กรุณาเข้าสู่ระบบ');
    }

    const withdrawals = await queryLottoDb(
      `SELECT * FROM lotto_withdrawals 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [currentUser.userId]
    );

    return withdrawals.map((w: any) => ({
      id: w.id,
      userId: w.user_id,
      amount: parseFloat(w.amount),
      bankName: w.bank_name,
      bankAccountNo: w.bank_account_no,
      bankAccountName: w.bank_account_name,
      note: w.note,
      status: w.status,
      approvedBy: w.approved_by,
      approvedAt: w.approved_at ? w.approved_at.toISOString() : null,
      adminNote: w.admin_note,
      rejectReason: w.reject_reason,
      adminAttachmentUrl: w.admin_attachment_url,
      createdAt: w.created_at.toISOString(),
    }));
  },

  // =============================
  // ADMIN DEPOSIT QUERIES
  // =============================
  async adminDeposits(_parent: any, { filter = {}, pagination = {} }: any, context: any) {
    console.log("[adminDeposits] Query called with:", { filter, pagination });
    
    try {
      requireAdmin(context);
    } catch (error) {
      console.error("[adminDeposits] Auth error:", error);
      throw error;
    }

    const { status, userPhone, dateFrom, dateTo } = filter;
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`d.status = $${paramIndex++}`);
      params.push(status);
    }

    if (userPhone) {
      conditions.push(`u.phone LIKE $${paramIndex++}`);
      params.push(`%${userPhone}%`);
    }

    if (dateFrom) {
      conditions.push(`d.created_at >= $${paramIndex++}`);
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push(`d.created_at <= $${paramIndex++}`);
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await queryLottoDb(
      `SELECT COUNT(*) as total 
       FROM lotto_deposits d
       LEFT JOIN lotto_users u ON d.user_id = u.id
       ${whereClause}`,
      params
    );

    const total = parseInt(countResult[0].total);


    let sql = `SELECT 
         d.*,
         u.phone as user_phone,
         u.name as user_name
       FROM lotto_deposits d
       LEFT JOIN lotto_users u ON d.user_id = u.id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`;

    console.log("[adminDeposits] SQL:", sql, "Params:", [...params, pageSize, offset]);
    // Fetch deposits with user info
    const deposits = await queryLottoDb(sql, [...params, pageSize, offset]);

    return {
      total,
      items: deposits.map((deposit: any) => ({
        id: deposit.id,
        userId: deposit.user_id,
        userPhone: deposit.user_phone,
        userName: deposit.user_name,
        amount: parseFloat(deposit.amount),
        method: deposit.method,
        bankName: deposit.bank_name,
        bankAccountNo: deposit.bank_account_no,
        bankAccountName: deposit.bank_account_name,
        transferAt: deposit.transfer_at ? deposit.transfer_at.toISOString() : null,
        slipImageUrl: deposit.slip_image_url,
        note: deposit.note,
        adminNote: deposit.admin_note,
        status: deposit.status,
        approvedBy: deposit.approved_by,
        approvedAt: deposit.approved_at ? deposit.approved_at.toISOString() : null,
        createdAt: deposit.created_at.toISOString(),
      })),
    };
  },

  // =============================
  // ADMIN WITHDRAWALS QUERY
  // =============================
  async adminWithdrawals(_parent: any, { filter = {}, pagination = {} }: any, context: any) {
    console.log("[adminWithdrawals] Query called with:", { filter, pagination });
    
    try {
      requireAdmin(context);
    } catch (error) {
      console.error("[adminWithdrawals] Auth error:", error);
      throw error;
    }

    const { status, userPhone, dateFrom, dateTo } = filter;
    const { page = 1, pageSize = 20 } = pagination;
    const offset = (page - 1) * pageSize;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`w.status = $${paramIndex++}`);
      params.push(status);
    }

    if (userPhone) {
      conditions.push(`u.phone LIKE $${paramIndex++}`);
      params.push(`%${userPhone}%`);
    }

    if (dateFrom) {
      conditions.push(`w.created_at >= $${paramIndex++}`);
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push(`w.created_at <= $${paramIndex++}`);
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await queryLottoDb(
      `SELECT COUNT(*) as total 
       FROM lotto_withdrawals w
       LEFT JOIN lotto_users u ON w.user_id = u.id
       ${whereClause}`,
      params
    );

    const total = parseInt(countResult[0].total);

    console.log("[adminWithdrawals] Total count:", total);

    // Fetch withdrawals with user info
    const sql = `SELECT 
         w.*,
         u.phone as user_phone,
         u.name as user_name
       FROM lotto_withdrawals w
       LEFT JOIN lotto_users u ON w.user_id = u.id
       ${whereClause}
       ORDER BY w.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`;

    console.log("[adminWithdrawals] SQL:", sql, "Params:", [...params, pageSize, offset]);
    const withdrawals = await queryLottoDb(sql, [...params, pageSize, offset]);

    console.log("[adminWithdrawals] Found withdrawals:", withdrawals.length);

    return {
      total,
      items: withdrawals.map((withdrawal: any) => ({
        id: withdrawal.id,
        userId: withdrawal.user_id,
        userPhone: withdrawal.user_phone,
        userName: withdrawal.user_name,
        amount: parseFloat(withdrawal.amount),
        bankName: withdrawal.bank_name,
        bankAccountNo: withdrawal.bank_account_no,
        bankAccountName: withdrawal.bank_account_name,
        note: withdrawal.note,
        status: withdrawal.status,
        approvedAt: withdrawal.approved_at ? withdrawal.approved_at.toISOString() : null,
        adminNote: withdrawal.admin_note,
        rejectReason: withdrawal.reject_reason,
        adminAttachmentUrl: withdrawal.admin_attachment_url,
        createdAt: withdrawal.created_at.toISOString(),
      })),
    };
  },

  // =============================
  // BANK ACCOUNT QUERIES
  // =============================
  async myBankAccounts(_parent: any, _args: any, context: any) {
    const currentUser = getUserFromContext(context);
    if (!currentUser) {
      throw new Error("กรุณาเข้าสู่ระบบ");
    }

    const accounts = await queryLottoDb(
      `SELECT * FROM user_bank_accounts 
       WHERE user_id = $1 
       ORDER BY is_default DESC, created_at DESC`,
      [currentUser.userId]
    );

    return accounts.map((acc: any) => ({
      id: acc.id,
      userId: acc.user_id,
      accountName: acc.account_name,
      bankName: acc.bank_name,
      accountNumber: acc.account_number,
      isDefault: acc.is_default,
      createdAt: acc.created_at.toISOString(),
      updatedAt: acc.updated_at.toISOString(),
    }));
  },
};

// =============================
// FINAL EXPORT
// =============================
export const resolvers = {
  Query: {
    ...lottoQuery,
    ...adminQuery,
    ...profileQuery,
  },
  Mutation: mutation,
};
