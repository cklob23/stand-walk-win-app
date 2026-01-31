'use client'

import React from "react"

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { resetPassword, verifyPasswordResetOtp, resendPasswordResetOtp, updatePassword } from '@/lib/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { BookOpen, Loader2, ArrowLeft, Mail, Eye, EyeOff, Lock } from 'lucide-react'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  
  // OTP state
  const [step, setStep] = useState<'email' | 'otp' | 'newPassword'>('email')
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', ''])
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await resetPassword(formData)
      if (result?.error) {
        setError(result.error)
      } else if (result?.success) {
        setPendingEmail(result.email || formData.get('email') as string)
        setStep('otp')
        setSuccess(result.message || 'Check your email for the code.')
      }
    })
  }

  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return
    
    const newValues = [...otpValues]
    newValues[index] = value
    setOtpValues(newValues)
    setError(null)
    
    if (value && index < 5) {
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
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pastedData.length === 6) {
      const newValues = pastedData.split('')
      setOtpValues(newValues)
      inputRefs.current[5]?.focus()
    }
  }

  const handleVerifyOtp = async () => {
    const code = otpValues.join('')
    if (code.length !== 6 || !pendingEmail) {
      setError('Please enter the complete 6-digit code')
      return
    }

    setIsVerifying(true)
    setError(null)
    
    const result = await verifyPasswordResetOtp(pendingEmail, code)
    
    if (result.error) {
      setError(result.error)
      setIsVerifying(false)
      setOtpValues(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } else if (result.success) {
      setIsVerifying(false)
      setStep('newPassword')
    }
  }

  const handleResendCode = async () => {
    if (!pendingEmail) return
    
    setIsResending(true)
    setError(null)
    
    const result = await resendPasswordResetOtp(pendingEmail)
    
    setIsResending(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(result.message || 'Code resent!')
      setOtpValues(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }

  const handleUpdatePassword = async (formData: FormData) => {
    setIsUpdating(true)
    setError(null)
    
    const result = await updatePassword(formData)
    
    if (result?.error) {
      setError(result.error)
      setIsUpdating(false)
    }
    // If successful, updatePassword will redirect to dashboard
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6 sm:space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 sm:mb-6">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
            <span className="text-lg sm:text-xl font-semibold text-foreground">Stand Walk Win</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {step === 'newPassword' ? 'Create new password' : 'Reset your password'}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            {step === 'email' && "Enter your email and we'll send you a code"}
            {step === 'otp' && 'Enter the 6-digit code we sent to your email'}
            {step === 'newPassword' && 'Choose a strong password for your account'}
          </p>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="pt-6">
            {/* Step 1: Email Input */}
            {step === 'email' && (
              <form action={handleSubmit} className="space-y-4">
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

                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send code'
                  )}
                </Button>
              </form>
            )}

            {/* Step 2: OTP Verification */}
            {step === 'otp' && pendingEmail && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="flex justify-center mb-4">
                    <div className="rounded-full bg-primary/10 p-3">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Code sent to<br />
                    <span className="font-medium text-foreground">{pendingEmail}</span>
                  </p>
                </div>

                {/* OTP Input */}
                <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
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
                      className="w-11 h-12 text-center text-lg font-semibold"
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
                  disabled={isVerifying || otpValues.join('').length !== 6}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Code'
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
                      setStep('email')
                      setPendingEmail(null)
                      setOtpValues(['', '', '', '', '', ''])
                      setError(null)
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Use different email
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: New Password */}
            {step === 'newPassword' && (
              <form action={handleUpdatePassword} className="space-y-4">
                <div className="text-center mb-4">
                  <div className="flex justify-center mb-3">
                    <div className="rounded-full bg-primary/10 p-3">
                      <Lock className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
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

                <Button type="submit" className="w-full h-11" disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Remember your password?{' '}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
