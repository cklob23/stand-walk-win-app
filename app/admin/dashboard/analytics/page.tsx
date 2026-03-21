import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    BarChart3,
    Users,
    TrendingUp,
    BookOpen,
    Crown,
    GraduationCap,
    Building2,
    Calendar,
    Target
} from 'lucide-react'

async function getAnalytics() {
    const supabase = createAdminClient()

    // Total users
    const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    // Users by role
    const { count: leaders } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'leader')

    const { count: learners } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'learner')

    // Organizations
    const { count: totalOrgs } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true })

    const { count: activeOrgs } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

    // Journeys
    const { data: journeys } = await supabase
        .from('journeys')
        .select('id, name, is_active')

    // Active subscriptions
    const { count: activeSubs } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

    // Pairings
    const { count: activePairings } = await supabase
        .from('pairings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

    // Access codes - count by claimed_by field (more reliable than status)
    const { data: allCodes } = await supabase
        .from('access_codes')
        .select('status, claimed_by')

    const usedCodes = allCodes?.filter(c => c.claimed_by !== null).length || 0
    const availableCodes = allCodes?.filter(c => c.claimed_by === null).length || 0

    // Get admin count (users with admin_role set but no leader/learner role)
    const { count: adminCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('admin_role', 'is', null)

    // Recent signups (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: recentSignups } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString())

    return {
        totalUsers: totalUsers || 0,
        leaders: leaders || 0,
        learners: learners || 0,
        adminCount: adminCount || 0,
        totalOrgs: totalOrgs || 0,
        activeOrgs: activeOrgs || 0,
        journeys: journeys || [],
        activeSubs: activeSubs || 0,
        activePairings: activePairings || 0,
        availableCodes,
        usedCodes,
        totalCodes: availableCodes + usedCodes,
        recentSignups: recentSignups || 0,
    }
}

export default async function MasterAnalyticsPage() {
    const adminData = await getAdminUser()

    if (!adminData) {
        redirect('/admin/login')
    }

    if (!adminData.isMasterAdmin) {
        redirect('/admin/dashboard')
    }

    const analytics = await getAnalytics()

    const codeUsagePercent = analytics.totalCodes > 0
        ? Math.round((analytics.usedCodes / analytics.totalCodes) * 100)
        : 0

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Analytics</h1>
                <p className="text-muted-foreground">Platform metrics and insights</p>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.totalUsers}</div>
                        <p className="text-xs text-muted-foreground">
                            +{analytics.recentSignups} last 30 days
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Pairings</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.activePairings}</div>
                        <p className="text-xs text-muted-foreground">Leader-learner matches</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Organizations</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.activeOrgs}</div>
                        <p className="text-xs text-muted-foreground">
                            of {analytics.totalOrgs} total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics.activeSubs}</div>
                        <p className="text-xs text-muted-foreground">Paid plans</p>
                    </CardContent>
                </Card>
            </div>

            {/* User Breakdown */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>User Roles</CardTitle>
                        <CardDescription>Distribution of users by role</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Crown className="h-4 w-4 text-amber-500" />
                                <span>Leaders</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{analytics.leaders}</span>
                                <Badge variant="secondary">
                                    {analytics.totalUsers > 0 ? Math.round((analytics.leaders / analytics.totalUsers) * 100) : 0}%
                                </Badge>
                            </div>
                        </div>
                        <Progress
                            value={analytics.totalUsers > 0 ? (analytics.leaders / analytics.totalUsers) * 100 : 0}
                            className="h-2"
                        />

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <GraduationCap className="h-4 w-4 text-blue-500" />
                                <span>Learners</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{analytics.learners}</span>
                                <Badge variant="secondary">
                                    {analytics.totalUsers > 0 ? Math.round((analytics.learners / analytics.totalUsers) * 100) : 0}%
                                </Badge>
                            </div>
                        </div>
                        <Progress
                            value={analytics.totalUsers > 0 ? (analytics.learners / analytics.totalUsers) * 100 : 0}
                            className="h-2"
                        />

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-purple-500" />
                                <span>Admins</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{analytics.adminCount}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Access Code Usage</CardTitle>
                        <CardDescription>Code redemption statistics</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-center py-4">
                            <div className="text-4xl font-bold">{codeUsagePercent}%</div>
                            <p className="text-sm text-muted-foreground">redemption rate</p>
                        </div>
                        <Progress value={codeUsagePercent} className="h-3" />
                        <div className="grid grid-cols-2 gap-4 pt-4">
                            <div className="text-center p-3 rounded-lg bg-muted">
                                <div className="text-xl font-bold text-green-600">{analytics.availableCodes}</div>
                                <p className="text-xs text-muted-foreground">Available</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-muted">
                                <div className="text-xl font-bold">{analytics.usedCodes}</div>
                                <p className="text-xs text-muted-foreground">Used</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Journeys */}
            <Card>
                <CardHeader>
                    <CardTitle>Journeys</CardTitle>
                    <CardDescription>Available journey programs</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        {analytics.journeys.map((journey: any) => (
                            <Card key={journey.id} className="border">
                                <CardContent className="pt-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="h-4 w-4 text-primary" />
                                            <span className="font-medium">{journey.name}</span>
                                        </div>
                                        <Badge variant={journey.is_active ? 'default' : 'secondary'}>
                                            {journey.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {analytics.journeys.length === 0 && (
                            <p className="text-muted-foreground col-span-3 text-center py-4">
                                No journeys configured
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
