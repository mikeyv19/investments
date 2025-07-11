import { supabase } from './supabase'

interface CacheEntry {
  key: string
  value: any
  expires_at: string
  created_at: string
}

export class CacheManager {
  private static instance: CacheManager
  private memoryCache: Map<string, { value: any; expiresAt: number }> = new Map()

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  // Memory cache methods
  setMemory(key: string, value: any, ttlSeconds: number = 300): void {
    const expiresAt = Date.now() + ttlSeconds * 1000
    this.memoryCache.set(key, { value, expiresAt })
  }

  getMemory(key: string): any | null {
    const cached = this.memoryCache.get(key)
    if (!cached) return null

    if (Date.now() > cached.expiresAt) {
      this.memoryCache.delete(key)
      return null
    }

    return cached.value
  }

  clearMemory(): void {
    this.memoryCache.clear()
  }

  // Database cache methods
  async setDatabase(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
      
      const { error } = await supabase
        .from('api_cache')
        .upsert({
          key,
          value: JSON.stringify(value),
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        })

      if (error) throw error
    } catch (error) {
      console.error('Error setting database cache:', error)
      throw error
    }
  }

  async getDatabase(key: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('api_cache')
        .select('*')
        .eq('key', key)
        .single()

      if (error || !data) return null

      const now = new Date()
      const expiresAt = new Date(data.expires_at)

      if (now > expiresAt) {
        // Clean up expired entry
        await this.deleteDatabase(key)
        return null
      }

      return JSON.parse(data.value)
    } catch (error) {
      console.error('Error getting database cache:', error)
      return null
    }
  }

  async deleteDatabase(key: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('api_cache')
        .delete()
        .eq('key', key)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting database cache:', error)
      throw error
    }
  }

  async cleanupExpired(): Promise<void> {
    try {
      const now = new Date().toISOString()
      
      const { error } = await supabase
        .from('api_cache')
        .delete()
        .lt('expires_at', now)

      if (error) throw error
    } catch (error) {
      console.error('Error cleaning up expired cache:', error)
      throw error
    }
  }

  // Combined cache methods (memory + database)
  async get(key: string): Promise<any | null> {
    // Check memory cache first
    const memoryValue = this.getMemory(key)
    if (memoryValue !== null) return memoryValue

    // Check database cache
    const dbValue = await this.getDatabase(key)
    if (dbValue !== null) {
      // Store in memory cache for faster subsequent access
      this.setMemory(key, dbValue, 300) // 5 minutes in memory
      return dbValue
    }

    return null
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    // Set in both memory and database
    this.setMemory(key, value, Math.min(ttlSeconds, 300)) // Max 5 minutes in memory
    await this.setDatabase(key, value, ttlSeconds)
  }

  // Cache key generators
  static generateKey(...parts: string[]): string {
    return parts.join(':')
  }

  static stockSearchKey(query: string): string {
    return CacheManager.generateKey('stock', 'search', query.toLowerCase())
  }

  static stockDetailsKey(ticker: string): string {
    return CacheManager.generateKey('stock', 'details', ticker.toUpperCase())
  }

  static earningsHistoryKey(symbol: string): string {
    return CacheManager.generateKey('earnings', 'history', symbol.toUpperCase())
  }

  static companyOverviewKey(symbol: string): string {
    return CacheManager.generateKey('company', 'overview', symbol.toUpperCase())
  }

  static earningsCalendarKey(date?: string): string {
    const dateKey = date || new Date().toISOString().split('T')[0]
    return CacheManager.generateKey('earnings', 'calendar', dateKey)
  }
}

// Export singleton instance
export const cache = CacheManager.getInstance()