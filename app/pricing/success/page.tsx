'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Mail, KeyRound, UserPlus, ArrowRight, Building2 } from 'lucide-react'

function SuccessContent() {
    const searchParams = useSearchParams()
    const licenseCount = parseInt(searchParams.get('licenses') || '1', 10)
    const hasOrg = searchParams.get('org') === 'true'
    const tierName = searchParams.get('tier') || 'your plan'

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="max-w-2xl w-full">
                <Card className="border-primary/20">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="h-10 w-10 text-primary" />
                        </div>
                        <CardTitle className="text-2xl md:text-3xl text-foreground">
                            Payment Successful!
                        </CardTitle>
                        <CardDescription className="text-base mt-2">
                            Thank you for subscribing to the {tierName} plan
                            {licenseCount > 1 ? ` with ${licenseCount} licenses` : ''}.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* What happens next */}
                        <div className="bg-muted/50 rounded-lg p-6">
                            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                <span className="text-primary">What happens next?</span>
                            </h3>

                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                        <Mail className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Check your email</p>
                                        <p className="text-sm text-muted-foreground">
                                            We&apos;ve sent {licenseCount === 1 ? 'an access code' : `${licenseCount} access codes`} to your email address.
                                            {licenseCount > 1 && ' Share the additional codes with your team members.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                        <KeyRound className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Copy your access code</p>
                                        <p className="text-sm text-muted-foreground">
                                            Find the unique access code in your email. Each code can only be used once.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                        <UserPlus className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Complete your signup</p>
                                        <p className="text-sm text-muted-foreground">
                                            Enter your access code during signup to unlock your account and start your journey.
                                        </p>
                                    </div>
                                </div>

                                {hasOrg && (
                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                            <Building2 className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium">Organization created</p>
                                            <p className="text-sm text-muted-foreground">
                                                Your organization has been set up. Team members who sign up with your access codes will automatically join.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Important note */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-sm text-amber-800">
                                <strong>Important:</strong> Please check your spam folder if you don&apos;t see the email within a few minutes.
                                The email will come from Stand Walk Run.
                            </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <Button asChild className="flex-1 gap-2">
                                <Link href="/auth/signup">
                                    Go to Sign Up
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="flex-1">
                                <Link href="/pricing">
                                    Back to Pricing
                                </Link>
                            </Button>
                        </div>

                        <p className="text-center text-sm text-muted-foreground">
                            Already have an account?{' '}
                            <Link href="/auth/login" className="text-primary hover:underline">
                                Sign in here
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default function CheckoutSuccessPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
        }>
            <SuccessContent />
        </Suspense>
    )
}
