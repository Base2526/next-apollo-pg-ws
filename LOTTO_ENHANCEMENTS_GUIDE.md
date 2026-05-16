# Lotto System Enhancements - Implementation Guide

## 📦 What Was Implemented

### 1. **Database Enhancements** (Migration)
**File:** `db/migrations/20260504_lotto_enhancements.sql`

#### New Fields:
- `lotto_draws.result_number` - Winning number storage
- `lotto_orders.total_win` - Total winnings per order
- `lotto_order_items.is_winner` - Winner flag per bet

#### New Indexes:
- `idx_lotto_draws_date_category` - Fast lookups by date + category
- `idx_lotto_draws_active_open` - Active rounds optimization
- `idx_lotto_orders_draw` - Order lookups by draw
- `idx_lotto_order_items_winner` - Winner queries
- `idx_lotto_draws_unique_round` - Prevent duplicate draws

#### Database Functions:
- `generate_yeekee_vip_draws(start_date, end_date)` - Auto-generate 88 rounds/day
- `calculate_draw_winners(draw_id)` - Calculate all winners for a draw

#### Summary View:
- `v_draw_summary` - Pre-calculated sales, winners, payout, profit per draw

---

### 2. **GraphQL Schema Extensions**
**File:** `apps/lotto/graphql/typeDefs.enhancements.ts`

#### New Types:
- `DrawGenerationResult` - Result of draw generation
- `DrawWithResult` - Draw with sales/winner summary
- `SaveResultPayload` - Result of saving draw result
- `WinnerCalculationResult` - Winner calculation summary
- `DrawReport` - Individual draw report
- `DailySummary` - Daily aggregated report
- `ReportData` - Complete report with grand totals

#### New Queries:
- `adminDraws(filter, pagination)` - Get draws with result info
- `lottoReport(filter)` - Get comprehensive report
- `dailyReport(date, categoryCode)` - Daily draw reports

#### New Mutations:
- `generateYeeKeeVipDraws(input)` - Generate draws
- `saveDrawResult(input)` - Save result + calculate winners
- `calculateDrawWinners(drawId)` - Manual winner calculation
- `importHistoricalResults(input)` - Bulk import from CSV
- `saveManualResult(input)` - Save individual historical result

---

### 3. **GraphQL Resolvers**
**File:** `apps/lotto/graphql/resolvers.enhancements.ts`

#### Features:
- **Admin Authentication** - All resolvers require admin role
- **Draw Generation** - Calls database function for YEEKEE_VIP (88 rounds/day, 15min intervals)
- **Result Management** - Save result + auto-trigger winner calculation
- **Winner Calculation Engine**:
  - 3 ตัวบน (YEEKEE_3_TOP): Exact match
  - 2 ตัวบน (YEEKEE_2_TOP): Last 2 digits
  - 2 ตัวล่าง (YEEKEE_2_BOT): First 2 digits
  - วิ่งบน (YEEKEE_RUN_TOP): Last digit
  - วิ่งล่าง (YEEKEE_RUN_BOT): First digit
- **Reports** - Sales, winners, payout, profit with daily/draw-level breakdowns
- **CSV Import** - Bulk historical result import with error handling

#### Debug Logging:
All functions log with prefixes:
- `[YEEKEE_GENERATE]` - Draw generation
- `[YEEKEE_RESULT_SAVE]` - Result saving
- `[YEEKEE_CALCULATE]` - Winner calculation
- `[YEEKEE_REPORT]` - Report generation
- `[YEEKEE_HISTORY_IMPORT]` - CSV import

---

### 4. **GraphQL Integration**
**File:** `apps/lotto/app/api/graphql/route.ts`

**Changes:**
- Merged new typeDefs with existing schema
- Merged new resolvers (queries + mutations)
- No breaking changes to existing API

---

### 5. **Admin UI - Draw Generator**
**File:** `apps/lotto/app/(main)/admin/lotto-config/page.tsx`

#### Features:
- ✅ Category selection (YEEKEE_VIP / THAI_LOTTO)
- ✅ Date range picker (start → end)
- ✅ Generate button with loading state
- ✅ Result display (success/error)
- ✅ Info box with generation rules
- ✅ Quick links to other admin tools

#### UI Elements:
- Clean form layout
- Responsive design
- Success/error feedback
- Breadcrumb navigation

**Route:** `/admin/lotto-config`

---

## 🚀 How to Use

### **Step 1: Run Migration**

```bash
# Connect to PostgreSQL
psql -U app -d lotto

# Run migration
\i db/migrations/20260504_lotto_enhancements.sql

# Verify
SELECT * FROM generate_yeekee_vip_draws('2026-05-05', '2026-05-11');
```

### **Step 2: Generate Draws**

