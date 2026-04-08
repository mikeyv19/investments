'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal } from '@/app/components/ui/modal'
import { Users, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { WatchlistShare } from '@/app/types'

interface ShareWatchlistModalProps {
  isOpen: boolean
  onClose: () => void
  watchlistId: string
  watchlistName: string
}

export default function ShareWatchlistModal({
  isOpen,
  onClose,
  watchlistId,
  watchlistName
}: ShareWatchlistModalProps) {
  const [email, setEmail] = useState('')
  const [shares, setShares] = useState<WatchlistShare[]>([])
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const fetchShares = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/watchlists/${watchlistId}/share`)
      const json = await res.json()
      if (res.ok) {
        setShares(json.data || [])
      }
    } catch {
      console.error('Failed to fetch shares')
    } finally {
      setLoading(false)
    }
  }, [watchlistId])

  useEffect(() => {
    if (isOpen) {
      fetchShares()
    }
  }, [isOpen, watchlistId, fetchShares])

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setSharing(true)
    try {
      const res = await fetch(`/api/watchlists/${watchlistId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      const json = await res.json()

      if (res.ok) {
        toast.success(`Watchlist shared with ${email.trim()}`)
        setEmail('')
        setShares(prev => [json.data, ...prev])
      } else {
        toast.error(json.error || 'Failed to share watchlist')
      }
    } catch {
      toast.error('Failed to share watchlist')
    } finally {
      setSharing(false)
    }
  }

  const handleRevoke = async (share: WatchlistShare) => {
    setRevokingId(share.shared_with_user_id)
    try {
      const res = await fetch(
        `/api/watchlists/${watchlistId}/share?user_id=${share.shared_with_user_id}`,
        { method: 'DELETE' }
      )

      if (res.ok) {
        toast.success(`Removed ${share.shared_with_email || 'user'} from watchlist`)
        setShares(prev => prev.filter(s => s.id !== share.id))
      } else {
        const json = await res.json()
        toast.error(json.error || 'Failed to revoke share')
      }
    } catch {
      toast.error('Failed to revoke share')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share "${watchlistName}"`}
      size="md"
    >
      <div className="p-6">
        {/* Invite section */}
        <form onSubmit={handleShare} className="flex gap-2 mb-6">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email address"
            className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground"
            disabled={sharing}
          />
          <button
            type="submit"
            disabled={sharing || !email.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {sharing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Share
          </button>
        </form>

        {/* Current shares */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Shared with
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : shares.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              This watchlist is not shared with anyone yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                >
                  <span className="text-sm text-foreground">
                    {share.shared_with_email || 'Unknown user'}
                  </span>
                  <button
                    onClick={() => handleRevoke(share)}
                    disabled={revokingId === share.shared_with_user_id}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-muted disabled:opacity-50"
                    title="Remove access"
                  >
                    {revokingId === share.shared_with_user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
