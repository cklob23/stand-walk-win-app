import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
    Shield,
    Database,
    Server,
    Mail,
    CreditCard,
    Globe,
    Lock,
    RefreshCw
} from 'lucide-react'

async function getSystemInfo() {
    const supabase = createAdminClient()

    // Get counts for system overview
    const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    const { count: totalOrgs } = await supabase
        .from('organizations')
        .select('*', { count: 'exact', head: true })

    const { count: totalSubs } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })

    const { count: totalCodes } = await supabase
        .from('access_codes')
        .select('*', { count: 'exact', head: true })

    return {
        totalUsers: totalUsers || 0,
        totalOrgs: totalOrgs || 0,
        totalSubs: totalSubs || 0,
        totalCodes: totalCodes || 0,
    }
}

export default async function MasterSystemPage() {
    const adminData = await getAdminUser()

    if (!adminData) {
        redirect('/admin/login')
    }

    if (!adminData.isMasterAdmin) {
        redirect('/admin/dashboard')
    }

    const systemInfo = await getSystemInfo()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">System Settings</h1>
                <p className="text-muted-foreground">Configure platform-wide settings</p>
            </div>

            {/* System Status */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        System Status
                    </CardTitle>
                    <CardDescription>Current platform health and statistics</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="flex items-center justify-between p-3 rounded-lg border">
                            <span className="text-sm text-muted-foreground">Database</span>
                            <Badge variant="default" className="bg-green-500">Connected</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border">
                            <span className="text-sm text-muted-foreground">Auth</span>
                            <Badge variant="default" className="bg-green-500">Active</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border">
                            <span className="text-sm text-muted-foreground">Payments</span>
                            <Badge variant="default" className="bg-green-500">Configured</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border">
                            <span className="text-sm text-muted-foreground">Email</span>
                            <Badge variant="default" className="bg-green-500">Active</Badge>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-4 mt-4">
                        <div className="text-center p-4 rounded-lg bg-muted">
                            <div className="text-2xl font-bold">{systemInfo.totalUsers}</div>
                            <p className="text-xs text-muted-foreground">Total Users</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-muted">
                            <div className="text-2xl font-bold">{systemInfo.totalOrgs}</div>
                            <p className="text-xs text-muted-foreground">Organizations</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-muted">
                            <div className="text-2xl font-bold">{systemInfo.totalSubs}</div>
                            <p className="text-xs text-muted-foreground">Subscriptions</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-muted">
                            <div className="text-2xl font-bold">{systemInfo.totalCodes}</div>
                            <p className="text-xs text-muted-foreground">Access Codes</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Integrations */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Integrations
                    </CardTitle>
                    <CardDescription>Connected services and APIs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-3">
                            <Database className="h-5 w-5 text-green-500" />
                            <div>
                                <p className="font-medium">Supabase</p>
                                <p className="text-sm text-muted-foreground">Database & Authentication</p>
                            </div>
                        </div>
                        <Badge variant="default" className="bg-green-500">Connected</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-3">
                            <CreditCard className="h-5 w-5 text-purple-500" />
                            <div>
                                <p className="font-medium">Stripe</p>
                                <p className="text-sm text-muted-foreground">Payment Processing</p>
                            </div>
                        </div>
                        <Badge variant="default" className="bg-green-500">Connected</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-3">
                            <Mail className="h-5 w-5 text-blue-500" />
                            <div>
                                <p className="font-medium">Nodemailer</p>
                                <p className="text-sm text-muted-foreground">Email Delivery</p>
                            </div>
                        </div>
                        <Badge variant="default" className="bg-green-500">Connected</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Security Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lock className="h-5 w-5" />
                        Security
                    </CardTitle>
                    <CardDescription>Platform security settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Email Verification Required</p>
                            <p className="text-sm text-muted-foreground">
                                Users must verify their email before accessing the platform
                            </p>
                        </div>
                        <Switch defaultChecked disabled />
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Access Code Required for Signup</p>
                            <p className="text-sm text-muted-foreground">
                                Users need a valid access code to create an account
                            </p>
                        </div>
                        <Switch defaultChecked disabled />
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Two-Factor Authentication</p>
                            <p className="text-sm text-muted-foreground">
                                Optional 2FA for admin accounts
                            </p>
                        </div>
                        <Switch disabled />
                    </div>
                </CardContent>
            </Card>

            {/* Admin Account */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Your Admin Account
                    </CardTitle>
                    <CardDescription>Master administrator details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label>Name</Label>
                            <Input value={adminData.profile?.full_name || ''} disabled />
                        </div>
                        <div>
                            <Label>Email</Label>
                            <Input value={adminData.user.email || ''} disabled />
                        </div>
                    </div>
                    <div>
                        <Label>Role</Label>
                        <div className="mt-1">
                            <Badge variant="destructive" className="text-sm">
                                <Shield className="h-3 w-3 mr-1" />
                                Master Administrator
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