#### Option A: Via UI (Recommended)
1. Navigate to `/admin/lotto-config`
2. Select "จับยี่กี VIP"
3. Choose date range (e.g., 2026-05-05 to 2026-05-11)
4. Click "สร้างรอบหวย"
5. View success message with generated count

#### Option B: Via GraphQL
```graphql
mutation {
  generateYeeKeeVipDraws(input: {
    categoryCode: "YEEKEE_VIP"
    startDate: "2026-05-05"
    endDate: "2026-05-11"
  }) {
    success
    message
    generatedCount
  }
}
```

#### Option C: Direct SQL
```sql
SELECT * FROM generate_yeekee_vip_draws('2026-05-05', '2026-05-11');
```

**Result:** 88 rounds × 7 days = 616 draws created

---

### **Step 3: Input Results**

#### To Be Implemented: `/admin/results` page

**Planned Features:**
- Filter draws by category + date
- Show all draws with status
- Input result_number per draw
- Save button → auto-calculates winners

#### Temporary: Via GraphQL
```graphql
mutation {
  saveDrawResult(input: {
    drawId: 123
    resultNumber: "456"
  }) {
    success
    message
    winnersCalculated
    totalPayout
    draw {
      id
      code
      resultNumber
      totalOrders
      totalWinners
      totalPayout
      profit
    }
  }
}
```

---

### **Step 4: View Reports**

#### To Be Implemented: `/admin/report` page

**Planned Features:**
- Date range filter
- Category filter
- Daily summary cards
- Draw-level details table
- Grand totals
- Profit margin chart
- Export CSV

#### Temporary: Via GraphQL
```graphql
query {
  lottoReport(filter: {
    categoryCode: "YEEKEE_VIP"
    dateFrom: "2026-05-01"
    dateTo: "2026-05-07"
  }) {
    dailySummaries {
      date
      totalSales
      totalPayout
      profit
    }
    grandTotals {
      totalSales
      totalPayout
      profit
      profitMargin
    }
  }
}
```

---

### **Step 5: Import Historical Results**

#### To Be Implemented: `/admin/history-import` page

**Planned Features:**
- CSV file upload
- Preview import data
- Validate format
- Bulk import button
- Error report

#### CSV Format:
```csv
date,round,result
2026-05-03,1,456
2026-05-03,2,789
2026-05-03,3,123
```

#### Temporary: Via GraphQL
```graphql
mutation {
  importHistoricalResults(input: {
    csvData: """
date,round,result
2026-05-03,1,456
2026-05-03,2,789
"""
  }) {
    success
    message
    importedCount
    errors
  }
}
```

---

## 📝 Remaining Tasks

### **Priority 1: Admin Pages**
- [ ] `/admin/results` - Result Management Page
  - Filter draws (category, date range, status)
  - Table view with draw info
  - Input result_number field
  - Save button per row
  - Bulk result input
  - Winner calculation trigger

- [ ] `/admin/report` - Report Dashboard
  - Date range picker
  - Category filter
  - Summary cards (sales, payout, profit, margin)
  - Daily summary table
  - Draw details table
  - Charts (line chart for daily trends)
  - Export CSV button

- [ ] `/admin/history-import` - Historical Import Page
  - CSV file upload
  - Preview table
  - Format validation
  - Import button
  - Error display
  - Success summary

### **Priority 2: Automation**
- [ ] **Cron Job: Auto-Generate Draws**
  - Create Next.js API route: `/api/cron/generate-draws`
  - Schedule to run daily at 00:00
  - Generate draws for next 7 days
  - Log results
  - Send admin notification on failure

Example cron route:
```typescript
// apps/lotto/app/api/cron/generate-draws/route.ts
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 7);
  
  // Call generate function
  const result = await queryLottoDb(
    `SELECT * FROM generate_yeekee_vip_draws($1, $2)`,
    [today.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
  );
  
  return Response.json({ success: true, result });
}
```

Setup with Vercel Cron:
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/generate-draws",
    "schedule": "0 0 * * *"
  }]
}
```

### **Priority 3: UI Enhancements**
- [ ] Add admin navigation menu with all tools
- [ ] Add permission checks to admin pages
- [ ] Add loading states
- [ ] Add error boundaries
- [ ] Add success notifications
- [ ] Mobile responsive design

### **Priority 4: Testing**
- [ ] Unit tests for winner calculation logic
- [ ] Integration tests for GraphQL mutations
- [ ] E2E tests for admin flows
- [ ] Load testing for report generation

---

## ⚠️ Important Notes

### **Backward Compatibility**
✅ **No breaking changes**
- Existing betting flow unchanged
- Existing API endpoints unchanged
- Only added new fields/functions
- Existing resolvers untouched (except merger)

### **Data Safety**
- Unique index prevents duplicate draws
- CSV import has error handling
- Winner calculation can be re-run safely
- All changes logged with timestamps

### **Performance**
- Indexes added for fast queries
- Summary view pre-calculates aggregates
- Pagination support in admin queries
- Database functions for heavy lifting

### **Security**
- All admin resolvers require authentication
- Role check: must be `role: 'admin'`
- JWT token verification
- No sensitive data in logs

---

## 🐛 Debugging

### **Check Draw Generation**
```sql
-- Count generated draws
SELECT 
  draw_date,
  COUNT(*) as round_count
