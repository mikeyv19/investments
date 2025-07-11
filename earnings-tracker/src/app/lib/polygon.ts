const POLYGON_API_KEY = process.env.POLYGON_API_KEY!
const POLYGON_BASE_URL = 'https://api.polygon.io'

interface PolygonStock {
  ticker: string
  name: string
  market: string
  locale: string
  primary_exchange: string
  type: string
  active: boolean
  currency_name: string
  cik?: string
  composite_figi?: string
  share_class_figi?: string
  last_updated_utc: string
}

interface PolygonTickersResponse {
  results: PolygonStock[]
  status: string
  request_id: string
  count: number
  next_url?: string
}

export class PolygonAPI {
  private static instance: PolygonAPI
  private apiKey: string

  private constructor() {
    this.apiKey = POLYGON_API_KEY
  }

  static getInstance(): PolygonAPI {
    if (!PolygonAPI.instance) {
      PolygonAPI.instance = new PolygonAPI()
    }
    return PolygonAPI.instance
  }

  async searchStocks(query: string): Promise<PolygonStock[]> {
    try {
      const response = await fetch(
        `${POLYGON_BASE_URL}/v3/reference/tickers?search=${encodeURIComponent(
          query
        )}&active=true&limit=10&apiKey=${this.apiKey}`
      )

      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.statusText}`)
      }

      const data: PolygonTickersResponse = await response.json()
      return data.results || []
    } catch (error) {
      console.error('Error searching stocks:', error)
      throw error
    }
  }

  async getStockDetails(ticker: string) {
    try {
      const response = await fetch(
        `${POLYGON_BASE_URL}/v3/reference/tickers/${ticker}?apiKey=${this.apiKey}`
      )

      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.results
    } catch (error) {
      console.error('Error getting stock details:', error)
      throw error
    }
  }

  async getMarketStatus() {
    try {
      const response = await fetch(
        `${POLYGON_BASE_URL}/v1/marketstatus/now?apiKey=${this.apiKey}`
      )

      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting market status:', error)
      throw error
    }
  }
}