import gql from "graphql-tag";

/**
 * GraphQL Type Definitions for Lotto System Enhancements
 * Features: Draw Generator, Result Management, Winner Calculation, Reports
 */
export const lottoEnhancementsTypeDefs = gql`
  # ============================================
  # DRAW MANAGEMENT TYPES
  # ============================================
  
  type DrawInfo {
    date: String!
    code: String
    nameTh: String
    reason: String
  }
  
  type DrawGenerationResult {
    success: Boolean!
    message: String!
    generatedCount: Int!
    skippedCount: Int!
    startDate: String!
    endDate: String!
    createdDraws: [DrawInfo!]
    skippedDraws: [DrawInfo!]
  }

  input GenerateDrawsInput {
    categoryCode: String!
    startDate: String!
    endDate: String!
    autoGenerate: Boolean # For Thai lottery: true = 1st & 16th only, false = all dates in range
  }

  # ============================================
  # RESULT MANAGEMENT TYPES
  # ============================================
  
  type DrawWithResult {
    id: ID!
    code: String!
    categoryCode: String!
    drawDate: String!
    roundNo: Int
    nameTh: String
    openAt: String
    closeAt: String
    status: String!
    resultStatus: String!
    resultNumber: String
    totalOrders: Int
    totalSales: Float
    totalWinners: Int
    totalPayout: Float
    profit: Float
  }

  type ResultManagementList {
    total: Int!
    items: [DrawWithResult!]!
  }

  input ResultFilterInput {
    categoryCode: String
    dateFrom: String
    dateTo: String
    resultStatus: String
  }

  input SaveResultInput {
    drawId: Int!
    resultNumber: String!
  }

  type SaveResultPayload {
    success: Boolean!
    message: String!
    draw: DrawWithResult
    winnersCalculated: Boolean
    totalPayout: Float
  }

  type DeleteDrawResultPayload {
    success: Boolean!
    message: String!
  }

  # ============================================
  # WINNER CALCULATION TYPES
  # ============================================
  
  type WinnerCalculationResult {
    success: Boolean!
    message: String!
    drawId: Int!
    updatedOrders: Int!
    updatedItems: Int!
    totalPayout: Float!
  }

  # ============================================
  # REPORT TYPES
  # ============================================
  
  type DrawReport {
    drawId: ID!
    drawCode: String!
    drawDate: String!
    roundNo: Int
    categoryCode: String!
    categoryName: String!
    resultNumber: String
    resultStatus: String!
    totalOrders: Int!
    totalItems: Int!
    totalSales: Float!
    totalWinners: Int!
    totalPayout: Float!
    profit: Float!
  }

  type DailySummary {
    date: String!
    categoryCode: String!
    totalDraws: Int!
    totalOrders: Int!
    totalSales: Float!
    totalWinners: Int!
    totalPayout: Float!
    profit: Float!
  }

  type ReportData {
    dailySummaries: [DailySummary!]!
    drawReports: [DrawReport!]!
    grandTotals: ReportGrandTotals!
  }

  type ReportGrandTotals {
    totalDraws: Int!
    totalOrders: Int!
    totalSales: Float!
    totalWinners: Int!
    totalPayout: Float!
    profit: Float!
    profitMargin: Float!
  }

  input ReportFilterInput {
    categoryCode: String
    dateFrom: String!
    dateTo: String!
    groupBy: String
  }

  # ============================================
  # HISTORY IMPORT TYPES
  # ============================================
  
  type HistoryImportResult {
    success: Boolean!
    message: String!
    importedCount: Int!
    errors: [String!]
  }

  input HistoryImportInput {
    csvData: String!
  }

  input ManualResultInput {
    categoryCode: String!
    date: String!
    roundNo: Int
    resultNumber: String!
  }

  # ============================================
  # DRAW DETAIL TYPES
  # ============================================
  
  type ResultDetails {
    main6: [String!]
    front3: [String!]
    back3: [String!]
    bottom2: [String!]
  }
  
  type DrawDetail {
    id: ID!
    code: String!
    categoryCode: String!
    categoryName: String!
    drawDate: String!
    roundNo: Int
    nameTh: String
    openAt: String
    closeAt: String
    status: String!
    resultStatus: String!
    resultNumber: String
    resultDetails: ResultDetails
    totalOrders: Int!
    totalBetAmount: Float!
    totalWinningAmount: Float!
    totalWinners: Int!
    profitLoss: Float!
    canSetResult: Boolean!
    canCalculate: Boolean!
    canPay: Boolean!
    isPaid: Boolean!
    lastCalculatedAt: String
    calculationCount: Int
    resultModifiedAfterCalc: Boolean
  }

  input UpdateDrawResultInput {
    drawId: Int!
    resultNumber: String!
  }

  input ThaiGovernmentResultInput {
    drawId: Int!
    mainNumber: String!
    front3: [String!]!
    back3: [String!]!
    bottom2: String!
  }

  type ThaiGovernmentResultPayload {
    success: Boolean!
    message: String!
    draw: DrawDetail
  }

  type PayWinnersResult {
    success: Boolean!
    message: String!
    drawId: Int!
    paidOrders: Int!
    paidAmount: Float!
    transactions: [String!]!
  }

  # ============================================
  # EXTENDED QUERIES
  # ============================================
  
  extend type Query {
    # Draw Management
    adminDraws(
      filter: ResultFilterInput
      pagination: PaginationInput
    ): ResultManagementList!
    
    # Draw Detail
    lottoDraw(id: Int!): DrawDetail
    
    # Reports
    lottoReport(filter: ReportFilterInput!): ReportData!
    dailyReport(date: String!, categoryCode: String): [DrawReport!]!
  }

  # ============================================
  # EXTENDED MUTATIONS
  # ============================================
  
  extend type Mutation {
    # Draw Generation (unified for all categories)
    generateLottoDraws(input: GenerateDrawsInput!): DrawGenerationResult!
    
    # Legacy mutations (kept for backward compatibility)
    generateYeeKeeVipDraws(input: GenerateDrawsInput!): DrawGenerationResult!
    generateThaiLottoDraws(input: GenerateDrawsInput!): DrawGenerationResult!
    
    # Result Management
    saveDrawResult(input: SaveResultInput!): SaveResultPayload!
    updateDrawResult(input: UpdateDrawResultInput!): SaveResultPayload!
    updateThaiGovernmentResult(input: ThaiGovernmentResultInput!): ThaiGovernmentResultPayload!
    deleteDrawResult(drawId: Int!): DeleteDrawResultPayload!
    calculateDrawWinners(drawId: Int!): WinnerCalculationResult!
    recalculateDrawWinners(drawId: Int!): WinnerCalculationResult!
    
    # Payment
    payDrawWinners(drawId: Int!): PayWinnersResult!
    
    # History Import
    importHistoricalResults(input: HistoryImportInput!): HistoryImportResult!
    saveManualResult(input: ManualResultInput!): SaveResultPayload!
  }
`;
