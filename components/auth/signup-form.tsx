'use client'

import React from "react"
import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signUp, verifyOtp, resendOtp, validateAccessCode, validatePairingCode } from '@/lib/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Eye, EyeOff, Mail, ArrowLeft, CheckCircle2, Ticket, Building2, Users } from 'lucide-react'

interface AccessCodeDetails {
  id: string
  code: string
  tierId: string
  tierName: string | null
  journeyId: string
  organizationId: string | null
  organizationName: string | null
}

interface PairingCodeDetails {
  id: string
  code: string
  leaderId: string
  leaderName: string
  tierId: string | null
  tierName: string | null
  organizationId: string | null
  organizationName: string | null
  journeyId: string | null
  availableSlots: number
}

type CodeType = 'access' | 'pairing'

interface SignupFormProps {
  isOrgAdmin?: boolean
}

export function SignupForm({ isOrgAdmin = false }: SignupFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Code type toggle
  const [codeType, setCodeType] = useState<CodeType>('access')

  // Access code state
  const [accessCode, setAccessCode] = useState('')
  const [validatedCode, setValidatedCode] = useState<AccessCodeDetails | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  // Pairing code state
  const [pairingCode, setPairingCode] = useState('')
  const [validatedPairing, setValidatedPairing] = useState<PairingCodeDetails | null>(null)

  // OTP verification state
  const [showOtpForm, setShowOtpForm] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [pendingPassword, setPendingPassword] = useState<string | null>(null)
  const [pendingAccessCodeId, setPendingAccessCodeId] = useState<string | null>(null)
  const [pendingPairingId, setPendingPairingId] = useState<string | null>(null)
  const [pendingCodeType, setPendingCodeType] = useState<CodeType | null>(null)
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '', '', ''])
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleValidateCode = async () => {
    if (codeType === 'access') {
      if (!accessCode.trim()) {
        setError('Please enter an access code')
        return
      }

      setIsValidating(true)
      setError(null)

      const result = await validateAccessCode(accessCode.trim())

      setIsValidating(false)
      if (result.valid && result.accessCode) {
        setValidatedCode(result.accessCode)
        setSuccess('Access code validated! Continue with signup.')
      } else {
        setError(result.error || 'Invalid access code')
      }
    } else {
      // Pairing code validation
      if (!pairingCode.trim()) {
        setError('Please enter a pairing code')
        return
      }

      setIsValidating(true)
      setError(null)

      const result = await validatePairingCode(pairingCode.trim())

      setIsValidating(false)
      if (result.valid && result.pairing) {
        setValidatedPairing(result.pairing)
        setSuccess(`Joining ${result.pairing.leaderName}'s group!`)
      } else {
        setError(result.error || 'Invalid pairing code')
      }
    }
  }

  function handleSubmit(formData: FormData) {
    if (codeType === 'access' && !validatedCode) {
      setError('Please validate your access code first')
      return
    }
    if (codeType === 'pairing' && !validatedPairing) {
      setError('Please validate your pairing code first')
      return
    }

    // Add code info to form data
    formData.set('codeType', codeType)
    if (codeType === 'access' && validatedCode) {
      formData.set('accessCodeId', validatedCode.id)
    } else if (codeType === 'pairing' && validatedPairing) {
      formData.set('pairingId', validatedPairing.id)
    }

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
        setPendingAccessCodeId(result.accessCodeId || null)
        setPendingPairingId(result.pairingId || null)
        setPendingCodeType(result.codeType || null)
        setShowOtpForm(true)
        setSuccess(result.message || null)
      } else if (result?.success) {
        setSuccess(result.message || 'Account created successfully!')
      }
    })
  }

  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return

    const newValues = [...otpValues]
    newValues[index] = value
    setOtpValues(newValues)
    setError(null)

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

    const result = await verifyOtp(
      pendingEmail,
      code,
      pendingPassword || undefined,
      'signup',
      pendingAccessCodeId || undefined,
      pendingPairingId || undefined,
      pendingCodeType || undefined
    )

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
                  setPendingAccessCodeId(null)
                  setPendingPairingId(null)
                  setPendingCodeType(null)
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
        {/* Code Entry Step */}
        {!validatedCode && !validatedPairing ? (
          <div className="space-y-6">
            {/* Code Type Toggle */}
            <div className="flex rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => {
                  setCodeType('access')
                  setError(null)
                  setPairingCode('')
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 px-3 text-sm font-medium transition-colors ${codeType === 'access'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Ticket className="h-4 w-4" />
                Access Code
              </button>
              <button
                type="button"
                onClick={() => {
                  setCodeType('pairing')
                  setError(null)
                  setAccessCode('')
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 px-3 text-sm font-medium transition-colors ${codeType === 'pairing'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Users className="h-4 w-4" />
                Pairing Code
              </button>
            </div>

            <div className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-primary/10 p-3">
                  {codeType === 'access' ? (
                    <Ticket className="h-6 w-6 text-primary" />
                  ) : (
                    <Users className="h-6 w-6 text-primary" />
                  )}
                </div>
              </div>
              <h3 className="font-semibold text-foreground">
                {codeType === 'access' ? 'Enter Access Code' : 'Enter Pairing Code'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {codeType === 'access'
                  ? 'Enter the access code from your purchase email'
                  : 'Enter the pairing code from your Leader to join their group'
                }
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">
                {codeType === 'access' ? 'Access Code' : 'Pairing Code'}
              </Label>
              {codeType === 'access' ? (
                <Input
                  id="code"
                  type="text"
                  placeholder="ABCD1234"
                  value={accessCode}
                  onChange={(e) => {
                    setAccessCode(e.target.value.toUpperCase())
                    setError(null)
                  }}
                  className="h-11 text-center font-mono text-lg tracking-wider"
                  maxLength={8}
                />
              ) : (
                <Input
                  id="code"
                  type="text"
                  placeholder="ABC123"
                  value={pairingCode}
                  onChange={(e) => {
                    setPairingCode(e.target.value.toUpperCase())
                    setError(null)
                  }}
                  className="h-11 text-center font-mono text-lg tracking-wider"
                  maxLength={6}
                />
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="button"
              className="w-full h-11"
              onClick={handleValidateCode}
              disabled={isValidating || (codeType === 'access' ? !accessCode.trim() : !pairingCode.trim())}
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                'Validate Code'
              )}
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {codeType === 'access' ? (
                  <>
                    Don&apos;t have an access code?{' '}
                    <a href="/pricing" className="font-medium text-primary hover:underline">
                      Purchase a plan
                    </a>
                  </>
                ) : (
                  <>
                    Need your own access?{' '}
                    <a href="/pricing" className="font-medium text-primary hover:underline">
                      Purchase a plan
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Validated Code Badge (Access or Pairing) */}
            <div className="mb-6 rounded-lg bg-primary/5 border border-primary/20 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {validatedCode ? (
                    <>
                      <p className="font-medium text-sm text-foreground">Access Code Verified</p>
                      <p className="text-xs text-muted-foreground">
                        {validatedCode.tierName || 'Standard'} Plan
                        {validatedCode.organizationName && (
                          <span className="flex items-center gap-1 mt-1">
                            <Building2 className="h-3 w-3" />
                            {validatedCode.organizationName}
                          </span>
                        )}
                      </p>
                    </>
                  ) : validatedPairing ? (
                    <>
                      <p className="font-medium text-sm text-foreground">
                        Joining {validatedPairing.leaderName}&apos;s Group
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {validatedPairing.tierName || 'Standard'} Plan - Learner
                        {validatedPairing.organizationName && (
                          <span className="flex items-center gap-1 mt-1">
                            <Building2 className="h-3 w-3" />
                            {validatedPairing.organizationName}
                          </span>
                        )}
                      </p>
                    </>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setValidatedCode(null)
                    setValidatedPairing(null)
                    setAccessCode('')
                    setPairingCode('')
                    setSuccess(null)
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Signup Form */}
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
          </>
        )}
      </CardContent>
    </Card>
  )
}
