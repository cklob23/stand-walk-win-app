'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { AdminHeader } from '@/components/admin/admin-header'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AppLogo } from '@/components/app-logo'
import { BrandingProvider } from '@/contexts/branding-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Ticket, Users, TrendingUp, Building2, Copy, ExternalLink, Bell, Calendar, CreditCard, Package, Menu } from 'lucide-react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { PricingContent } from '@/components/pricing/pricing-content'
import { SuccessContent } from '@/app/pricing/success/success-content'
import { SUPPORT_EMAIL } from '@/lib/support'
import { formatBillingDate, getNextBillingDate, getNextBillingTotals } from '@/lib/admin-billing'

const mockUser = {
    id: 'preview-admin',
    email: 'caleb@standwalkrun.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
} as User

const previewSubscriptions = [
    { status: 'active', license_count: 1, amount_paid: 699, current_period_end: '2026-11-15T00:00:00.000Z', name: 'Basic' },
    { status: 'cancelled', license_count: 1, amount_paid: 1999, current_period_end: '2026-08-29T00:00:00.000Z', name: 'Premium' },
]

const previewBranding = {
    logoUrl: null,
    churchName: '101 Church',
    slogan: 'Church for everyday people.',
    primaryColor: null,
    secondaryColor: null,
    organizationName: '101 Church',
}

