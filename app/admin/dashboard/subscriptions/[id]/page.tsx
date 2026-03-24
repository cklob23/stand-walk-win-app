import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
    ArrowLeft,
    Building2,
    CreditCard,
    ExternalLink,
    Calendar,
    Users,
    DollarSign,
    Mail,
    User,
    Ticket,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
} from 'lucide-react'

async function getSubscription(id: string) {
    const supabase = createAdminClient()

    const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select(`
      *,
      organization:organizations(id, name, admin_email, max_users),
      subscription_tier:subscription_tiers(id, name, display_name, price_monthly, max_learners, features)
    `)
        .eq('id', id)
        .single()

    if (error || !subscription) {
        return null
    }

    return subscription
}

async function getAccessCodesForSubscription(subscriptionId: string) {
    const supabase = createAdminClient()

    const { data: codes } = await supabase
        .from('access_codes')
        .select(`
      *,
      claimed_profile:profiles!access_codes_claimed_by_fkey(id, full_name, email)
    `)
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false })

    return codes || []
}

export default async function SubscriptionDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const adminData = await getAdminUser()

    if (!adminData) {
        redirect('/admin/login')
    }

    if (!adminData.isMasterAdmin) {
        redirect('/admin/dashboard')
    }

    const subscription = await getSubscription(id)

    if (!subscription) {
        notFound()
    }

    const accessCodes = await getAccessCodesForSubscription(id)
    const usedCodes = accessCodes.filter(c => c.claimed_by !== null).length
    const availableCodes = accessCodes.filter(c => c.claimed_by === null).length

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active':
                return <CheckCircle className="h-4 w-4 text-green-500" />
            case 'canceled':
            case 'cancelled':
                return <XCircle className="h-4 w-4 text-red-500" />
            default:
                return <AlertCircle className="h-4 w-4 text-amber-500" />
        }
    }

    const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
        switch (status) {
            case 'active':
                return 'default'
            case 'canceled':
            case 'cancelled':
                return 'destructive'
            default:
                return 'secondary'
        }
    }

    // Build Stripe dashboard URLs
    const stripeCustomerUrl = subscription.stripe_customer_id
        ? `https://dashboard.stripe.com/customers/${subscription.stripe_customer_id}`
        : null
    const stripeSubscriptionUrl = subscription.stripe_subscription_id
        ? `https://dashboard.stripe.com/subscriptions/${subscription.stripe_subscription_id}`
        : null

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/admin/dashboard/subscriptions">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Subscriptions
                    </Button>
                </Link>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Subscription Details</h1>
                    <p className="text-muted-foreground">
                        Viewing subscription for {subscription.purchaser_email}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {getStatusIcon(subscription.status)}
                    <Badge variant={getStatusVariant(subscription.status)} className="text-sm">
                        {subscription.status}
                    </Badge>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Subscription Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Subscription Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4">
                            <div className="flex items-start gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground mt-1" />
                                <div>
                                    <p className="text-sm font-medium">Purchaser Email</p>
                                    <p className="text-sm text-muted-foreground">{subscription.purchaser_email}</p>
                                </div>
                            </div>

                            {subscription.purchaser_name && (
                                <div className="flex items-start gap-3">
                                    <User className="h-4 w-4 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-sm font-medium">Purchaser Name</p>
                                        <p className="text-sm text-muted-foreground">{subscription.purchaser_name}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start gap-3">
                                <Ticket className="h-4 w-4 text-muted-foreground mt-1" />
                                <div>
                                    <p className="text-sm font-medium">Subscription Tier</p>
                                    <Badge variant="secondary" className="mt-1">
                                        {subscription.subscription_tier?.display_name || 'Unknown'}
                                    </Badge>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Users className="h-4 w-4 text-muted-foreground mt-1" />
                                <div>
                                    <p className="text-sm font-medium">Licenses</p>
                                    <p className="text-sm text-muted-foreground">
                                        {subscription.license_count || 1} license(s)
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
                                <div>
                                    <p className="text-sm font-medium">Created</p>
                                    <p className="text-sm text-muted-foreground">
                                        {new Date(subscription.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                            </div>

                            {subscription.updated_at && subscription.updated_at !== subscription.created_at && (
                                <div className="flex items-start gap-3">
                                    <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-sm font-medium">Last Updated</p>
                                        <p className="text-sm text-muted-foreground">
                                            {new Date(subscription.updated_at).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Billing Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5" />
                            Billing Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4">
                            {subscription.amount_paid !== null && (
                                <div className="flex items-start gap-3">
                                    <DollarSign className="h-4 w-4 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-sm font-medium">Amount Paid</p>
                                        <p className="text-sm text-muted-foreground">
                                            ${(subscription.amount_paid / 100).toFixed(2)} {subscription.currency?.toUpperCase() || 'USD'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {subscription.subscription_tier?.price_monthly && (
                                <div className="flex items-start gap-3">
                                    <CreditCard className="h-4 w-4 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-sm font-medium">Monthly Price</p>
                                        <p className="text-sm text-muted-foreground">
                                            ${subscription.subscription_tier.price_monthly}/month per license
                                        </p>
                                    </div>
                                </div>
                            )}

                            {subscription.stripe_customer_id && (
                                <div className="flex items-start gap-3">
                                    <User className="h-4 w-4 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-sm font-medium">Stripe Customer ID</p>
                                        <code className="text-xs bg-muted px-2 py-1 rounded">
                                            {subscription.stripe_customer_id}
                                        </code>
                                    </div>
                                </div>
                            )}

                            {subscription.stripe_subscription_id && (
                                <div className="flex items-start gap-3">
                                    <CreditCard className="h-4 w-4 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-sm font-medium">Stripe Subscription ID</p>
                                        <code className="text-xs bg-muted px-2 py-1 rounded">
                                            {subscription.stripe_subscription_id}
                                        </code>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Separator className="my-4" />

                        {/* Stripe Actions */}
                        <div className="space-y-3">
                            <p className="text-sm font-medium">Stripe Actions</p>
                            <div className="flex flex-wrap gap-2">
                                {stripeCustomerUrl ? (
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={stripeCustomerUrl} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            View Customer in Stripe
                                        </a>
                                    </Button>
                                ) : (
                                    <Button variant="outline" size="sm" disabled>
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        No Stripe Customer
                                    </Button>
                                )}

                                {stripeSubscriptionUrl ? (
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={stripeSubscriptionUrl} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            Manage in Stripe
                                        </a>
                                    </Button>
                                ) : (
                                    <Button variant="outline" size="sm" disabled>
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        No Stripe Subscription
                                    </Button>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Use Stripe dashboard to update billing, cancel, or modify the subscription.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Organization Info */}
                {subscription.organization && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Organization
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4">
                                <div>
                                    <p className="text-sm font-medium">Name</p>
                                    <p className="text-sm text-muted-foreground">{subscription.organization.name}</p>
                                </div>

                                {subscription.organization.admin_email && (
                                    <div>
                                        <p className="text-sm font-medium">Admin Email</p>
                                        <p className="text-sm text-muted-foreground">{subscription.organization.admin_email}</p>
                                    </div>
                                )}

                                <div>
                                    <p className="text-sm font-medium">Max Users</p>
                                    <p className="text-sm text-muted-foreground">
                                        {subscription.organization.max_users || 'Unlimited'}
                                    </p>
                                </div>

                                <Link href={`/admin/dashboard/organizations/${subscription.organization.id}`}>
                                    <Button variant="outline" size="sm" className="w-full">
                                        <Building2 className="h-4 w-4 mr-2" />
                                        View Organization Details
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Access Codes */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Ticket className="h-5 w-5" />
                            Access Codes
                        </CardTitle>
                        <CardDescription>
                            {usedCodes} of {accessCodes.length} codes used
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {accessCodes.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No access codes generated for this subscription
                            </p>
                        ) : (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {accessCodes.map((code) => (
                                    <div
                                        key={code.id}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                                    >
                                        <div>
                                            <code className="text-sm font-mono">{code.code}</code>
                                            {code.claimed_profile && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Claimed by {(code.claimed_profile as { full_name: string | null }).full_name || (code.claimed_profile as { email: string }).email}
                                                </p>
                                            )}
                                        </div>
                                        <Badge variant={code.claimed_by ? 'secondary' : 'outline'}>
                                            {code.claimed_by ? 'Used' : 'Available'}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Tier Features */}
            {subscription.subscription_tier?.features && (
                <Card>
                    <CardHeader>
                        <CardTitle>Tier Features</CardTitle>
                        <CardDescription>
                            Features included in the {subscription.subscription_tier.display_name} plan
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                            {(Array.isArray(subscription.subscription_tier.features)
                                ? subscription.subscription_tier.features
                                : []
                            ).map((feature: string, index: number) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
