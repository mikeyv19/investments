// Database types
export interface Stock {
  id: string
  ticker: string
  name: string
  exchange: string
  currency: string
  created_at: string
  updated_at: string
}

export interface EarningsReport {
  id: string
  stock_id: string
  report_date: string
  reported_eps: number | null
  estimated_eps: number | null
  surprise: number | null
  surprise_percentage: number | null
  created_at: string
}

export interface TrackedStock {
  id: string
  user_id: string
  stock_id: string
  created_at: string
  stock?: Stock
}

export interface User {
  id: string
  email: string
  created_at: string
}

// API response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

// Search types
export interface StockSearchResult {
  ticker: string
  name: string
  exchange: string
  type: string
  active: boolean
}

// Earnings types
export interface EarningsData {
  symbol: string
  reportedDate: string
  reportedEPS: string
  estimatedEPS: string
  surprise: string
  surprisePercentage: string
}

export interface EarningsCalendarEntry {
  symbol: string
  name: string
  reportDate: string
  fiscalDateEnding: string
  estimate: string
  currency: string
}

// Company types
export interface CompanyOverview {
  symbol: string
  name: string
  description: string
  exchange: string
  currency: string
  country: string
  sector: string
  industry: string
  marketCapitalization: string
  peRatio: string
  dividendYield: string
  eps: string
  revenuePerShareTTM: string
  profitMargin: string
}

// Request types
export interface SearchStocksRequest {
  query: string
  limit?: number
}

export interface AddTrackedStockRequest {
  ticker: string
}

export interface GetEarningsHistoryRequest {
  symbol: string
  limit?: number
}

// Response status types
export enum ApiStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  LOADING = 'loading',
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

// Utility types
export type SortOrder = 'asc' | 'desc'

export interface SortConfig {
  field: string
  order: SortOrder
}

export interface FilterConfig {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'
  value: any
}

// Chart types
export interface ChartDataPoint {
  date: string
  value: number
  label?: string
}

export interface EarningsChartData {
  dates: string[]
  reportedEPS: number[]
  estimatedEPS: number[]
  surprises: number[]
}