function PreviewInner() {
    const { setTheme } = useTheme()
    const params = useSearchParams()
    const view = params.get('view') || 'dashboard'
    const churchName = params.get('churchName') ?? previewBranding.churchName
    const organizationName = params.get('orgName') ?? churchName
    const previewOrg = { id: 'preview-org', name: organizationName }

    useEffect(() => {
        setTheme('light')
    }, [setTheme])

    if (view === 'journey-header') {
        return (
            <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
                <div className="mx-auto max-w-7xl px-4">
                    <div className="flex h-16 items-center justify-between">
                        <div className="min-w-0 shrink">
                            <AppLogo textClassName="text-sm lg:text-base" showSubtitle />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="grid h-9 w-9 place-items-center">
                                <Bell className="h-5 w-5" />
                            </span>
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                CK
                            </span>
                            <span className="grid h-9 w-9 place-items-center">
                                <Menu className="h-5 w-5" />
                            </span>
                        </div>
                    </div>
                </div>
            </header>
        )
    }

    if (view === 'pricing') {
        return (
            <PricingContent
                userData={{
                    id: mockUser.id,
                    email: mockUser.email || '',
                    fullName: 'Caleb Klobe',
                    avatarUrl: null,
                    hasSubscription: true,
                    organizationId: 'preview-org',
                    organizationName: '101 Church',
                    isOrgAdmin: true,
                }}
            />
        )
    }

    if (view === 'success') {
        return <SuccessContent isOrgAdmin />
    }

    if (view === 'billing') {
        const nextBilling = getNextBillingTotals(previewSubscriptions)
        const nextBillingDate = getNextBillingDate(previewSubscriptions, new Date('2026-10-26T12:00:00.000Z'))
        const formatCurrency = (amount: number) =>
            new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100)

        return (
            <div className="min-h-screen bg-background overflow-x-hidden">
                <AdminHeader
                    user={mockUser}
                    profile={{ full_name: 'Caleb Klobe', role: 'leader' }}
                    organization={previewOrg}
                    isMasterAdmin={false}
                />
                <div className="flex">
                    <AdminSidebar isMasterAdmin={false} journeyRole="leader" />
                    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold">Subscription</h1>
                            <p className="text-muted-foreground">Manage your organization&apos;s subscription and billing</p>
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold">Your Plans</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                {previewSubscriptions.map((subscription) => (
                                    <Card key={subscription.name}>
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="flex items-center gap-2">
                                                    <Package className="h-5 w-5" />
                                                    {subscription.name}
                                                </CardTitle>
                                                <Badge className={subscription.status === 'active'
                                                    ? 'bg-green-500/10 text-green-600'
                                                    : 'bg-amber-500/10 text-amber-600'}
                                                >
                                                    {subscription.status}
                                                </Badge>
                                            </div>
                                            <CardDescription>
                                                {subscription.license_count} license
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                        </div>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5" />
                                    Billing Details
                                </CardTitle>
                                <CardDescription>Subscription billing information</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next Billing Date</p>
                                        <p className="font-medium">{nextBillingDate ? formatBillingDate(nextBillingDate) : 'Not available'}</p>
                                        {nextBillingDate && <p className="text-sm text-muted-foreground">Auto-renewal</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next Billing Amount</p>
                                        <p className="font-medium text-lg">{formatCurrency(nextBilling.amountPaidCents)}</p>
                                        <p className="text-sm text-muted-foreground">{nextBilling.licenseCount} license{nextBilling.licenseCount !== 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Need Help?</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button asChild variant="outline">
                                    <a href={`mailto:${SUPPORT_EMAIL}?subject=Subscription Support Request`}>
                                        <CreditCard className="mr-2 h-4 w-4" />
                                        Contact Support
                                    </a>
                                </Button>
                            </CardContent>
                        </Card>
                    </main>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            <AdminHeader
                user={mockUser}
                profile={{ full_name: 'Caleb Klobe', role: 'leader' }}
                organization={previewOrg}
                isMasterAdmin={false}
            />
            <div className="flex">
                <AdminSidebar isMasterAdmin={false} journeyRole="leader" />
                <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold">Welcome, Caleb Klobe</h1>
                            <p className="text-muted-foreground">Manage your organization and members</p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Members</CardTitle>
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">1</div>
                                    <p className="text-xs text-muted-foreground">Active members</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Available Codes</CardTitle>
                                    <Ticket className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">0</div>
                                    <p className="text-xs text-muted-foreground">Ready to distribute</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Used Codes</CardTitle>
                                    <Ticket className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">1</div>
                                    <p className="text-xs text-muted-foreground">Of 1 total</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Plan</CardTitle>
                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">Basic</div>
                                    <p className="text-xs text-muted-foreground">1 license</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Quick Actions</CardTitle>
                                    <CardDescription>Common tasks for managing your organization</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Button asChild className="w-full justify-start" variant="outline">
                                        <Link href="/admin/dashboard/access-codes">
                                            <Ticket className="mr-2 h-4 w-4" />
                                            View & Copy Access Codes
                                        </Link>
                                    </Button>
                                    <Button asChild className="w-full justify-start" variant="outline">
                                        <Link href="/admin/dashboard/members">
                                            <Users className="mr-2 h-4 w-4" />
                                            Manage Members
                                        </Link>
                                    </Button>
                                    <Button asChild className="w-full justify-start" variant="outline">
                                        <Link href="/admin/dashboard/requests">
                                            <Bell className="mr-2 h-4 w-4" />
                                            Member Requests
                                        </Link>
                                    </Button>
                                    <Button asChild className="w-full justify-start" variant="outline">
                                        <Link href="/admin/dashboard/settings">
                                            <Building2 className="mr-2 h-4 w-4" />
                                            Organization Settings
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Share Access Codes</CardTitle>
                                    <CardDescription>Invite members to join your organization</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Share your access codes with team members so they can sign up for the journey.
                                        Each code can only be used once.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button asChild>
                                            <Link href="/admin/dashboard/access-codes">
                                                <Copy className="mr-2 h-4 w-4" />
                                                Get Codes
                                            </Link>
                                        </Button>
                                        <Button variant="outline" asChild>
                                            <Link href="/auth/signup" target="_blank">
                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                Signup Page
                                            </Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

function PreviewWithBranding() {
    const params = useSearchParams()
    const churchName = params.get('churchName') ?? previewBranding.churchName
    const organizationName = params.get('orgName') ?? churchName
    return (
        <BrandingProvider initialBranding={{ ...previewBranding, churchName, organizationName }}>
            <PreviewInner />
        </BrandingProvider>
    )
}

export default function AdminShellPreviewPage() {
    return (
        <Suspense fallback={null}>
            <PreviewWithBranding />
        </Suspense>
    )
}
