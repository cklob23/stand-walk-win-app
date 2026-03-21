'use client'

import { useState, useTransition } from 'react'
import { adminSignIn, adminSignUp, adminVerifyOTP } from '@/lib/admin-auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Eye, EyeOff, Mail, Lock, User, KeyRound } from 'lucide-react'
import Link from 'next/link'

export function AdminLoginForm() {
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [showPassword, setShowPassword] = useState(false)
    const [activeTab, setActiveTab] = useState('login')
    const [showOTPVerification, setShowOTPVerification] = useState(false)
    const [pendingEmail, setPendingEmail] = useState<string | null>(null)

    function handleLogin(formData: FormData) {
        setError(null)
        setSuccess(null)
        startTransition(async () => {
            const result = await adminSignIn(formData)
            if (result?.error) {
                setError(result.error)
            }
        })
    }

    function handleSignUp(formData: FormData) {
        setError(null)
        setSuccess(null)
        const email = formData.get('email') as string
        startTransition(async () => {
            const result = await adminSignUp(formData)
            if (result?.error) {
                setError(result.error)
            } else if (result?.needsVerification) {
                // Show OTP verification step
                setPendingEmail(email)
                setShowOTPVerification(true)
                setSuccess(result.message || 'Check your email for a verification code.')
            }
        })
    }

    function handleVerifyOTP(formData: FormData) {
        setError(null)
        startTransition(async () => {
            if (!pendingEmail) {
                setError('No pending verification. Please sign up again.')
                return
            }
            formData.set('email', pendingEmail)
            const result = await adminVerifyOTP(formData)
            if (result?.error) {
                setError(result.error)
            } else if (result?.success) {
                setShowOTPVerification(false)
                setPendingEmail(null)
                setSuccess('Email verified! You can now sign in.')
                setActiveTab('login')
            }
        })
    }

    // Show OTP verification screen
    if (showOTPVerification) {
        return (
            <Card className="border-border/50 shadow-lg">
                <CardContent className="pt-6">
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <KeyRound className="h-6 w-6 text-primary" />
                        </div>
                        <h2 className="text-xl font-semibold">Verify Your Email</h2>
                        <p className="text-sm text-muted-foreground mt-2">
                            We sent a verification code to <strong>{pendingEmail}</strong>
                        </p>
                    </div>

                    <form action={handleVerifyOTP} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="otp-code">Verification Code</Label>
                            <Input
                                id="otp-code"
                                name="token"
                                type="text"
                                placeholder="Enter 9-digit code"
                                required
                                autoComplete="one-time-code"
                                className="h-11 text-center text-lg tracking-widest"
                                maxLength={9}
                            />
                        </div>

                        {error && (
                            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-600">
                                {success}
                            </div>
                        )}

                        <Button type="submit" className="w-full h-11" disabled={isPending}>
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                'Verify Email'
                            )}
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full"
                            onClick={() => {
                                setShowOTPVerification(false)
                                setPendingEmail(null)
                                setError(null)
                                setSuccess(null)
                            }}
                        >
                            Back to Sign Up
                        </Button>
                    </form>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-border/50 shadow-lg">
            <CardContent className="pt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="login">Sign In</TabsTrigger>
                        <TabsTrigger value="signup">Create Account</TabsTrigger>
                    </TabsList>

                    <TabsContent value="login">
                        <form action={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="login-email">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="login-email"
                                        name="email"
                                        type="email"
                                        placeholder="admin@yourorg.com"
                                        required
                                        autoComplete="email"
                                        className="h-11 pl-10"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="login-password">Password</Label>
                                    <Link
                                        href="/auth/forgot-password"
                                        className="text-sm text-primary hover:underline"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="login-password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        required
                                        autoComplete="current-password"
                                        className="h-11 pl-10 pr-10"
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
                            </div>

                            {error && (
                                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-600">
                                    {success}
                                </div>
                            )}

                            <Button type="submit" className="w-full h-11" disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign in to Admin Dashboard'
                                )}
                            </Button>
                        </form>
                    </TabsContent>

                    <TabsContent value="signup">
                        <form action={handleSignUp} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="signup-name">Full Name</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="signup-name"
                                        name="name"
                                        type="text"
                                        placeholder="John Smith"
                                        required
                                        autoComplete="name"
                                        className="h-11 pl-10"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="signup-email">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="signup-email"
                                        name="email"
                                        type="email"
                                        placeholder="admin@yourorg.com"
                                        required
                                        autoComplete="email"
                                        className="h-11 pl-10"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Use the same email you used to purchase your subscription. Your organization will be linked automatically.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="signup-password">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="signup-password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Create a secure password"
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                        className="h-11 pl-10 pr-10"
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
                                    Minimum 8 characters
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
                                    'Create Admin Account'
                                )}
                            </Button>
                        </form>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}
