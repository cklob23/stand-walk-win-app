import { redirect, notFound } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Building2, Users, Key, CreditCard, Mail, Calendar, ArrowLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'

// Display name mapping for admin roles
const ADMIN_ROLE_DISPLAY: Record<string, string> = {
    'master_admin': 'Master Admin',
    'org_admin': 'Organization Admin',
}

// Display name mapping for journey roles
const ROLE_DISPLAY: Record<string, string> = {
    'leader': 'Leader',
    'learner': 'Learner',
}

function getAdminRoleDisplay(role: string | null): string {
    if (!role) return 'Organization Admin'
    return ADMIN_ROLE_DISPLAY[role] || role
}

function getRoleDisplay(role: string | null): string {
    if (!role) return '-'
    return ROLE_DISPLAY[role] || role
}

async function getOrganizationDetails(orgId: string) {
    const supabase = createAdminClient()

    // Get organization
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select(`
      *,
      subscription_tier:subscription_tiers(id, name, display_name, price_monthly)
    `)
        .eq('id', orgId)
        .single()

    if (orgError || !org) {
        return null
    }

    // Get all subscriptions for this org (support multiple plans)
    const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select(`
      *,
      tier:subscription_tiers(id, name, display_name, price_monthly, features)
    `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

    // Get members (profiles with this org)
    const { data: members } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

    // Get access codes
    const { data: accessCodes } = await supabase
        .from('access_codes')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

    // Get owner profile
    let owner = null
    if (org.owner_id) {
        const { data: ownerData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', org.owner_id)
            .single()
        owner = ownerData
    }

    return {
        org,
        subscriptions: subscriptions || [],
        members: members || [],
        accessCodes: accessCodes || [],
        owner,
    }
}

export default async function ManageOrganizationPage({
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

    const data = await getOrganizationDetails(id)

    if (!data) {
        notFound()
    }

    const { org, subscriptions, members, accessCodes, owner } = data

    // Calculate totals from all subscriptions
    const totalLicenses = subscriptions.reduce((sum, sub) => sum + (sub.license_count || 0), 0)
    const totalAmountPaid = subscriptions.reduce((sum, sub) => sum + (sub.amount_paid || 0), 0)

    // Get unique tier names for display
    const tierNames = [...new Set(subscriptions.map(sub =>
        sub.tier?.display_name || sub.tier?.name
    ).filter(Boolean))]

    const availableCodes = accessCodes.filter(c => c.claimed_by === null).length
    const usedCodes = accessCodes.filter(c => c.claimed_by !== null).length
    const activeMembers = members.filter(m => m.role).length

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount / 100)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/dashboard/organizations">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">{org.name}</h1>
                    <p className="text-muted-foreground">Organization ID: {org.slug || org.id}</p>
                </div>
                <Badge variant={org.is_active ? 'default' : 'secondary'} className="text-base px-3 py-1">
                    {org.is_active ? 'Active' : 'Inactive'}
                </Badge>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Members</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeMembers}</div>
                        <p className="text-xs text-muted-foreground">of {org.max_users || '∞'} limit</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Available Codes</CardTitle>
                        <Key className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{availableCodes}</div>
                        <p className="text-xs text-muted-foreground">ready to distribute</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Used Codes</CardTitle>
                        <Key className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{usedCodes}</div>
                        <p className="text-xs text-muted-foreground">claimed by members</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Plans</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {tierNames.length > 0 ? (
                            <div className="space-y-1">
                                <div className="flex flex-wrap gap-1">
                                    {tierNames.map((name, i) => (
                                        <Badge key={i} variant="secondary" className="text-sm">
                                            {name}
                                        </Badge>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    {totalLicenses} licenses - {formatCurrency(totalAmountPaid)}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <div className="text-2xl font-bold">None</div>
                                <p className="text-xs text-muted-foreground">No subscription</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Organization Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Organization Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Name</span>
                            <span className="font-medium">{org.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Slug</span>
                            <span className="font-mono text-sm">{org.slug}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Admin Email</span>
                            <span className="text-sm">{org.admin_email || 'Not set'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span className="text-sm">{new Date(org.created_at).toLocaleDateString()}</span>
                        </div>
                        {org.church_name && (
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Church Name</span>
                                <span className="text-sm">{org.church_name}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Owner / Admin Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Organization Owner
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {owner ? (
                            <>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Name</span>
                                    <span className="font-medium">{owner.full_name || 'Not set'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Email</span>
                                    <span className="text-sm">{owner.email}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Role</span>
                                    <Badge variant="outline">{getAdminRoleDisplay(owner.admin_role)}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Joined</span>
                                    <span className="text-sm">{new Date(owner.created_at).toLocaleDateString()}</span>
                                </div>
                            </>
                        ) : (
                            <p className="text-muted-foreground text-center py-4">No owner assigned</p>
                        )}
                    </CardContent>
                </Card>

                {/* Subscription Info - Show all subscriptions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Subscription Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {subscriptions.length > 0 ? (
                            <div className="space-y-4">
                                {subscriptions.map((sub, index) => (
                                    <div key={sub.id} className={index > 0 ? 'pt-4 border-t' : ''}>
                                        <div className="flex items-center justify-between mb-2">
                                            <Badge>{sub.tier?.display_name || 'Standard'}</Badge>
                                            <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
                                                {sub.status}
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <span className="text-muted-foreground">Licenses:</span>
                                            <span className="text-right">{sub.license_count}</span>
                                            <span className="text-muted-foreground">Amount:</span>
                                            <span className="text-right">{formatCurrency(sub.amount_paid || 0)}</span>
                                            <span className="text-muted-foreground">Purchaser:</span>
                                            <span className="text-right truncate">{sub.purchaser_email}</span>
                                        </div>
                                    </div>
                                ))}
                                <div className="pt-4 border-t">
                                    <div className="flex items-center justify-between font-medium">
                                        <span>Total</span>
                                        <span>{totalLicenses} licenses - {formatCurrency(totalAmountPaid)}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center py-4">No subscription</p>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>Manage this organization</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href={`/admin/dashboard/organizations/${id}/generate-codes`}>
                                <Key className="mr-2 h-4 w-4" />
                                Generate Access Codes
                            </Link>
                        </Button>
                        {(org.admin_email || owner?.email) && (
                            <Button variant="outline" className="w-full justify-start" asChild>
                                <a href={`mailto:${org.admin_email || owner?.email}?subject=Regarding your Stand Walk Run organization: ${org.name}`}>
                                    <Mail className="mr-2 h-4 w-4" />
                                    Email Organization Admin
                                </a>
                            </Button>
                        )}
                        {subscriptions.length > 0 && subscriptions[0].id && (
                            <Button variant="outline" className="w-full justify-start" asChild>
                                <Link href={`/admin/dashboard/subscriptions/${subscriptions[0].id}`}>
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Manage Subscription
                                </Link>
                            </Button>
                        )}
                        {subscriptions.length === 0 && (
                            <Button variant="outline" className="w-full justify-start text-muted-foreground" disabled>
                                <CreditCard className="mr-2 h-4 w-4" />
                                No Subscription
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Members Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Organization Members</CardTitle>
                    <CardDescription>Users associated with this organization</CardDescription>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                    <div className="overflow-x-auto">
                        <Table className="min-w-[600px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Name</TableHead>
                                    <TableHead className="whitespace-nowrap">Email</TableHead>
                                    <TableHead className="whitespace-nowrap">Role</TableHead>
                                    <TableHead className="whitespace-nowrap">Admin Role</TableHead>
                                    <TableHead className="whitespace-nowrap">Joined</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-medium">{member.full_name || 'Not set'}</TableCell>
                                        <TableCell>{member.email}</TableCell>
                                        <TableCell>
                                            {member.role ? (
                                                <Badge variant={member.role === 'leader' ? 'default' : 'secondary'}>
                                                    {getRoleDisplay(member.role)}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {member.admin_role ? (
                                                <Badge variant="outline">{getAdminRoleDisplay(member.admin_role)}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(member.created_at).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {members.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                            No members found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Access Codes Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Access Codes</CardTitle>
                    <CardDescription>All access codes for this organization</CardDescription>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                    <div className="overflow-x-auto">
                        <Table className="min-w-[500px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Code</TableHead>
                                    <TableHead className="whitespace-nowrap">Status</TableHead>
                                    <TableHead className="whitespace-nowrap">Created</TableHead>
                                    <TableHead className="whitespace-nowrap">Expires</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {accessCodes.slice(0, 10).map((code) => (
                                    <TableRow key={code.id}>
                                        <TableCell className="font-mono">{code.code}</TableCell>
                                        <TableCell>
                                            <Badge variant={code.status === 'available' ? 'outline' : 'secondary'}>
                                                {code.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(code.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {code.expires_at ? new Date(code.expires_at).toLocaleDateString() : 'Never'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {accessCodes.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                            No access codes found
                                        </TableCell>
                                    </TableRow>
                                )}
                                {accessCodes.length > 10 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                                            Showing 10 of {accessCodes.length} codes
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
