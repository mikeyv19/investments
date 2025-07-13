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
  const [dateFilter, setDateFilter] = useState(() => {
    // Calculate dates consistently on both server and client
    const today = new Date()
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    return {
      startDate: today.toISOString().split('T')[0],
      endDate: thirtyDaysLater.toISOString().split('T')[0]
    }
  })
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    fetchEarningsData()
  }, [selectedWatchlistId, dateFilter])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
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

      setEarningsData(data || [])
    } catch (err) {
      console.error('Error fetching earnings data:', err)
      setError('Failed to load earnings data')
    } finally {
      setLoading(false)
    }
  }

  const refreshData = async () => {
    await fetchEarningsData()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Earnings Tracker</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar with Watchlists */}
          <div className="lg:col-span-1">
            <WatchlistManager onWatchlistSelect={setSelectedWatchlistId} />
            
            {/* Date Filters */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h3 className="text-lg font-semibold mb-4">Date Range</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateFilter.startDate}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateFilter.endDate}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  {selectedWatchlistId ? 'Watchlist Earnings' : 'All Earnings'}
                </h2>
                <button
                  onClick={refreshData}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Refresh Data
                </button>
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                  {error}
                </div>
              )}
              
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-gray-500">Loading earnings data...</div>
                </div>
              ) : (
                <EarningsDataGrid data={earningsData} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}