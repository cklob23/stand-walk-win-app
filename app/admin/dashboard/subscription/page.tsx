import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreditCard, Calendar, Users, Package, ExternalLink, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { redirectToBillingPortal } from '@/app/actions/stripe-billing'

interface Subscription {
    id: string
    status: string
    license_count: number
    amount_paid: number
    currency: string | null
    created_at: string
    current_period_end: string | null
    purchaser_name: string | null
    purchaser_email: string
    stripe_customer_id: string | null
    tier: {
        id: string
        name: string
        display_name: string
        price_monthly: number
        features: string[] | null
    } | null
}

async function getSubscriptions(organizationId: string): Promise<Subscription[]> {
    const supabase = createAdminClient()

    const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select(`
      *,
      tier:subscription_tiers(
        id,
        name,
        display_name,
        price_monthly,
        features
      )
    `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching subscriptions:', error)
        return []
    }

    return (subscriptions || []) as Subscription[]
}

export default async function AdminSubscriptionPage() {
    const adminData = await getAdminUser()

    if (!adminData) {
        redirect('/admin/login')
    }

    const { isMasterAdmin, organization } = adminData

    if (isMasterAdmin) {
        redirect('/admin/dashboard')
    }

    if (!organization) {
        redirect('/admin/dashboard')
    }

    const subscriptions = await getSubscriptions(organization.id)

    // Calculate totals
    const totalLicenses = subscriptions.reduce((sum, sub) => sum + (sub.license_count || 0), 0)
    const totalAmount = subscriptions.reduce((sum, sub) => sum + (sub.amount_paid || 0), 0)
    const hasStripeCustomer = subscriptions.some(sub => sub.stripe_customer_id)

    const formatCurrency = (amount: number, currency?: string | null) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency?.toUpperCase() || 'USD',
        }).format(amount / 100)
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Subscription</h1>
                <p className="text-muted-foreground">
                    Manage your organization&apos;s subscription and billing
                </p>
            </div>

            {subscriptions.length > 0 ? (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-3">
                        {/* Total Licenses */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Total Licenses</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalLicenses}</div>
                                <p className="text-xs text-muted-foreground">Across all plans</p>
                            </CardContent>
                        </Card>

                        {/* Active Plans */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{subscriptions.filter(s => s.status === 'active').length}</div>
                                <p className="text-xs text-muted-foreground">
                                    {subscriptions.length} total subscription{subscriptions.length !== 1 ? 's' : ''}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Total Amount */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
                                <p className="text-xs text-muted-foreground">Combined subscription value</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Plan Cards - One for each subscription */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold">Your Plans</h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            {subscriptions.map((subscription) => (
                                <Card key={subscription.id}>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="flex items-center gap-2">
                                                <Package className="h-5 w-5" />
                                                {subscription.tier?.display_name || 'Standard'}
                                            </CardTitle>
                                            <Badge
                                                className={subscription.status === 'active'
                                                    ? 'bg-green-500/10 text-green-600'
                                                    : 'bg-amber-500/10 text-amber-600'
                                                }
                                            >
                                                {subscription.status}
                                            </Badge>
                                        </div>
                                        <CardDescription>
                                            {subscription.license_count} license{subscription.license_count !== 1 ? 's' : ''}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <span className="text-muted-foreground">Amount Paid</span>
                                            <span className="text-right font-medium">
                                                {formatCurrency(subscription.amount_paid || 0, subscription.currency)}
                                            </span>
                                            <span className="text-muted-foreground">Purchased</span>
                                            <span className="text-right">
                                                {new Date(subscription.created_at).toLocaleDateString()}
                                            </span>
                                            {subscription.current_period_end && (
                                                <>
                                                    <span className="text-muted-foreground">Renews</span>
                                                    <span className="text-right">
                                                        {new Date(subscription.current_period_end).toLocaleDateString()}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {/* Features - Show all */}
                                        {subscription.tier?.features && subscription.tier.features.length > 0 && (
                                            <div className="pt-3 border-t">
                                                <p className="text-sm font-medium mb-2">Included Features:</p>
                                                <ul className="space-y-1">
                                                    {(subscription.tier.features as string[]).map((feature, i) => (
                                                        <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                                                            {feature}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Billing Management */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Purchase More */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Add More Licenses
                                </CardTitle>
                                <CardDescription>
                                    Purchase additional plans for your organization
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Need more licenses or want to add a different tier?
                                    Visit our pricing page to purchase additional plans.
                                </p>
                                <Button asChild className="w-full">
                                    <Link href="/pricing">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        View Pricing & Purchase
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Billing Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Billing Management
                                </CardTitle>
                                <CardDescription>
                                    Update payment method, view invoices, and manage billing
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Access the Stripe billing portal to update your payment method,
                                    download invoices, or cancel your subscription.
                                </p>
                                {hasStripeCustomer ? (
                                    <form action={redirectToBillingPortal}>
                                        <Button type="submit" variant="outline" className="w-full">
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Open Billing Portal
                                        </Button>
                                    </form>
                                ) : (
                                    <Button variant="outline" className="w-full" asChild>
                                        <a href="mailto:standwalkrunapp@gmail.com?subject=Update Billing Information">
                                            Contact Support
                                        </a>
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Billing Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Billing Details
                            </CardTitle>
                            <CardDescription>
                                Subscription billing information
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                                {/* Primary Purchaser */}
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Primary Purchaser</p>
                                    <p className="font-medium">
                                        {subscriptions[0]?.purchaser_name || 'Not specified'}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{subscriptions[0]?.purchaser_email}</p>
                                </div>

                                {/* Billing Type */}
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Cycle</p>
                                    <p className="font-medium">Monthly</p>
                                    <p className="text-sm text-muted-foreground">Recurring subscription</p>
                                </div>

                                {/* Next Billing Date */}
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next Billing Date</p>
                                    <p className="font-medium">
                                        {subscriptions[0]?.current_period_end
                                            ? new Date(subscriptions[0].current_period_end).toLocaleDateString('en-US', {
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })
                                            : (() => {
                                                const nextDate = new Date(subscriptions[0]?.created_at)
                                                nextDate.setMonth(nextDate.getMonth() + 1)
                                                return nextDate.toLocaleDateString('en-US', {
                                                    month: 'long',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })
                                            })()
                                        }
                                    </p>
                                    <p className="text-sm text-muted-foreground">Auto-renewal</p>
                                </div>

                                {/* Next Billing Amount */}
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next Billing Amount</p>
                                    <p className="font-medium text-lg">{formatCurrency(totalAmount)}</p>
                                    <p className="text-sm text-muted-foreground">{totalLicenses} license{totalLicenses !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Support */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Need Help?</CardTitle>
                            <CardDescription>
                                Contact our support team for billing questions or subscription changes
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="flex-1">
                                    <p className="text-sm text-muted-foreground">
                                        For billing inquiries, subscription upgrades, or any other questions about your account,
                                        please reach out to our support team.
                                    </p>
                                </div>
                                <Button asChild variant="outline">
                                    <a href="mailto:standwalkrunapp@gmail.com?subject=Subscription Support Request">
                                        Contact Support
                                    </a>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Package className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Subscription Found</h3>
                        <p className="text-muted-foreground text-center mb-4">
                            Your organization doesn&apos;t have an active subscription yet.
                        </p>
                        <Button asChild>
                            <Link href="/pricing">View Plans</Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
