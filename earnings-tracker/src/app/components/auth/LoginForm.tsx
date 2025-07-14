'use client'

import { useState } from 'react'
import { useAuth } from '@/app/contexts/auth-context'
import Link from 'next/link'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await signIn(email, password)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="bg-card shadow-md rounded-lg px-8 pt-6 pb-8 mb-4 border border-border">
        <h2 className="text-2xl font-bold mb-6 text-center text-foreground">Sign In</h2>
        
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-foreground text-sm font-bold mb-2" htmlFor="email">
            Email
          </label>
          <input
            className="input w-full"
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-foreground text-sm font-bold mb-2" htmlFor="password">
            Password
          </label>
          <input
            className="input w-full mb-3"
            id="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            className="btn-primary disabled:opacity-50"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
          <Link
            href="/reset-password"
            className="inline-block align-baseline font-bold text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Forgot Password?
          </Link>
        </div>

        <div className="text-center mt-4">
          <span className="text-muted-foreground text-sm">Don't have an account? </span>
          <Link href="/signup" className="font-bold text-sm text-primary hover:text-primary/80 transition-colors">
            Sign Up
          </Link>
        </div>
      </form>
    </div>
  )
}