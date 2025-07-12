const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY!
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query'

interface EarningsData {
  symbol: string
  reportedDate: string
  reportedEPS: string
  estimatedEPS: string
  surprise: string
  surprisePercentage: string
}

interface CompanyOverview {
  Symbol: string
  Name: string
  Description: string
  Exchange: string
  Currency: string
  Country: string
  Sector: string
  Industry: string
  Address: string
  MarketCapitalization: string
  PERatio: string
  DividendYield: string
  EPS: string
  RevenuePerShareTTM: string
  ProfitMargin: string
  [key: string]: string
}

export class AlphaVantageAPI {
  private static instance: AlphaVantageAPI
  private apiKey: string
  private requestCount: number = 0
  private lastRequestTime: number = 0

  private constructor() {
    this.apiKey = ALPHA_VANTAGE_API_KEY
  }

  static getInstance(): AlphaVantageAPI {
    if (!AlphaVantageAPI.instance) {
      AlphaVantageAPI.instance = new AlphaVantageAPI()
    }
    return AlphaVantageAPI.instance
  }

  private async rateLimitedFetch(url: string): Promise<Response> {
    // Alpha Vantage free tier: 5 API requests per minute
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (this.requestCount >= 5 && timeSinceLastRequest < 60000) {
      const waitTime = 60000 - timeSinceLastRequest
      await new Promise(resolve => setTimeout(resolve, waitTime))
      this.requestCount = 0
    }

    this.lastRequestTime = Date.now()
    this.requestCount++

    return fetch(url)
  }

  async getEarningsHistory(symbol: string): Promise<EarningsData[]> {
    try {
      const url = `${ALPHA_VANTAGE_BASE_URL}?function=EARNINGS&symbol=${symbol}&apikey=${this.apiKey}`
      const response = await this.rateLimitedFetch(url)

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.statusText}`)
      }

      const data = await response.json()

      if (data['Error Message']) {
        throw new Error(data['Error Message'])
      }

      if (data['Note']) {
        throw new Error('API rate limit reached. Please try again later.')
      }

      const quarterlyEarnings = data.quarterlyEarnings || []
      return quarterlyEarnings.map((earning: any) => ({
        symbol: symbol,
        reportedDate: earning.reportedDate,
        reportedEPS: earning.reportedEPS,
        estimatedEPS: earning.estimatedEPS,
        surprise: earning.surprise,
        surprisePercentage: earning.surprisePercentage,
      }))
    } catch (error) {
      console.error('Error fetching earnings history:', error)
      throw error
    }
  }

  async getCompanyOverview(symbol: string): Promise<CompanyOverview> {
    try {
      const url = `${ALPHA_VANTAGE_BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${this.apiKey}`
      const response = await this.rateLimitedFetch(url)

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.statusText}`)
      }

      const data = await response.json()

      if (data['Error Message']) {
        throw new Error(data['Error Message'])
      }

      if (data['Note']) {
        throw new Error('API rate limit reached. Please try again later.')
      }

      return data as CompanyOverview
    } catch (error) {
      console.error('Error fetching company overview:', error)
      throw error
    }
  }

  async getEarningsCalendar(): Promise<any[]> {
    try {
      const url = `${ALPHA_VANTAGE_BASE_URL}?function=EARNINGS_CALENDAR&apikey=${this.apiKey}`
      const response = await this.rateLimitedFetch(url)

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.statusText}`)
      }

      // Alpha Vantage returns CSV for earnings calendar
      const csvText = await response.text()
      
      // Parse CSV
      const lines = csvText.split('\n')
      const headers = lines[0].split(',')
      const results = []

      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(',')
          const entry: any = {}
          headers.forEach((header, index) => {
            entry[header.trim()] = values[index]?.trim() || ''
          })
          results.push(entry)
        }
      }

      return results
    } catch (error) {
      console.error('Error fetching earnings calendar:', error)
      throw error
    }
  }
}