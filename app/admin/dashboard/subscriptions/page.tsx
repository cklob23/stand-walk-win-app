import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { CreditCard, TrendingUp, Building2, DollarSign, ChevronRight } from 'lucide-react'

async function getAllSubscriptions() {
    const supabase = createAdminClient()

    const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select(`
      *,
      organization:organizations(id, name),
      subscription_tier:subscription_tiers(id, name, display_name, price_monthly)
    `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching subscriptions:', error)
        return []
    }

    return subscriptions || []
}

async function getSubscriptionTiers() {
    const supabase = createAdminClient()

    const { data: tiers, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .order('price_monthly', { ascending: true })

    if (error) {
        console.error('Error fetching tiers:', error)
        return []
    }

    return tiers || []
}

export default async function MasterSubscriptionsPage() {
    const adminData = await getAdminUser()

    if (!adminData) {
        redirect('/admin/login')
    }

    if (!adminData.isMasterAdmin) {
        redirect('/admin/dashboard')
    }

    const [subscriptions, tiers] = await Promise.all([
        getAllSubscriptions(),
        getSubscriptionTiers(),
    ])

    const totalSubs = subscriptions.length
    const activeSubs = subscriptions.filter(s => s.status === 'active').length
    const totalLicenses = subscriptions.reduce((sum, s) => sum + (s.license_count || 0), 0)
    const monthlyRevenue = subscriptions
        .filter(s => s.status === 'active')
        .reduce((sum, s) => sum + (s.subscription_tier?.price_monthly || 0) * (s.license_count || 1), 0)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Subscriptions</h1>
                <p className="text-muted-foreground">Manage all subscriptions and billing</p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalSubs}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeSubs}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Licenses</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalLicenses}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Est. Monthly Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${monthlyRevenue.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Subscription Tiers */}
            <Card>
                <CardHeader>
                    <CardTitle>Subscription Tiers</CardTitle>
                    <CardDescription>Available pricing plans</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        {tiers.map((tier) => (
                            <Card key={tier.id} className="border-2">
                                <CardHeader>
                                    <CardTitle className="text-lg">{tier.display_name}</CardTitle>
                                    <CardDescription>{tier.name}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold mb-2">
                                        ${tier.price_monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Up to {tier.max_learners || 'unlimited'} learners
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Subscriptions Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Subscriptions</CardTitle>
                    <CardDescription>View all subscription records</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Purchaser</TableHead>
                                <TableHead>Organization</TableHead>
                                <TableHead>Tier</TableHead>
                                <TableHead>Licenses</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="w-10"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {subscriptions.map((sub) => (
                                <TableRow key={sub.id} className="cursor-pointer hover:bg-muted/50">
                                    <TableCell>
                                        <Link href={`/admin/dashboard/subscriptions/${sub.id}`} className="font-medium hover:underline text-primary">
                                            {sub.purchaser_email}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        {sub.organization ? (
                                            <div className="flex items-center gap-1">
                                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-sm">{sub.organization.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">
                                            {sub.subscription_tier?.display_name || 'Unknown'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{sub.license_count || 1}</TableCell>
                                    <TableCell>
                                        <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
                                            {sub.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(sub.created_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/admin/dashboard/subscriptions/${sub.id}`}>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {subscriptions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                        No subscriptions found
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
