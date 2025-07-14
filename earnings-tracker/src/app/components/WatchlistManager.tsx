'use client'

import { useState, useEffect } from 'react'
import { UserWatchlist, WatchlistStock } from '@/app/types'

interface WatchlistManagerProps {
  onWatchlistSelect?: (watchlistId: string | null) => void
  onStockAdded?: () => void
}

export default function WatchlistManager({ onWatchlistSelect, onStockAdded }: WatchlistManagerProps) {
  const [watchlists, setWatchlists] = useState<UserWatchlist[]>([])
  const [selectedWatchlist, setSelectedWatchlist] = useState<string | null>(null)
  const [watchlistStocks, setWatchlistStocks] = useState<WatchlistStock[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newWatchlistName, setNewWatchlistName] = useState('')
  const [newStockTicker, setNewStockTicker] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingStock, setAddingStock] = useState(false)

  // Fetch watchlists
  useEffect(() => {
    fetchWatchlists()
  }, [])

  // Fetch stocks when watchlist changes
  useEffect(() => {
    if (selectedWatchlist) {
      fetchWatchlistStocks(selectedWatchlist)
    }
  }, [selectedWatchlist])

  const fetchWatchlists = async () => {
    try {
      const response = await fetch('/api/watchlists')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch watchlists')
      }
      
      setWatchlists(data.data || [])
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch watchlists')
    } finally {
      setLoading(false)
    }
  }

  const fetchWatchlistStocks = async (watchlistId: string) => {
    try {
      const response = await fetch(`/api/watchlists/${watchlistId}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch watchlist stocks')
      }
      
      setWatchlistStocks(data.data.stocks || [])
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch stocks')
    }
  }

  const createWatchlist = async () => {
    if (!newWatchlistName.trim()) return

    try {
      const response = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWatchlistName })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create watchlist')
      }
      
      setWatchlists([...watchlists, data.data])
      setNewWatchlistName('')
      setIsCreating(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create watchlist')
    }
  }

  const deleteWatchlist = async (id: string) => {
    if (!confirm('Are you sure you want to delete this watchlist?')) return

    try {
      const response = await fetch(`/api/watchlists/${id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete watchlist')
      }
      
      setWatchlists(watchlists.filter(w => w.id !== id))
      if (selectedWatchlist === id) {
        setSelectedWatchlist(null)
        setWatchlistStocks([])
        onWatchlistSelect?.(null)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete watchlist')
    }
  }

  const addStock = async () => {
    if (!selectedWatchlist || !newStockTicker.trim()) return

    setAddingStock(true)
    setError(null)

    try {
      const response = await fetch(`/api/watchlists/${selectedWatchlist}/stocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: newStockTicker })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add stock')
      }
      
      setWatchlistStocks([...watchlistStocks, data.data])
      setNewStockTicker('')
      
      // Notify parent component to refresh earnings data immediately
      if (onStockAdded) {
        onStockAdded()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add stock')
    } finally {
      setAddingStock(false)
    }
  }

  const removeStock = async (ticker: string) => {
    if (!selectedWatchlist) return

    try {
      const response = await fetch(
        `/api/watchlists/${selectedWatchlist}/stocks?ticker=${ticker}`,
        { method: 'DELETE' }
      )
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove stock')
      }
      
      setWatchlistStocks(watchlistStocks.filter(s => s.company?.ticker !== ticker))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to remove stock')
    }
  }

  const handleWatchlistSelect = (id: string) => {
    setSelectedWatchlist(id)
    onWatchlistSelect?.(id)
  }

  if (loading) {
    return <div className="p-4">Loading watchlists...</div>
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <h2 className="text-2xl font-bold mb-4 text-foreground">Watchlists</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded border border-destructive">
          {error}
        </div>
      )}

      {/* Watchlist List */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-foreground">My Watchlists</h3>
          <button
            onClick={() => setIsCreating(true)}
            className="btn-accent text-sm"
          >
            New Watchlist
          </button>
        </div>

        {isCreating && (
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newWatchlistName}
              onChange={(e) => setNewWatchlistName(e.target.value)}
              placeholder="Watchlist name"
              className="flex-1 input"
              onKeyPress={(e) => e.key === 'Enter' && createWatchlist()}
            />
            <button
              onClick={createWatchlist}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreating(false)
                setNewWatchlistName('')
              }}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="space-y-2">
          {watchlists.map(watchlist => (
            <div
              key={watchlist.id}
              className={`flex justify-between items-center p-3 rounded cursor-pointer border transition-all ${
                selectedWatchlist === watchlist.id
                  ? 'bg-gradient-to-r from-primary/20 to-secondary/20 border-primary shadow-md shadow-primary/20'
                  : 'bg-muted/50 hover:bg-accent/50 border-border hover:border-accent'
              }`}
            >
              <span
                onClick={() => handleWatchlistSelect(watchlist.id)}
                className="flex-1"
              >
                {watchlist.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteWatchlist(watchlist.id)
                }}
                className="text-destructive hover:text-destructive/80 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          ))}
          
          {watchlists.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              No watchlists yet. Create one to get started!
            </p>
          )}
        </div>
      </div>

      {/* Selected Watchlist Stocks */}
      {selectedWatchlist && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-foreground">
            Stocks in {watchlists.find(w => w.id === selectedWatchlist)?.name}
          </h3>

          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newStockTicker}
              onChange={(e) => setNewStockTicker(e.target.value.toUpperCase())}
              placeholder="Enter ticker symbol"
              className="flex-1 input"
              onKeyPress={(e) => e.key === 'Enter' && !addingStock && addStock()}
              disabled={addingStock}
            />
            <button
              onClick={addStock}
              disabled={addingStock}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addingStock ? 'Adding...' : 'Add Stock'}
            </button>
          </div>

          <div className="space-y-2">
            {watchlistStocks.map(stock => (
              <div
                key={stock.id}
                className="flex justify-between items-center p-3 bg-muted/50 rounded border border-border"
              >
                <div>
                  <span className="font-semibold">{stock.company?.ticker}</span>
                  <span className="ml-2 text-muted-foreground">
                    {stock.company?.company_name}
                  </span>
                </div>
                <button
                  onClick={() => removeStock(stock.company?.ticker || '')}
                  className="text-destructive hover:text-destructive/80 transition-colors font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
            
            {watchlistStocks.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                No stocks in this watchlist yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}