'use client'

import { useAuth } from '@/app/contexts/auth-context'

export default function UserProfile() {
  const { user, signOut, loading } = useAuth()

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="text-sm">
        <p className="text-foreground font-medium">{user.email}</p>
      </div>
      <button
        onClick={signOut}
        className="btn-destructive text-sm"
      >
        Sign Out
      </button>
    </div>
  )
}