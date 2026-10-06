'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { signIn } from '@/lib/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false) // Declare isLoading variable

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    const nextFieldErrors: { email?: string; password?: string } = {}
    if (!email) nextFieldErrors.email = 'Email is required'
    if (!password) nextFieldErrors.password = 'Password is required'

    setFieldErrors(nextFieldErrors)
    if (nextFieldErrors.email || nextFieldErrors.password) {
      setError(null)
      return
    }

    formData.set('email', email)
    setError(null)
    setIsLoading(true) // Set isLoading to true before starting the transition
    startTransition(async () => {
      const result = await signIn(formData)
      setIsLoading(false) // Set isLoading to false after the transition
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="h-11"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              onChange={() => {
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }))
              }}
            />
            {fieldErrors.email && (
              <p id="email-error" role="alert" className="text-sm text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link 
                href="/auth/forgot-password" 
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                className="h-11 pr-10"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                onChange={() => {
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }))
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="sr-only">
                  {showPassword ? 'Hide password' : 'Show password'}
                </span>
              </Button>
            </div>
            {fieldErrors.password && (
              <p id="password-error" role="alert" className="text-sm text-destructive">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error === 'Invalid login credentials' 
                ? 'Email or password is incorrect. Please check your credentials or sign up for a new account.'
                : error}
            </div>
          )}

          <Button type="submit" className="w-full h-11" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
