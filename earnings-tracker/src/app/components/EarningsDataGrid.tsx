'use client'

import { useState, useEffect, useMemo } from 'react'
import { EarningsGridData, SortConfig, FilterConfig, GridState } from '@/app/types'

interface EarningsDataGridProps {
  data: EarningsGridData[]
  onExport?: (format: 'csv' | 'excel') => void
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

  // Export to CSV
  const exportToCSV = () => {
    const headers = Object.keys(paginatedData[0] || {}).join(',')
    const rows = paginatedData.map(row => 
      Object.values(row).map(v => `"${v || ''}"`).join(',')
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

  return (
    <div className="w-full">
      {/* Search and Export Controls */}
      <div className="mb-4 flex justify-between items-center">
        <input
          type="text"
          placeholder="Search all columns..."
          value={gridState.globalSearch}
          onChange={(e) => setGridState(prev => ({ ...prev, globalSearch: e.target.value, page: 1 }))}
          className="px-4 py-2 border rounded-lg w-64"
        />
        
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Export CSV
        </button>
      </div>

      {/* Data Grid */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <div className="space-y-2">
                  <button
                    onClick={() => handleSort('ticker')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-900 uppercase tracking-wider"
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
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>
              </th>
              
              <th className="px-6 py-3 text-left">
                <div className="space-y-2">
                  <button
                    onClick={() => handleSort('company_name')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-900 uppercase tracking-wider"
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
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>
              </th>
              
              <th className="px-6 py-3 text-left">
                <div className="space-y-2">
                  <button
                    onClick={() => handleSort('earnings_date')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-900 uppercase tracking-wider"
                  >
                    Date
                    {gridState.sortBy.find(s => s.field === 'earnings_date')?.order === 'asc' && '↑'}
                    {gridState.sortBy.find(s => s.field === 'earnings_date')?.order === 'desc' && '↓'}
                  </button>
                  <input
                    type="date"
                    value={columnFilters.earnings_date || ''}
                    onChange={(e) => setColumnFilters(prev => ({ ...prev, earnings_date: e.target.value }))}
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>
              </th>
              
              <th className="px-6 py-3 text-left">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-900 uppercase tracking-wider">
                    Timing
                  </div>
                  <select
                    value={columnFilters.market_timing || ''}
                    onChange={(e) => setColumnFilters(prev => ({ ...prev, market_timing: e.target.value }))}
                    className="w-full px-2 py-1 text-sm border rounded"
                  >
                    <option value="">All</option>
                    <option value="before">Before</option>
                    <option value="after">After</option>
                  </select>
                </div>
              </th>
              
              <th className="px-6 py-3 text-left">
                <div className="space-y-2">
                  <button
                    onClick={() => handleSort('eps_estimate')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-900 uppercase tracking-wider"
                  >
                    EPS Est.
                    {gridState.sortBy.find(s => s.field === 'eps_estimate')?.order === 'asc' && '↑'}
                    {gridState.sortBy.find(s => s.field === 'eps_estimate')?.order === 'desc' && '↓'}
                  </button>
                </div>
              </th>
              
              <th className="px-6 py-3 text-left">
                <div className="space-y-2">
                  <button
                    onClick={() => handleSort('eps_actual')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-900 uppercase tracking-wider"
                  >
                    EPS Actual
                    {gridState.sortBy.find(s => s.field === 'eps_actual')?.order === 'asc' && '↑'}
                    {gridState.sortBy.find(s => s.field === 'eps_actual')?.order === 'desc' && '↓'}
                  </button>
                </div>
              </th>
              
              <th className="px-6 py-3 text-left">
                <div className="text-xs font-medium text-gray-900 uppercase tracking-wider">
                  Period
                </div>
              </th>
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {row.ticker}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {row.company_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(row.earnings_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                    row.market_timing === 'before' 
                      ? 'bg-yellow-100 text-yellow-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {row.market_timing}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${row.eps_estimate?.toFixed(2) || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${row.eps_actual?.toFixed(2) || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {row.fiscal_period || 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm text-gray-700">
          Showing {((gridState.page - 1) * gridState.pageSize) + 1} to{' '}
          {Math.min(gridState.page * gridState.pageSize, sortedData.length)} of{' '}
          {sortedData.length} results
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setGridState(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={gridState.page === 1}
            className="px-3 py-1 border rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          
          <span className="px-3 py-1">
            Page {gridState.page} of {totalPages}
          </span>
          
          <button
            onClick={() => setGridState(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
            disabled={gridState.page === totalPages}
            className="px-3 py-1 border rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}