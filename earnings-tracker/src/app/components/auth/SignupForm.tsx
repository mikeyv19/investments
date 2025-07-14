'use client'

import { useState } from 'react'
import { useAuth } from '@/app/contexts/auth-context'
import Link from 'next/link'

export default function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      await signUp(email, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-accent border border-accent text-accent-foreground px-4 py-3 rounded">
          <h3 className="font-bold mb-2">Success!</h3>
          <p>Please check your email to confirm your account.</p>
          <Link href="/login" className="text-primary underline font-bold mt-2 inline-block hover:text-primary/80 transition-colors">
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="bg-card shadow-md rounded-lg px-8 pt-6 pb-8 mb-4 border border-border">
        <h2 className="text-2xl font-bold mb-6 text-center text-foreground">Create Account</h2>
        
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

        <div className="mb-4">
          <label className="block text-foreground text-sm font-bold mb-2" htmlFor="password">
            Password
          </label>
          <input
            className="input w-full"
            id="password"
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-foreground text-sm font-bold mb-2" htmlFor="confirmPassword">
            Confirm Password
          </label>
          <input
            className="input w-full"
            id="confirmPassword"
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center justify-center mb-4">
          <button
            className="btn-primary disabled:opacity-50 w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </div>

        <div className="text-center">
          <span className="text-muted-foreground text-sm">Already have an account? </span>
          <Link href="/login" className="font-bold text-sm text-primary hover:text-primary/80 transition-colors">
            Sign In
          </Link>
        </div>
      </form>
    </div>
  )
}