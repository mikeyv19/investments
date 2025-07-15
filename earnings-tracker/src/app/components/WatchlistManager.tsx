'use client'

import { useState, useEffect } from 'react'
import { UserWatchlist, WatchlistStock } from '@/app/types'
import BulkImportModal from './BulkImportModal'

interface WatchlistManagerProps {
  selectedWatchlistId?: string | null
  onWatchlistSelect?: (watchlistId: string | null) => void
  onStockAdded?: () => void
}

export default function WatchlistManager({ selectedWatchlistId, onWatchlistSelect, onStockAdded }: WatchlistManagerProps) {
  const [watchlists, setWatchlists] = useState<UserWatchlist[]>([])
  const [selectedWatchlist, setSelectedWatchlist] = useState<string | null>(null)
  const [watchlistStocks, setWatchlistStocks] = useState<WatchlistStock[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newWatchlistName, setNewWatchlistName] = useState('')
  const [newStockTicker, setNewStockTicker] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingStock, setAddingStock] = useState(false)
  const [editingWatchlistId, setEditingWatchlistId] = useState<string | null>(null)
  const [editingWatchlistName, setEditingWatchlistName] = useState('')
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set())
  const [bulkImportProgress, setBulkImportProgress] = useState<{importing: boolean, current: number, total: number}>({
    importing: false,
    current: 0,
    total: 0
  })

  // Fetch watchlists
  useEffect(() => {
    fetchWatchlists()
  }, [])

  // Set selected watchlist from props
  useEffect(() => {
    if (selectedWatchlistId && selectedWatchlist !== selectedWatchlistId) {
      setSelectedWatchlist(selectedWatchlistId)
    }
  }, [selectedWatchlistId, selectedWatchlist])

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

  const renameWatchlist = async (id: string, newName: string) => {
    if (!newName.trim()) return

    try {
      const response = await fetch(`/api/watchlists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to rename watchlist')
      }
      
      setWatchlists(watchlists.map(w => w.id === id ? { ...w, name: newName } : w))
      setEditingWatchlistId(null)
      setEditingWatchlistName('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to rename watchlist')
    }
  }

  const deleteWatchlist = async (id: string) => {
    const watchlist = watchlists.find(w => w.id === id)
    const stockCount = watchlist?.stock_count?.[0]?.count || 0
    const message = stockCount > 0 
      ? `Are you sure you want to delete this watchlist? This will remove ${stockCount} stock(s) from this watchlist only. Stocks will remain in other watchlists.`
      : 'Are you sure you want to delete this watchlist?'
    
    if (!confirm(message)) return

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
      
      // Notify parent component to refresh earnings data
      if (onStockAdded) {
        onStockAdded()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to remove stock')
    }
  }

  const handleWatchlistSelect = (id: string) => {
    setSelectedWatchlist(id)
    onWatchlistSelect?.(id)
    setSelectedStocks(new Set()) // Clear selections when switching watchlists
  }

  const toggleStockSelection = (ticker: string) => {
    const newSelected = new Set(selectedStocks)
    if (newSelected.has(ticker)) {
      newSelected.delete(ticker)
    } else {
      newSelected.add(ticker)
    }
    setSelectedStocks(newSelected)
  }

  const bulkRemoveStocks = async () => {
    if (selectedStocks.size === 0 || !selectedWatchlist) return

    const confirmed = confirm(`Remove ${selectedStocks.size} selected stock(s) from this watchlist?`)
    if (!confirmed) return

    for (const ticker of selectedStocks) {
      await removeStock(ticker)
    }
    setSelectedStocks(new Set())
    
    // Note: removeStock already calls onStockAdded, so the refresh will happen automatically
  }

  const handleBulkImport = async (tickers: string[]) => {
    if (!selectedWatchlist) return

    setBulkImportProgress({ importing: true, current: 0, total: tickers.length })
    setError(null)
    const errors: string[] = []

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i]
      setBulkImportProgress({ importing: true, current: i + 1, total: tickers.length })

      try {
        const response = await fetch(`/api/watchlists/${selectedWatchlist}/stocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker })
        })
        
        if (!response.ok) {
          const data = await response.json()
          if (!data.error?.includes('already exists')) {
            errors.push(`${ticker}: ${data.error || 'Failed to add'}`)
          }
        }
      } catch (err) {
        errors.push(`${ticker}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    setBulkImportProgress({ importing: false, current: 0, total: 0 })
    
    if (errors.length > 0) {
      setError(`Failed to import ${errors.length} stocks. ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`)
    } else {
      // Refresh the watchlist stocks
      await fetchWatchlistStocks(selectedWatchlist)
      if (onStockAdded) {
        onStockAdded()
      }
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Watchlists</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-12 bg-muted/50 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
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
            className="text-xs px-2 py-1 text-primary hover:bg-primary/10 rounded transition-colors"
          >
            + New
          </button>
        </div>

        {isCreating && (
          <div className="mb-3">
            <input
              type="text"
              value={newWatchlistName}
              onChange={(e) => setNewWatchlistName(e.target.value)}
              placeholder="Watchlist name"
              className="w-full mb-2 input text-sm"
              onKeyPress={(e) => e.key === 'Enter' && createWatchlist()}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={createWatchlist}
                className="flex-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false)
                  setNewWatchlistName('')
                }}
                className="flex-1 px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {watchlists.map(watchlist => {
            const stockCount = watchlist.stock_count?.[0]?.count || 0
            const isEditing = editingWatchlistId === watchlist.id
            
            return (
              <div
                key={watchlist.id}
                className={`flex items-center p-3 rounded border transition-all ${
                  selectedWatchlist === watchlist.id
                    ? 'bg-gradient-to-r from-primary/20 to-secondary/20 border-primary shadow-md shadow-primary/20'
                    : 'bg-muted/50 hover:bg-accent/50 border-border hover:border-accent'
                }`}
              >
                <div 
                  className="flex-1 flex items-center gap-2 cursor-pointer"
                  onClick={() => !isEditing && handleWatchlistSelect(watchlist.id)}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingWatchlistName}
                      onChange={(e) => setEditingWatchlistName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          renameWatchlist(watchlist.id, editingWatchlistName)
                        } else if (e.key === 'Escape') {
                          setEditingWatchlistId(null)
                          setEditingWatchlistName('')
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 px-2 py-1 bg-background border border-input rounded text-sm"
                      autoFocus
                    />
                  ) : (
                    <>
                      <span className="flex-1">{watchlist.name}</span>
                      <span className="text-sm text-muted-foreground">({stockCount} stocks)</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          renameWatchlist(watchlist.id, editingWatchlistName)
                        }}
                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingWatchlistId(null)
                          setEditingWatchlistName('')
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingWatchlistId(watchlist.id)
                          setEditingWatchlistName(watchlist.name)
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Rename watchlist"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteWatchlist(watchlist.id)
                        }}
                        className="text-destructive hover:text-destructive/80 transition-colors font-medium text-sm"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          
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
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Stocks in {watchlists.find(w => w.id === selectedWatchlist)?.name}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkImport(true)}
                className="text-sm px-3 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
              >
                Bulk Import
              </button>
              {selectedStocks.size > 0 && (
                <button
                  onClick={bulkRemoveStocks}
                  className="text-sm px-3 py-1 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
                >
                  Remove {selectedStocks.size} Selected
                </button>
              )}
            </div>
          </div>

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
              className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[44px]"
              title="Add stock to watchlist"
            >
              {addingStock ? (
                <span className="text-sm">...</span>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
            </button>
          </div>

          {bulkImportProgress.importing && (
            <div className="mb-3 p-3 bg-primary/10 rounded border border-primary/20">
              <p className="text-sm text-primary">
                Importing stocks... ({bulkImportProgress.current}/{bulkImportProgress.total})
              </p>
            </div>
          )}

          <div className={`space-y-2 ${watchlistStocks.length > 7 ? 'max-h-[336px] overflow-y-auto pr-2' : ''}`}>
            {watchlistStocks.map(stock => {
              const ticker = stock.company?.ticker || ''
              const isSelected = selectedStocks.has(ticker)
              
              return (
                <div
                  key={stock.id}
                  className={`flex items-center p-3 rounded border transition-colors ${
                    isSelected
                      ? 'bg-primary/10 border-primary'
                      : 'bg-muted/50 border-border hover:bg-muted/70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleStockSelection(ticker)}
                    className="mr-3 h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <span className="font-semibold">{ticker}</span>
                  </div>
                  <button
                    onClick={() => removeStock(ticker)}
                    className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              )
            })}
            
            {watchlistStocks.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                No stocks in this watchlist yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImport={handleBulkImport}
      />
    </div>
  )
}