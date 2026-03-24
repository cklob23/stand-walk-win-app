import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Ticket, TrendingUp, Building2, Copy, ExternalLink, Bell, GraduationCap, BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

async function getOrgStats(organizationId: string) {
    const supabase = createAdminClient()

    // Get access codes stats - count by claimed_by to be accurate
    const { data: accessCodes } = await supabase
        .from('access_codes')
        .select('status, claimed_by')
        .eq('organization_id', organizationId)

    const availableCodes = accessCodes?.filter(c => c.claimed_by === null).length || 0
    const usedCodes = accessCodes?.filter(c => c.claimed_by !== null).length || 0

    // Active members = users who have claimed access codes (not the org admin who purchased)
    const memberCount = usedCodes

    // Get ALL subscription info for the org
    const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('*, subscription_tiers(name, display_name, max_learners)')
        .eq('organization_id', organizationId)
        .eq('status', 'active')

    // Calculate total licenses and plan names
    const totalLicenses = subscriptions?.reduce((sum, sub) => sum + (sub.license_count || 0), 0) || 0
    const planNames = [...new Set(subscriptions?.map(sub => sub.subscription_tiers?.display_name).filter(Boolean))] as string[]

    // Get pending member requests
    const { data: pendingRequests } = await supabase
        .from('org_member_requests')
        .select(`
      id,
      user_id,
      request_type,
      created_at,
      user:profiles!org_member_requests_user_id_fkey(full_name, email)
    `)
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5)

    return {
        memberCount: memberCount || 0,
        availableCodes,
        usedCodes,
        totalCodes: availableCodes + usedCodes,
        subscriptions,
        totalLicenses,
        planNames,
        pendingRequests: pendingRequests || [],
    }
}

async function getMasterStats() {
    const supabase = createAdminClient()

    const { count: orgCount } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true })

    const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    const { count: activeSubCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

    const { data: recentSubs } = await supabase
        .from('subscriptions')
        .select('*, subscription_tiers(display_name)')
        .order('created_at', { ascending: false })
        .limit(5)

    return {
        orgCount: orgCount || 0,
        userCount: userCount || 0,
        activeSubCount: activeSubCount || 0,
        recentSubs: recentSubs || [],
    }
}

export default async function AdminDashboardPage() {
    const adminData = await getAdminUser()

    if (!adminData) {
        redirect('/admin/login')
    }

    const { isMasterAdmin, organization, profile } = adminData

    if (isMasterAdmin) {
        const stats = await getMasterStats()

        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Master Admin Dashboard</h1>
                    <p className="text-muted-foreground">System overview and management</p>
                </div>

                {/* Key Stats */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.orgCount}</div>
                            <p className="text-xs text-muted-foreground">Total organizations</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Users</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.userCount}</div>
                            <p className="text-xs text-muted-foreground">Total registered users</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.activeSubCount}</div>
                            <p className="text-xs text-muted-foreground">Currently active</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">This Month</CardTitle>
                            <TrendingUp className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">+{stats.recentSubs.length}</div>
                            <p className="text-xs text-muted-foreground">New subscriptions</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Actions */}
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                            <CardDescription>Manage your platform</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button asChild className="w-full justify-start" variant="outline">
                                <Link href="/admin/dashboard/organizations">
                                    <Building2 className="mr-2 h-4 w-4" />
                                    Manage Organizations
                                </Link>
                            </Button>
                            <Button asChild className="w-full justify-start" variant="outline">
                                <Link href="/admin/dashboard/users">
                                    <Users className="mr-2 h-4 w-4" />
                                    View All Users
                                </Link>
                            </Button>
                            <Button asChild className="w-full justify-start" variant="outline">
                                <Link href="/admin/dashboard/subscriptions">
                                    <Ticket className="mr-2 h-4 w-4" />
                                    Manage Subscriptions
                                </Link>
                            </Button>
                            <Button asChild className="w-full justify-start" variant="outline">
                                <Link href="/admin/dashboard/analytics">
                                    <TrendingUp className="mr-2 h-4 w-4" />
                                    View Analytics
                                </Link>
                            </Button>

                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Subscriptions</CardTitle>
                            <CardDescription>Latest subscription activity</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {stats.recentSubs.length > 0 ? (
                                <div className="space-y-3">
                                    {stats.recentSubs.map((sub: any) => (
                                        <div key={sub.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                                            <div>
                                                <p className="font-medium text-sm">{sub.purchaser_email}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {sub.subscription_tiers?.display_name} - {sub.license_count} license(s)
                                                </p>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(sub.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-sm">No recent subscriptions</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    // Org Admin Dashboard
    if (!organization) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h1 className="text-xl font-bold mb-2">No Organization Found</h1>
                <p className="text-muted-foreground mb-4">
                    Your account is not linked to any organization yet.
                </p>
                <Button asChild>
                    <Link href="/pricing">Purchase a Subscription</Link>
                </Button>
            </div>
        )
    }

    const stats = await getOrgStats(organization.id)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Welcome, {profile?.full_name || 'Admin'}</h1>
                <p className="text-muted-foreground">Manage your organization and members</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Members</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.memberCount}</div>
                        <p className="text-xs text-muted-foreground">Active members</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Available Codes</CardTitle>
                        <Ticket className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.availableCodes}</div>
                        <p className="text-xs text-muted-foreground">Ready to distribute</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Used Codes</CardTitle>
                        <Ticket className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.usedCodes}</div>
                        <p className="text-xs text-muted-foreground">Of {stats.totalCodes} total</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Plan</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.planNames.length > 0
                                ? (stats.planNames.length === 1
                                    ? stats.planNames[0]
                                    : `${stats.planNames.length} Plans`)
                                : 'No Plan'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stats.totalLicenses} license{stats.totalLicenses !== 1 ? 's' : ''}
                            {stats.planNames.length > 1 && (
                                <span className="block mt-0.5">{stats.planNames.join(', ')}</span>
                            )}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Requests Notification */}
            {stats.pendingRequests.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/50">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-amber-800">
                            <Bell className="h-5 w-5" />
                            Pending Member Requests
                            <Badge variant="secondary" className="bg-amber-200 text-amber-800">
                                {stats.pendingRequests.length}
                            </Badge>
                        </CardTitle>
                        <CardDescription className="text-amber-700">
                            Members waiting for your approval
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats.pendingRequests.map((req: any) => {
                                const user = Array.isArray(req.user) ? req.user[0] : req.user
                                return (
                                    <div key={req.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200">
                                        <div className="flex items-center gap-3">
                                            {req.request_type === 'become_leader' ? (
                                                <GraduationCap className="h-5 w-5 text-primary" />
                                            ) : (
                                                <BookOpen className="h-5 w-5 text-blue-600" />
                                            )}
                                            <div>
                                                <p className="font-medium text-sm">{user?.full_name || user?.email || 'Unknown'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {req.request_type === 'become_leader' ? 'Wants to become a leader' : 'Wants a new journey'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <Button asChild className="w-full mt-4">
                            <Link href="/admin/dashboard/requests">
                                Review All Requests
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}

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
    )
}