FROM lotto_draws
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP')
GROUP BY draw_date
ORDER BY draw_date DESC;

-- Verify round times
SELECT 
  round_no,
  TO_CHAR(open_at, 'HH24:MI') as open_time,
  TO_CHAR(close_at, 'HH24:MI') as close_time
FROM lotto_draws
WHERE draw_date = '2026-05-05'
  AND category_id = (SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP')
ORDER BY round_no
LIMIT 10;
```

### **Check Winner Calculation**
```sql
-- Summary per draw
SELECT * FROM v_draw_summary
WHERE draw_date = '2026-05-03'
ORDER BY round_no;

-- Detail check
SELECT 
  o.order_no,
  oi.bet_type_code,
  oi.number,
  oi.price,
  oi.is_winner,
  oi.win_amount,
  d.result_number
FROM lotto_order_items oi
JOIN lotto_orders o ON o.id = oi.order_id
JOIN lotto_draws d ON d.id = o.draw_id
WHERE d.id = 123;
```

### **GraphQL Debug Logs**
```bash
# In browser console or server logs:
[YEEKEE_GENERATE] Input: { categoryCode: 'YEEKEE_VIP', ... }
[YEEKEE_GENERATE] Result: { generated_count: 616, message: '...' }

[YEEKEE_RESULT_SAVE] Input: { drawId: 123, resultNumber: '456' }
[YEEKEE_RESULT_SAVE] Winner calculation: { updated_orders: 5, ... }

[YEEKEE_CALCULATE] DrawId: 123
[YEEKEE_CALCULATE] Result: { updated_items: 20, total_payout: 5000 }

[YEEKEE_REPORT] Filter: { dateFrom: '2026-05-01', ... }
```

---

## 📊 Database Schema Reference

### **lotto_draws**
```sql
- id (serial)
- category_id (int)
- code (varchar)
- draw_date (date)
- round_no (int)
- name_th (varchar)
- open_at (timestamptz)
- close_at (timestamptz)
- status (varchar)
- result_status (varchar) ← NEW
- result_number (varchar) ← NEW
- resulted_at (timestamptz)
- is_active (boolean)
```

### **lotto_orders**
```sql
- id (serial)
- user_id (int)
- draw_id (int)
- order_no (varchar)
- status (varchar)
- result_status (varchar)
- total_amount (numeric)
- total_win (numeric) ← NEW
- created_at (timestamptz)
```

### **lotto_order_items**
```sql
- id (serial)
- order_id (int)
- bet_type_code (varchar)
- number (varchar)
- price (numeric)
- payout_rate (numeric)
- win_amount (numeric)
- is_winner (boolean) ← NEW
- result_status (varchar)
- generated_from (varchar)
```

---

## 🎯 Next Steps

1. **Deploy Migration**
   ```bash
   npm run db:migrate
   # or manually via psql
   ```

2. **Test Draw Generation**
   - Generate draws for next week
   - Verify in database
   - Check on /play/YEEKEE_VIP

3. **Complete Admin Pages**
   - Implement /admin/results
   - Implement /admin/report  
   - Implement /admin/history-import

4. **Setup Cron Job**
   - Create cron route
   - Configure Vercel cron
   - Test manually first

5. **User Testing**
   - Generate test draws
   - Place test bets
   - Input results
   - Verify winners
   - Check reports

6. **Production Deploy**
   - Review all changes
   - Run full test suite
   - Deploy with monitoring
   - Alert setup for failures

---

## 📞 Support

For questions or issues:
1. Check debug logs (browser console + server logs)
2. Verify migration ran successfully
3. Test GraphQL queries in Apollo Studio
4. Review this document for usage examples
5. Check database directly with SQL queries

---

## ✅ Checklist

- [x] Database migration created
- [x] GraphQL schema extensions
- [x] GraphQL resolvers implemented
- [x] Schema/resolver integration
- [x] Admin UI: Draw Generator
- [ ] Admin UI: Result Management
- [ ] Admin UI: Report Dashboard
- [ ] Admin UI: History Import
- [ ] Cron job setup
- [ ] Testing
- [ ] Documentation complete
- [ ] Production deployment

---

**Version:** 1.0.0  
**Date:** May 4, 2026  
**Status:** Phase 1 Complete (Backend + Draw Generator)
