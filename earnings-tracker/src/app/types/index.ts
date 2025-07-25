// Database types based on Project Plan schema

// Companies table
export interface Company {
  id: string
  ticker: string
  company_name: string
  created_at: string
}

// User watchlists
export interface UserWatchlist {
  id: string
  user_id: string
  name: string // e.g., "Tech Stocks", "My Favorites"
  created_at: string
  updated_at: string
  stock_count?: { count: number }[]
}

// Watchlist stocks (junction table)
export interface WatchlistStock {
  id: string
  watchlist_id: string
  company_id: string
  added_at: string
  // Relations
  company?: Company
  watchlist?: UserWatchlist
}

// Historical EPS data from SEC
export interface HistoricalEPS {
  id: string
  company_id: string
  fiscal_period: string // e.g., "Q1 2024"
  eps_actual: number
  filing_date: string
  created_at: string
  // Relations
  company?: Company
}

// Earnings estimates from investor.com scraping
export interface EarningsEstimate {
  id: string
  company_id: string
  earnings_date: string
  earnings_date_range?: string | null // e.g., "Jul 28, 2025 - Aug 1, 2025"
  market_timing: 'before' | 'after' // before or after market
  eps_estimate: number
  last_updated: string
  created_at: string
  // Relations
  company?: Company
}

// User type from Supabase Auth
export interface User {
  id: string
  email: string
  created_at: string
}

// User preferences
export interface UserPreference {
  id: string
  user_id: string
  preference_key: string
  preference_value: unknown
  created_at: string
  updated_at: string
}

// Column visibility preferences
export interface ColumnVisibility {
  ticker: boolean
  company_name: boolean
  earnings_date: boolean
  earnings_time: boolean
  market_timing: boolean
  eps_estimate: boolean
  year_ago_eps: boolean
}

// API response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// Data grid types
export interface EarningsGridData {
  ticker: string
  company_name: string
  earnings_date: string
  earnings_date_range?: string | null // e.g., "Jul 28, 2025 - Aug 1, 2025"
  market_timing: 'before' | 'after' | 'during'
  earnings_time: string | null
  eps_estimate: number | null
  year_ago_eps: number | null
  eps_actual: number | null
  fiscal_period: string
  last_updated: string
}

// Filter and sort types for data grid
export type SortOrder = 'asc' | 'desc'

export interface SortConfig {
  field: keyof EarningsGridData
  order: SortOrder
}

export interface FilterConfig {
  field: keyof EarningsGridData
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'between'
  value: unknown
  value2?: unknown // for 'between' operator
}

export interface GridState {
  page: number
  pageSize: number
  sortBy: SortConfig[]
  filters: FilterConfig[]
  globalSearch?: string
}

// SEC API types
export interface SECCompanyInfo {
  cik: string
  ticker: string
  name: string
  sic: string
  sicDescription: string
  exchanges: string[]
}

export interface SECFiling {
  accessionNumber: string
  filingDate: string
  reportDate: string
  form: string
  primaryDocument: string
  items: unknown[]
}

// Investor.com scraping types
export interface ScrapedEarningsData {
  ticker: string
  companyName: string
  earningsDate: string
  marketTiming: 'before' | 'after'
  epsEstimate: string
  analystCount?: number
}

// Request types
export interface CreateWatchlistRequest {
  name: string
}

export interface AddToWatchlistRequest {
  watchlist_id: string
  ticker: string
}

export interface GetEarningsDataRequest {
  tickers?: string[]
  start_date?: string
  end_date?: string
  watchlist_id?: string
}

// Error types
export class ApiError extends Error {
  constructor(
    public message: string,
    public code?: string,
    public status?: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Utility types for data grid
export interface ExportConfig {
  format: 'csv' | 'excel'
  filename?: string
  columns?: string[]
}

export interface PaginatedResponse<T> {
  data: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}