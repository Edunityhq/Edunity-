'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(identifier, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <div className="edunity-card w-full max-w-md p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-md border border-border bg-secondary/50 p-1.5">
            <Image
              src="/edunity-logo.jpg"
              alt="Edunity"
              width={30}
              height={30}
              className="rounded-sm object-contain"
            />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">Edunity Dashboard Login</h1>
            <p className="text-xs text-muted-foreground">Sign in with username or email.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Username or Email</label>
            <Input
              type="text"
              name="edunity-identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter username or email"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="edunity-input"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Password</label>
            <Input
              type="password"
              name="edunity-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="new-password"
              className="edunity-input"
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" size="sm" disabled={isLoading} className="edunity-button w-full">
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
