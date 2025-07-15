'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import EarningsDataGrid from '@/app/components/EarningsDataGrid'
import WatchlistManager from '@/app/components/WatchlistManager'
import RefreshProgressModal from '@/app/components/RefreshProgressModal'
import { EarningsGridData } from '@/app/types'
import { createClient } from '@/app/lib/supabase-browser'
import { useConfirmation } from '@/app/components/ui/confirmation-dialog'
import { EmptyState } from '@/app/components/ui/empty-state'
import { TrendingUp, CalendarDays } from 'lucide-react'
import { DataGridSkeleton } from '@/app/components/ui/skeleton'

export default function EarningsDashboard() {
  const { confirm } = useConfirmation()
  const [earningsData, setEarningsData] = useState<EarningsGridData[]>([])
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasWatchlists, setHasWatchlists] = useState(true)
  const [watchlists, setWatchlists] = useState<{ id: string; name: string }[]>([])
  const [refreshModal, setRefreshModal] = useState({
    isOpen: false,
    totalStocks: 0,
    currentStock: 0,
    currentTicker: '',
    isComplete: false,
    errors: [] as string[]
  })
  const cancelRefreshRef = useRef(false)
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedWatchlistId) {
      fetchEarningsData()
    }
  }, [selectedWatchlistId, dateFilter]) // eslint-disable-line react-hooks/exhaustive-deps

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
          
          if (prefData.data && data.data.some((w: { id: string }) => w.id === prefData.data)) {
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

  const refreshAllStocks = async () => {
    if (!selectedWatchlistId || earningsData.length === 0) return

    // Get unique tickers from earnings data
    const uniqueTickers = [...new Set(earningsData.map(d => d.ticker))]
    
    // Show warning modal - estimate 45 seconds per stock for user expectation
    const estimatedSeconds = uniqueTickers.length * 45
    const hours = Math.floor(estimatedSeconds / 3600)
    const minutes = Math.floor((estimatedSeconds % 3600) / 60)
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`
    
    const confirmed = await confirm({
      title: 'Refresh All Data?',
      description: `This will refresh data for all ${uniqueTickers.length} stocks in this watchlist.\n\nEstimated time: ${timeStr}`,
      confirmText: 'Start Refresh',
      icon: 'info'
    })

    if (!confirmed) return

    // Reset cancel flag
    cancelRefreshRef.current = false

    // Initialize modal state
    setRefreshModal({
      isOpen: true,
      totalStocks: uniqueTickers.length,
      currentStock: 0,
      currentTicker: '',
      isComplete: false,
      errors: []
    })

    const errors: string[] = []

    // Iterate through each stock with delay
    for (let i = 0; i < uniqueTickers.length; i++) {
      // Check if cancelled
      if (cancelRefreshRef.current) {
        setRefreshModal(prev => ({
          ...prev,
          isComplete: true,
          errors: [...prev.errors, '⚠️ Refresh cancelled by user']
        }))
        break
      }

      const ticker = uniqueTickers[i]

      // Update modal progress
      setRefreshModal(prev => ({
        ...prev,
        currentStock: i + 1,
        currentTicker: ticker
      }))

      try {
        // Call the refresh endpoint
        const response = await fetch(`/api/companies/${ticker}/refresh`, {
          method: 'POST'
        })

        if (!response.ok) {
          const data = await response.json()
          errors.push(`${ticker}: ${data.error || 'Failed to refresh'}`)
        }
      } catch (err) {
        errors.push(`${ticker}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }

      // Wait 1 second between requests (except for the last one or if cancelled)
      if (i < uniqueTickers.length - 1 && !cancelRefreshRef.current) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Mark as complete if not already cancelled
    if (!cancelRefreshRef.current) {
      setRefreshModal(prev => ({
        ...prev,
        isComplete: true,
        errors
      }))
    }

    // Refresh the earnings data if any succeeded
    if (errors.length < uniqueTickers.length) {
      await refreshData()
    }
  }

  const handleCancelRefresh = () => {
    cancelRefreshRef.current = true
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
          <div className="bg-card rounded-lg shadow-lg border border-border p-12">
            <EmptyState
              icon={TrendingUp}
              title="Welcome to Earnings Tracker"
              description="Track upcoming earnings dates for your favorite stocks. Create your first watchlist to get started!"
              className="py-0"
            />
            <div className="bg-muted/50 rounded-lg p-6 mb-8 mt-8">
              <h2 className="text-2xl font-semibold mb-4">How it works:</h2>
              <ul className="text-left max-w-2xl mx-auto space-y-3">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Create watchlists to organize your stocks (e.g., &quot;Tech Stocks&quot;, &quot;Dividend Portfolio&quot;)</span>
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
                selectedWatchlistId={selectedWatchlistId}
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
              selectedWatchlistId={selectedWatchlistId}
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
                  <div className="flex gap-2">
                    {earningsData.length > 0 && (
                      <button
                        onClick={refreshAllStocks}
                        className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors flex items-center gap-2"
                        title="Refresh all stocks in this watchlist"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh All
                      </button>
                    )}
                    <button
                      onClick={refreshData}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                    >
                      Refresh View
                    </button>
                  </div>
                </div>
                
                {error && (
                  <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded border border-destructive">
                    {error}
                  </div>
                )}
                
                {loading ? (
                  <DataGridSkeleton />
                ) : earningsData.length > 0 ? (
                  <EarningsDataGrid data={earningsData} />
                ) : (
                  <div className="flex justify-center items-center h-64">
                    <EmptyState
                      icon={CalendarDays}
                      title="No earnings data found"
                      description="Add stocks to this watchlist to see their upcoming earnings"
                    />
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

      {/* Refresh Progress Modal */}
      <RefreshProgressModal
        isOpen={refreshModal.isOpen}
        onClose={() => setRefreshModal(prev => ({ ...prev, isOpen: false }))}
        onCancel={handleCancelRefresh}
        totalStocks={refreshModal.totalStocks}
        currentStock={refreshModal.currentStock}
        currentTicker={refreshModal.currentTicker}
        isComplete={refreshModal.isComplete}
        errors={refreshModal.errors}
      />
    </div>
  )
}