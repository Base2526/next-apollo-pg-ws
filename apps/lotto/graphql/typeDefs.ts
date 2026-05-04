import gql from "graphql-tag";

export const typeDefs = gql`
  type User {
    id: ID!
    name: String
    phone: String
    email: String
    createdAt: String
    avatarUrl: String
    credit: Float
    status: String
    role: String
    lastLogin: String
  }

  type UserBankAccount {
    id: ID!
    userId: ID!
    accountName: String!
    bankName: String!
    accountNumber: String!
    isDefault: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type LottoDraw {
    id: ID!
    category_id: Int
    category_code: String
    code: String!
    draw_date: String!
    draw_period: String
    round_no: Int
    name_th: String
    open_at: String
    close_at: String
    status: String!
    is_active: Boolean!
    is_date_overridden: Boolean
    is_accepting_bets: Boolean
    created_at: String
    updated_at: String
  }

  type LottoCategory {
    id: ID!
    code: String!
    name_th: String!
    description: String
    icon_url: String
    color: String
    close_time_label: String
    is_active: Boolean!
    display_order: Int!
  }

  type LottoBetType {
    id: ID!
    category_id: Int
    category_code: String
    code: String!
    name_th: String!
    digit_count: Int!
    payout_rate: Float!
    min_bet: Float!
    max_bet: Float!
    is_active: Boolean!
    display_order: Int
  }

  type LottoOrderItem {
    bet_type_code: String!
    number: String!
    price: Float!
    payout_rate: Float!
    possible_win: Float
    generated_from: String
  }

  type LottoOrder {
    order_no: String!
    draw_id: Int!
    status: String!
    total_amount: Float!
    items: [LottoOrderItem!]!
    created_at: String!
  }

  type MySlip {
    id: ID!
    orderNo: String!
    totalAmount: Float!
    resultStatus: String!
    createdAt: String!
    drawDate: String
    drawNameTh: String
    categoryCode: String
    categoryNameTh: String
    items: [MySlipItem!]!
  }

  type MySlipItem {
    id: ID!
    betTypeCode: String!
    betTypeName: String
    number: String!
    price: Float!
    payoutRate: Float!
    possibleWin: Float
    generatedFrom: String
  }


  # --- Admin Dashboard Types ---
  type AdminUser {
    id: ID!
    phone: String
    name: String
    email: String
    credit: Float
    status: String
    role: String
    createdAt: String
    lastLoginAt: String
    totalOrders: Int
    totalBetAmount: Float
  }

  type AdminUsersResult {
    total: Int!
    items: [AdminUser!]!
  }

  input AdminUserFilterInput {
    search: String
    status: String
    role: String
  }

  type AdminUserDetail {
    id: ID!
    phone: String
    name: String
    email: String
    credit: Float
    status: String
    role: String
    createdAt: String
    lastLoginAt: String
    totalOrders: Int
    totalBetAmount: Float
    slips: [AdminSlip!]!
  }

  type AdminSlipItem {
    id: ID!
    betTypeCode: String!
    betTypeName: String
    number: String!
    amount: Float!
    payoutRate: Float!
    possibleWin: Float
    generatedFrom: String
  }

  type AdminSlip {
    id: ID!
    orderNo: String!
    userId: String
    userPhone: String
    userName: String
    categoryCode: String
    categoryName: String
    drawId: Int
    drawName: String
    drawDate: String
    totalAmount: Float!
    totalWin: Float
    resultStatus: String!
    status: String
    createdAt: String!
    checkedAt: String
    items: [AdminSlipItem!]!
  }

  type AdminSlipsResult {
    total: Int!
    items: [AdminSlip!]!
  }

  input AdminSlipFilterInput {
    categoryCode: String
    dateFrom: String
    dateTo: String
    resultStatus: String
    userPhone: String
  }

  type AdminDepositsResult {
    total: Int!
    items: [AdminDeposit!]!\n  }

  type AdminWithdrawalsResult {
    total: Int!
    items: [AdminWithdrawal!]!
  }

  input PaginationInput {
    page: Int
    pageSize: Int
  }

  type AdminLog {
    id: ID!
    action: String!
    entityType: String
    entityId: String
    message: String
    userId: ID
    userPhone: String
    userName: String
    ipAddress: String
    userAgent: String
    metadata: String
    createdAt: String!
  }

  type AdminLogsResult {
    total: Int!
    items: [AdminLog!]!
  }

  type DashboardBetsPerDay {
    date: String!
    totalAmount: Float!
    totalSlips: Int!
  }

  type DashboardUsersGrowth {
    date: String!
    totalUsers: Int!
  }

  type DashboardRecentSlip {
    id: ID!
    orderNo: String!
    userPhone: String
    categoryName: String
    totalAmount: Float!
    resultStatus: String!
    createdAt: String!
  }

  type AdminDashboard {
    totalUsers: Int!
    totalSlips: Int!
    totalBetAmount: Float!
    todayBets: Float!
    betsPerDay: [DashboardBetsPerDay!]!
    usersGrowth: [DashboardUsersGrowth!]!
    recentSlips: [DashboardRecentSlip!]!
    recentLogs: [AdminLog!]!
  }

  type Query {
    # Public
    currentLottoDraw: LottoDraw
    activeDraw(categoryCode: String!): LottoDraw
    drawById(id: Int!): LottoDraw
    lottoDraws(categoryCode: String, month: Int, year: Int): [LottoDraw!]!
    yeeKeeRounds(date: String): [LottoDraw!]!
    lottoCategories: [LottoCategory!]!
    lottoBetTypes(categoryCode: String): [LottoBetType!]!
    lottoOrder(orderNo: String!): LottoOrder
    lottoOrders(
      status: String
      orderNo: String
      drawDate: String
    ): [LottoOrder!]!
    
    # User's own slips
    mySlips: [MySlip!]!

    # Admin Dashboard
    adminDashboard: AdminDashboard!
    adminUsers(filter: AdminUserFilterInput, pagination: PaginationInput): AdminUsersResult!
    adminUser(id: ID!): AdminUserDetail
    adminSlips(filter: AdminSlipFilterInput, pagination: PaginationInput): AdminSlipsResult!
    adminLogs(filter: AdminLogFilterInput, pagination: PaginationInput): AdminLogsResult!
    adminLog(id: ID!): AdminLog

    # User Profile
    currentUser: User

    # Deposit System
    depositMethods: [DepositMethod!]!
    myDeposits(limit: Int, offset: Int): [Deposit!]!

    # Admin Deposits
    adminDeposits(filter: AdminDepositFilterInput, pagination: PaginationInput): AdminDepositsResult!

    # Withdrawal System
    myWithdrawals: [Withdrawal!]!

    # Admin Withdrawals
    adminWithdrawals(filter: AdminWithdrawalFilterInput, pagination: PaginationInput): AdminWithdrawalsResult!

    # Bank Account Queries
    myBankAccounts: [UserBankAccount!]!
  }

  input UpdateLottoOrderInput {
    order_no: String!
    draw_id: Int
    status: String
    items: [LottoOrderItemInput!]
  }

  input DeleteLottoOrderInput {
    order_no: String!
  }

  input LottoOrderItemInput {
    bet_type_code: String!
    number: String!
    price: Float!
    generated_from: String
  }

  input CreateLottoOrderInput {
    draw_id: Int!
    category_code: String
    items: [LottoOrderItemInput!]!
  }

  type AuthUser {
    id: ID!
    phone: String!
    name: String
    role: String!
  }

  type LoginPayload {
    success: Boolean!
    message: String!
    token: String
    user: AuthUser
  }

  type ForgotPasswordPayload {
    success: Boolean!
    message: String!
  }

  type DepositMethod {
    id: ID!
    code: String!
    nameTh: String!
    description: String
    minAmount: Float
    maxAmount: Float
    bankName: String
    bankAccountNo: String
    bankAccountName: String
    qrImageUrl: String
    isActive: Boolean!
    displayOrder: Int!
  }

  type CreditTransaction {
    id: ID!
    userId: ID!
    type: String!
    amount: Float!
    direction: String!
    balanceBefore: Float!
    balanceAfter: Float!
    refType: String
    refId: String
    status: String!
    note: String
    createdAt: String!
  }

  type Deposit {
    id: ID!
    userId: ID!
    amount: Float!
    method: String!
    bankName: String
    bankAccountNo: String
    bankAccountName: String
    transferAt: String
    slipImageUrl: String
    note: String
    adminNote: String
    status: String!
    approvedBy: ID
    approvedAt: String
    rejectReason: String
    createdAt: String!
  }

  type AdminDeposit {
    id: ID!
    userId: ID!
    userPhone: String
    userName: String
    amount: Float!
    method: String!
    bankName: String
    bankAccountNo: String
    bankAccountName: String
    transferAt: String
    slipImageUrl: String
    note: String
    adminNote: String
    status: String!
    approvedBy: ID
    approvedAt: String
    createdAt: String!
  }

  type AdminDepositsResult {
    total: Int!
    items: [AdminDeposit!]!
  }

  input AdminDepositFilterInput {
    status: String
    userPhone: String
    dateFrom: String
    dateTo: String
  }

  type Withdrawal {
    id: ID!
    userId: ID!
    amount: Float!
    bankName: String!
    bankAccountNo: String!
    bankAccountName: String!
    note: String
    status: String!
    approvedBy: ID
    approvedAt: String
    adminNote: String
    rejectReason: String
    adminAttachmentUrl: String
    createdAt: String!
  }

  type AdminWithdrawal {
    id: ID!
    userId: ID!
    userPhone: String
    userName: String
    amount: Float!
    bankName: String!
    bankAccountNo: String!
    bankAccountName: String!
    note: String
    status: String!
    approvedAt: String
    adminNote: String
    rejectReason: String
    adminAttachmentUrl: String
    createdAt: String!
  }

  input CreateDepositInput {
    amount: Float!
    method: String
    bankName: String
    bankAccountNo: String
    bankAccountName: String
    transferAt: String
    slipImageUrl: String
    note: String
  }

  input CreateWithdrawalInput {
    amount: Float!
    bankAccountId: ID
    bankName: String!
    bankAccountNo: String!
    bankAccountName: String!
    note: String
  }

  input AdminWithdrawalFilterInput {
    status: String
    userPhone: String
    dateFrom: String
    dateTo: String
  }

  input AdminLogFilterInput {
    action: String
    entityType: String
    userPhone: String
    dateFrom: String
    dateTo: String
  }

  type Mutation {
    createLottoOrder(input: CreateLottoOrderInput!): LottoOrder!
    updateLottoOrder(input: UpdateLottoOrderInput!): LottoOrder!
    deleteLottoOrder(input: DeleteLottoOrderInput!): Boolean!
    login(phone: String!, password: String!): LoginPayload!
    forgotPassword(phone: String!): ForgotPasswordPayload!
    approveSlip(orderId: ID!): AdminSlip!
    
    # Credit System
    createDeposit(input: CreateDepositInput!): Deposit!
    createWithdrawal(input: CreateWithdrawalInput!): Withdrawal!
    approveDeposit(id: ID!, adminNote: String): Deposit!
    rejectDeposit(id: ID!, adminNote: String!): Deposit!
    approveWithdrawal(id: ID!, adminNote: String, adminAttachmentUrl: String): Withdrawal!
    rejectWithdrawal(id: ID!, adminNote: String!): Withdrawal!

    # Bank Account Mutations
    createBankAccount(input: CreateBankAccountInput!): UserBankAccount!
    updateBankAccount(id: ID!, input: UpdateBankAccountInput!): UserBankAccount!
    deleteBankAccount(id: ID!): Boolean!
    setDefaultBankAccount(id: ID!): Boolean!
  }

  # Bank Account Input Types
  input CreateBankAccountInput {
    accountName: String!
    bankName: String!
    accountNumber: String!
  }

  input UpdateBankAccountInput {
    accountName: String
    bankName: String
    accountNumber: String
  }
`;
