'use client'

import { useEffect } from 'react'
import { Modal } from '@/app/components/ui/modal'

interface RefreshProgressModalProps {
  isOpen: boolean
  onClose: () => void
  onCancel?: () => void
  totalStocks: number
  currentStock: number
  currentTicker: string
  isComplete: boolean
  errors: string[]
}

export default function RefreshProgressModal({
  isOpen,
  onClose,
  onCancel,
  totalStocks,
  currentStock,
  currentTicker,
  isComplete,
  errors
}: RefreshProgressModalProps) {
  // Format seconds to HH:MM:SS
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    const parts = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)
    
    return parts.join(' ')
  }
  
  // Calculate times based on 45 seconds per stock
  const SECONDS_PER_STOCK = 45
  const totalSeconds = totalStocks * SECONDS_PER_STOCK
  const remainingStocks = Math.max(0, totalStocks - currentStock + 1) // +1 because current stock is still processing
  const remainingSeconds = remainingStocks * SECONDS_PER_STOCK
  // Prevent closing while in progress
  const canClose = isComplete || currentStock === 0

  // Close on escape key only if allowed
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && canClose) {
        onClose()
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, canClose, onClose])

  const progressPercentage = totalStocks > 0 ? (currentStock / totalStocks) * 100 : 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={canClose ? onClose : () => {}}
      title={isComplete ? 'Refresh Complete' : 'Refreshing Watchlist Data'}
      size="md"
    >
      <div className="p-6">
        
        {!isComplete && (
          <>
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">
                Estimated total time: <span className="font-medium">{formatTime(totalSeconds)}</span>
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                Time remaining: <span className="font-medium">{formatTime(remainingSeconds)}</span>
              </p>
              <p className="text-sm font-medium">
                Processing: <span className="text-primary">{currentTicker || 'Preparing...'}</span>
              </p>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{currentStock} of {totalStocks} stocks</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </>
        )}

        {isComplete && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">
              Successfully refreshed {totalStocks - errors.length} of {totalStocks} stocks.
            </p>
            {errors.length > 0 && (
              <div className="mt-3 p-3 bg-destructive/10 rounded border border-destructive/20">
                <p className="text-sm font-medium text-destructive mb-1">
                  Failed to refresh {errors.length} stock(s):
                </p>
                <ul className="text-sm text-destructive/80 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-1">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {!isComplete && onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onClose}
            disabled={!canClose}
            className={`px-4 py-2 rounded transition-colors ${
              canClose
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {isComplete ? 'Close' : 'Processing...'}
          </button>
        </div>
      </div>
    </Modal>
  )
}