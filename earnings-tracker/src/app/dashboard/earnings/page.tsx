'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import EarningsDataGrid from '@/app/components/EarningsDataGrid'
import WatchlistManager from '@/app/components/WatchlistManager'
import { EarningsGridData } from '@/app/types'
import { createClient } from '@/app/lib/supabase-browser'

export default function EarningsDashboard() {
  const [earningsData, setEarningsData] = useState<EarningsGridData[]>([])
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasWatchlists, setHasWatchlists] = useState(true)
  const [watchlists, setWatchlists] = useState<any[]>([])
  const [dateFilter, setDateFilter] = useState(() => {
    // Calculate dates consistently on both server and client
    const today = new Date()
    const oneHundredTwentyDaysLater = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000)
    return {
      startDate: today.toISOString().split('T')[0],
      endDate: oneHundredTwentyDaysLater.toISOString().split('T')[0]
    }
  })
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndWatchlists()
  }, [])

  useEffect(() => {
    if (selectedWatchlistId) {
      fetchEarningsData()
    }
  }, [selectedWatchlistId, dateFilter])

  const checkAuthAndWatchlists = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    // Check if user has any watchlists
    try {
      const response = await fetch('/api/watchlists')
      const data = await response.json()
      
      if (response.ok && data.data) {
        setWatchlists(data.data)
        if (data.data.length === 0) {
          setHasWatchlists(false)
          setLoading(false)
        } else {
          setHasWatchlists(true)
          // Try to get saved preference for selected watchlist
          const prefResponse = await fetch('/api/user/preferences?key=selectedWatchlistId')
          const prefData = await prefResponse.json()
          
          if (prefData.data && data.data.some((w: any) => w.id === prefData.data)) {
            setSelectedWatchlistId(prefData.data)
          } else {
            // Select first watchlist if no preference or preference not found
            setSelectedWatchlistId(data.data[0].id)
            // Save this as the new preference
            await fetch('/api/user/preferences', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: 'selectedWatchlistId', value: data.data[0].id })
            })
          }
        }
      }
    } catch (err) {
      console.error('Error checking watchlists:', err)
    }
  }

  const fetchEarningsData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get current user
      const { data: { session } } = await supabase.auth.getSession()
      
      // Call the database function using RPC
      const { data, error: fetchError } = await supabase.rpc('get_earnings_grid_data', {
        p_user_id: session?.user?.id || null,
        p_watchlist_id: selectedWatchlistId,
        p_start_date: dateFilter.startDate || null,
        p_end_date: dateFilter.endDate || null
      })

      if (fetchError) {
        throw fetchError
      }

      console.log('Earnings data received:', data?.length || 0, 'records')
      setEarningsData(data || [])
    } catch (err) {
      console.error('Error fetching earnings data:', err)
      setError('Failed to load earnings data')
    } finally {
      setLoading(false)
    }
  }

  const handleWatchlistSelect = async (watchlistId: string | null) => {
    setSelectedWatchlistId(watchlistId)
    if (watchlistId) {
      // Save preference
      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'selectedWatchlistId', value: watchlistId })
      })
    }
  }

  const handleWatchlistCreated = () => {
    setHasWatchlists(true)
    checkAuthAndWatchlists()
  }

  const refreshData = async () => {
    console.log('Refreshing earnings data...')
    setLoading(true)
    await fetchEarningsData()
  }

  // Show onboarding if user has no watchlists
  if (!loading && !hasWatchlists) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <div className="max-w-4xl mx-auto mt-20">
          <div className="bg-card rounded-lg shadow-lg border border-border p-12 text-center">
            <h1 className="text-4xl font-bold mb-4 text-foreground">Welcome to Earnings Tracker</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Get started by creating your first watchlist to track earnings for your favorite stocks.
            </p>
            <div className="bg-muted/50 rounded-lg p-6 mb-8">
              <h2 className="text-2xl font-semibold mb-4">How it works:</h2>
              <ul className="text-left max-w-2xl mx-auto space-y-3">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Create watchlists to organize your stocks (e.g., "Tech Stocks", "Dividend Portfolio")</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Add stocks to your watchlists to track their earnings dates and estimates</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>View real-time earnings data with historical EPS from SEC filings</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Export your data or use advanced filtering to find what you need</span>
                </li>
              </ul>
            </div>
            <div className="max-w-md mx-auto">
              <WatchlistManager 
                onWatchlistSelect={handleWatchlistSelect}
                onStockAdded={handleWatchlistCreated}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Earnings Tracker</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar with Watchlists */}
          <div className="lg:col-span-1">
            <WatchlistManager 
              onWatchlistSelect={handleWatchlistSelect}
              onStockAdded={refreshData}
            />
            
            {/* Date Filters */}
            <div className="bg-card rounded-lg shadow-sm border border-border p-6 mt-6">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Date Range</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateFilter.startDate}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full input"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateFilter.endDate}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full input"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {selectedWatchlistId ? (
              <div className="bg-card rounded-lg shadow-sm border border-border p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-foreground">
                    {watchlists.find(w => w.id === selectedWatchlistId)?.name || 'Watchlist'} Earnings
                  </h2>
                  <button
                    onClick={refreshData}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                  >
                    Refresh Data
                  </button>
                </div>
                
                {error && (
                  <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded border border-destructive">
                    {error}
                  </div>
                )}
                
                {loading ? (
                  <div className="space-y-4">
                    <div className="animate-pulse">
                      <div className="h-8 bg-muted/50 rounded w-1/4 mb-4"></div>
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="h-16 bg-muted/50 rounded"></div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : earningsData.length > 0 ? (
                  <EarningsDataGrid data={earningsData} />
                ) : (
                  <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                      <p className="text-xl text-muted-foreground mb-2">No earnings data found</p>
                      <p className="text-sm text-muted-foreground">Add stocks to this watchlist to see their earnings data</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-lg shadow-sm border border-border p-6">
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <p className="text-xl text-muted-foreground mb-4">Select a watchlist to view earnings data</p>
                    <p className="text-sm text-muted-foreground">Choose from your watchlists on the left to get started</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}