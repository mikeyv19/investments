'use client'

import { useAuth } from '@/app/contexts/auth-context'

export default function UserProfile() {
  const { user, signOut, loading } = useAuth()

  if (loading) {
    return <div className="text-gray-500">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="text-sm">
        <p className="text-gray-700 font-medium">{user.email}</p>
      </div>
      <button
        onClick={signOut}
        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
      >
        Sign Out
      </button>
    </div>
  )
}