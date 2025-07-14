'use client'

import { useState, useEffect, useMemo } from 'react'
import { EarningsGridData, SortConfig, FilterConfig, GridState, ColumnVisibility } from '@/app/types'

interface EarningsDataGridProps {
  data: EarningsGridData[]
  onExport?: (format: 'csv' | 'excel') => void
}

const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  ticker: true,
  company_name: true,
  earnings_date: true,
  earnings_time: true,
  market_timing: true,
  eps_estimate: true,
  year_ago_eps: true,
  fiscal_period: true
}

export default function EarningsDataGrid({ data, onExport }: EarningsDataGridProps) {
  const [gridState, setGridState] = useState<GridState>({
    page: 1,
    pageSize: 25,
    sortBy: [{ field: 'earnings_date', order: 'asc' }],
    filters: [],
    globalSearch: ''
  })

  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [refreshingTickers, setRefreshingTickers] = useState<Set<string>>(new Set())
  const [refreshStatus, setRefreshStatus] = useState<Record<string, string>>({})
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(DEFAULT_COLUMN_VISIBILITY)
  const [showColumnMenu, setShowColumnMenu] = useState(false)

  // Load column visibility preferences on mount
  useEffect(() => {
    loadColumnVisibility()
  }, [])

  // Handle click outside to close column menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.column-menu-container')) {
        setShowColumnMenu(false)
      }
    }

    if (showColumnMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showColumnMenu])

  const loadColumnVisibility = async () => {
    try {
      const response = await fetch('/api/user/preferences?key=column_visibility')
      const result = await response.json()
      
      if (response.ok && result.data) {
        setColumnVisibility(result.data)
      }
    } catch (error) {
      console.error('Failed to load column preferences:', error)
    }
  }

  const saveColumnVisibility = async (newVisibility: ColumnVisibility) => {
    try {
      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'column_visibility',
          value: newVisibility
        })
      })
    } catch (error) {
      console.error('Failed to save column preferences:', error)
    }
  }

  const toggleColumn = (column: keyof ColumnVisibility) => {
    const newVisibility = {
      ...columnVisibility,
      [column]: !columnVisibility[column]
    }
    setColumnVisibility(newVisibility)
    saveColumnVisibility(newVisibility)
  }

  // Apply global search
  const searchFilteredData = useMemo(() => {
    if (!gridState.globalSearch) return data

    const searchLower = gridState.globalSearch.toLowerCase()
    return data.filter(row => 
      Object.values(row).some(value => 
        value?.toString().toLowerCase().includes(searchLower)
      )
    )
  }, [data, gridState.globalSearch])

  // Apply column filters
  const filteredData = useMemo(() => {
    let filtered = searchFilteredData

    Object.entries(columnFilters).forEach(([field, value]) => {
      if (value) {
        filtered = filtered.filter(row => {
          const rowValue = row[field as keyof EarningsGridData]?.toString().toLowerCase()
          return rowValue?.includes(value.toLowerCase())
        })
      }
    })

    return filtered
  }, [searchFilteredData, columnFilters])

  // Apply sorting
  const sortedData = useMemo(() => {
    if (gridState.sortBy.length === 0) return filteredData

    return [...filteredData].sort((a, b) => {
      for (const sort of gridState.sortBy) {
        const aVal = a[sort.field]
        const bVal = b[sort.field]

        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1

        let comparison = 0
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal)
        } else {
          comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0
        }

        if (comparison !== 0) {
          return sort.order === 'asc' ? comparison : -comparison
        }
      }
      return 0
    })
  }, [filteredData, gridState.sortBy])

  // Pagination
  const paginatedData = useMemo(() => {
    const start = (gridState.page - 1) * gridState.pageSize
    const end = start + gridState.pageSize
    return sortedData.slice(start, end)
  }, [sortedData, gridState.page, gridState.pageSize])

  const totalPages = Math.ceil(sortedData.length / gridState.pageSize)

  // Sort handler
  const handleSort = (field: keyof EarningsGridData) => {
    setGridState(prev => {
      const existingSort = prev.sortBy.find(s => s.field === field)
      
      if (!existingSort) {
        return { ...prev, sortBy: [{ field, order: 'asc' }] }
      }
      
      if (existingSort.order === 'asc') {
        return { ...prev, sortBy: [{ field, order: 'desc' }] }
      }
      
      return { ...prev, sortBy: prev.sortBy.filter(s => s.field !== field) }
    })
  }

  // Refresh data for a specific ticker
  const refreshTicker = async (ticker: string) => {
    if (refreshingTickers.size > 0) return // Only allow one refresh at a time
    
    setRefreshingTickers(new Set([ticker]))
    setRefreshStatus({ [ticker]: 'Refreshing...' })
    
    try {
      const response = await fetch(`/api/companies/${ticker}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setRefreshStatus({ [ticker]: 'Success!' })
        // Reload the page after 2 seconds to show updated data
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        setRefreshStatus({ [ticker]: 'Failed' })
        setTimeout(() => {
          setRefreshStatus({})
        }, 3000)
      }
    } catch (error) {
      setRefreshStatus({ [ticker]: 'Error' })
      setTimeout(() => {
        setRefreshStatus({})
      }, 3000)
    } finally {
      setRefreshingTickers(new Set())
    }
  }

  // Export to CSV
  const exportToCSV = () => {
    const visibleColumns = Object.entries(columnVisibility)
      .filter(([_, visible]) => visible)
      .map(([column]) => column)
    
    const headers = ['ticker', 'company_name', 'earnings_date', 'earnings_time', 'market_timing', 'eps_estimate', 'year_ago_eps', 'fiscal_period']
      .filter(col => visibleColumns.includes(col))
      .join(',')
    
    const rows = paginatedData.map(row => 
      visibleColumns.map(col => `"${row[col as keyof EarningsGridData] || ''}"`).join(',')
    ).join('\n')
    
    const csv = `${headers}\n${rows}`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `earnings-data-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const columnDefinitions = [
    { key: 'ticker', label: 'Ticker' },
    { key: 'company_name', label: 'Company' },
    { key: 'earnings_date', label: 'Date' },
    { key: 'earnings_time', label: 'Time (ET)' },
    { key: 'market_timing', label: 'Market' },
    { key: 'eps_estimate', label: 'EPS Est.' },
    { key: 'year_ago_eps', label: 'Year Ago EPS' },
    { key: 'fiscal_period', label: 'Period' }
  ]

  return (
    <div className="w-full">
      {/* Search and Export Controls */}
      <div className="mb-4 flex justify-between items-center">
        <input
          type="text"
          placeholder="Search all columns..."
          value={gridState.globalSearch}
          onChange={(e) => setGridState(prev => ({ ...prev, globalSearch: e.target.value, page: 1 }))}
          className="input w-64"
        />
        
        <div className="flex gap-2">
          <div className="relative column-menu-container">
            <button
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
            >
              Columns
            </button>
            
            {showColumnMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-lg border border-border z-10">
                <div className="p-2">
                  <div className="text-sm font-semibold text-foreground px-2 py-1">Show/Hide Columns</div>
                  {columnDefinitions.map(col => (
                    <label key={col.key} className="flex items-center px-2 py-1 hover:bg-accent cursor-pointer">
                      <input
                        type="checkbox"
                        checked={columnVisibility[col.key as keyof ColumnVisibility]}
                        onChange={() => toggleColumn(col.key as keyof ColumnVisibility)}
                        className="mr-2"
                      />
                      <span className="text-sm">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="overflow-x-auto border border-border rounded-lg bg-card">
        <table className="min-w-full">
          <thead className="bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30">
            <tr>
              <th className="px-4 py-3 text-center">
                <div className="text-xs font-medium text-foreground uppercase tracking-wider">
                  Refresh
                </div>
              </th>
              
              {columnVisibility.ticker && (
                <th className="px-6 py-3 text-left">
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSort('ticker')}
                      className="flex items-center gap-1 text-xs font-medium text-foreground uppercase tracking-wider"
                    >
                      Ticker
                      {gridState.sortBy.find(s => s.field === 'ticker')?.order === 'asc' && '↑'}
                      {gridState.sortBy.find(s => s.field === 'ticker')?.order === 'desc' && '↓'}
                    </button>
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={columnFilters.ticker || ''}
                      onChange={(e) => setColumnFilters(prev => ({ ...prev, ticker: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-input rounded bg-background text-foreground"
                    />
                  </div>
                </th>
              )}
              
              {columnVisibility.company_name && (
                <th className="px-6 py-3 text-left">
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSort('company_name')}
                      className="flex items-center gap-1 text-xs font-medium text-foreground uppercase tracking-wider"
                    >
                      Company
                      {gridState.sortBy.find(s => s.field === 'company_name')?.order === 'asc' && '↑'}
                      {gridState.sortBy.find(s => s.field === 'company_name')?.order === 'desc' && '↓'}
                    </button>
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={columnFilters.company_name || ''}
                      onChange={(e) => setColumnFilters(prev => ({ ...prev, company_name: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-input rounded bg-background text-foreground"
                    />
                  </div>
                </th>
              )}
              
              {columnVisibility.earnings_date && (
                <th className="px-6 py-3 text-left">
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSort('earnings_date')}
                      className="flex items-center gap-1 text-xs font-medium text-foreground uppercase tracking-wider"
                    >
                      Date
                      {gridState.sortBy.find(s => s.field === 'earnings_date')?.order === 'asc' && '↑'}
                      {gridState.sortBy.find(s => s.field === 'earnings_date')?.order === 'desc' && '↓'}
                    </button>
                    <input
                      type="date"
                      value={columnFilters.earnings_date || ''}
                      onChange={(e) => setColumnFilters(prev => ({ ...prev, earnings_date: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-input rounded bg-background text-foreground"
                    />
                  </div>
                </th>
              )}
              
              {columnVisibility.earnings_time && (
                <th className="px-6 py-3 text-left">
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSort('earnings_time')}
                      className="flex items-center gap-1 text-xs font-medium text-foreground uppercase tracking-wider"
                    >
                      Time (ET)
                      {gridState.sortBy.find(s => s.field === 'earnings_time')?.order === 'asc' && '↑'}
                      {gridState.sortBy.find(s => s.field === 'earnings_time')?.order === 'desc' && '↓'}
                    </button>
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={columnFilters.earnings_time || ''}
                      onChange={(e) => setColumnFilters(prev => ({ ...prev, earnings_time: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-input rounded bg-background text-foreground"
                    />
                  </div>
                </th>
              )}
              
              {columnVisibility.market_timing && (
                <th className="px-6 py-3 text-left">
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSort('market_timing')}
                      className="flex items-center gap-1 text-xs font-medium text-foreground uppercase tracking-wider"
                    >
                      Market
                      {gridState.sortBy.find(s => s.field === 'market_timing')?.order === 'asc' && '↑'}
                      {gridState.sortBy.find(s => s.field === 'market_timing')?.order === 'desc' && '↓'}
                    </button>
                    <select
                      value={columnFilters.market_timing || ''}
                      onChange={(e) => setColumnFilters(prev => ({ ...prev, market_timing: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-input rounded bg-background text-foreground"
                    >
                      <option value="">All</option>
                      <option value="before">Before</option>
                      <option value="during">During</option>
                      <option value="after">After</option>
                    </select>
                  </div>
                </th>
              )}
              
              {columnVisibility.eps_estimate && (
                <th className="px-6 py-3 text-left">
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSort('eps_estimate')}
                      className="flex items-center gap-1 text-xs font-medium text-foreground uppercase tracking-wider"
                    >
                      EPS Est.
                      {gridState.sortBy.find(s => s.field === 'eps_estimate')?.order === 'asc' && '↑'}
                      {gridState.sortBy.find(s => s.field === 'eps_estimate')?.order === 'desc' && '↓'}
                    </button>
                  </div>
                </th>
              )}
              
              {columnVisibility.year_ago_eps && (
                <th className="px-6 py-3 text-left">
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSort('year_ago_eps')}
                      className="flex items-center gap-1 text-xs font-medium text-foreground uppercase tracking-wider"
                    >
                      Year Ago EPS
                      {gridState.sortBy.find(s => s.field === 'year_ago_eps')?.order === 'asc' && '↑'}
                      {gridState.sortBy.find(s => s.field === 'year_ago_eps')?.order === 'desc' && '↓'}
                    </button>
                  </div>
                </th>
              )}
              
              {columnVisibility.fiscal_period && (
                <th className="px-6 py-3 text-left">
                  <div className="text-xs font-medium text-foreground uppercase tracking-wider">
                    Period
                  </div>
                </th>
              )}
            </tr>
          </thead>
          
          <tbody className="bg-card divide-y divide-border">
            {paginatedData.map((row, idx) => {
              const isRefreshing = refreshingTickers.has(row.ticker)
              const hasRefreshStatus = refreshStatus[row.ticker]
              
              return (
                <tr key={idx} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-4 text-center">
                    {hasRefreshStatus ? (
                      <span className={`text-sm font-medium ${
                        hasRefreshStatus === 'Success!' ? 'text-emerald-400' : 
                        hasRefreshStatus === 'Failed' || hasRefreshStatus === 'Error' ? 'text-rose-400' : 
                        'text-sky-400'
                      }`}>
                        {hasRefreshStatus}
                      </span>
                    ) : (
                      <button
                        onClick={() => refreshTicker(row.ticker)}
                        disabled={refreshingTickers.size > 0}
                        className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed transition-colors"
                      >
                        {isRefreshing ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            ...
                          </span>
                        ) : (
                          'Refresh'
                        )}
                      </button>
                    )}
                  </td>
                  
                  {columnVisibility.ticker && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {row.ticker}
                    </td>
                  )}
                  
                  {columnVisibility.company_name && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {row.company_name}
                    </td>
                  )}
                  
                  {columnVisibility.earnings_date && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(row.earnings_date + 'T00:00:00').toLocaleDateString()}
                    </td>
                  )}
                  
                  {columnVisibility.earnings_time && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {row.earnings_time || 'N/A'}
                    </td>
                  )}
                  
                  {columnVisibility.market_timing && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                        row.market_timing === 'before' 
                          ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-orange-300 border border-orange-500/30' 
                          : row.market_timing === 'during'
                          ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-300 border border-violet-500/30'
                      }`}>
                        {row.market_timing}
                      </span>
                    </td>
                  )}
                  
                  {columnVisibility.eps_estimate && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      ${row.eps_estimate?.toFixed(2) || 'N/A'}
                    </td>
                  )}
                  
                  {columnVisibility.year_ago_eps && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      ${row.year_ago_eps?.toFixed(2) || 'N/A'}
                    </td>
                  )}
                  
                  {columnVisibility.fiscal_period && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {row.fiscal_period || 'N/A'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm text-foreground">
          Showing {((gridState.page - 1) * gridState.pageSize) + 1} to{' '}
          {Math.min(gridState.page * gridState.pageSize, sortedData.length)} of{' '}
          {sortedData.length} results
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setGridState(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={gridState.page === 1}
            className="px-3 py-1 border border-border rounded-lg disabled:opacity-50 hover:bg-accent transition-colors"
          >
            Previous
          </button>
          
          <span className="px-3 py-1">
            Page {gridState.page} of {totalPages}
          </span>
          
          <button
            onClick={() => setGridState(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
            disabled={gridState.page === totalPages}
            className="px-3 py-1 border border-border rounded-lg disabled:opacity-50 hover:bg-accent transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}