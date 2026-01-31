'use client'

import React from "react"

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signUp, verifyOtp, resendOtp } from '@/lib/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react'

export function SignupForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // OTP verification state
  const [showOtpForm, setShowOtpForm] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [pendingPassword, setPendingPassword] = useState<string | null>(null)
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '', '', ''])
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(null)
    setIsLoading(true)
    startTransition(async () => {
      const result = await signUp(formData)
      
      setIsLoading(false)

      if (result?.error) {
        setError(result.error)
      } else if (result?.requiresVerification) {
        setPendingEmail(result.email || null)
        setPendingPassword(result.password || null)
        setShowOtpForm(true)
        setSuccess(result.message || null)
      } else if (result?.success) {
        setSuccess(result.message || 'Account created successfully!')
      }
    })
  }

  const handleOtpChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return
    
    const newValues = [...otpValues]
    newValues[index] = value
    setOtpValues(newValues)
    setError(null)
    
    // Auto-focus next input
    if (value && index < 7) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8)
    if (pastedData.length === 8) {
      const newValues = pastedData.split('')
      setOtpValues(newValues)
      inputRefs.current[7]?.focus()
    }
  }

  const handleVerifyOtp = async () => {
    const code = otpValues.join('')
    if (code.length !== 8 || !pendingEmail) {
      setError('Please enter the complete 8-digit code')
      return
    }

    setIsVerifying(true)
    setError(null)
    
    const result = await verifyOtp(pendingEmail, code, pendingPassword || undefined)
    
    if (result.error) {
      setError(result.error)
      setIsVerifying(false)
      setOtpValues(['', '', '', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } else if (result.success) {
      router.push('/onboarding')
    }
  }

  const handleResendCode = async () => {
    if (!pendingEmail) return
    
    setIsResending(true)
    setError(null)
    
    const result = await resendOtp(pendingEmail)
    
    setIsResending(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(result.message || 'Code resent!')
      setOtpValues(['', '', '', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }

  // OTP Verification Screen
  if (showOtpForm && pendingEmail) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold text-foreground">Verify your email</h3>
              <p className="text-sm text-muted-foreground">
                We sent an 8-digit code to<br />
                <span className="font-medium text-foreground">{pendingEmail}</span>
              </p>
            </div>

            {/* OTP Input */}
            <div className="flex justify-center gap-1.5" onPaste={handleOtpPaste}>
              {otpValues.map((value, index) => (
                <Input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={value}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-9 h-11 text-center text-base font-semibold px-0"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive text-center">
                {error}
              </div>
            )}

            <Button 
              onClick={handleVerifyOtp} 
              className="w-full h-11" 
              disabled={isVerifying || otpValues.join('').length !== 8}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </Button>

            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Didn&apos;t receive the code?{' '}
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isResending}
                  className="font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {isResending ? 'Sending...' : 'Resend code'}
                </button>
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowOtpForm(false)
                  setPendingEmail(null)
                  setPendingPassword(null)
                  setOtpValues(['', '', '', '', '', '', '', ''])
                  setError(null)
                }}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to signup
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="John Smith"
              required
              autoComplete="name"
              className="h-11"
            />
          </div>

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
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                required
                minLength={6}
                autoComplete="new-password"
                className="h-11 pr-10"
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
            <p className="text-xs text-muted-foreground">
              Must be at least 6 characters
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-11" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
