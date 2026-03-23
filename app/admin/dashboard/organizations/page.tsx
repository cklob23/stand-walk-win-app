import { redirect } from 'next/navigation'
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
import { Building2, Users, Key, CreditCard } from 'lucide-react'
import Link from 'next/link'

async function getAllOrganizations() {
    const supabase = createAdminClient()

    const { data: organizations, error } = await supabase
        .from('organizations')
        .select(`
      *,
      subscription_tier:subscription_tiers(id, name, display_name)
    `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching organizations:', error)
        return []
    }

    // Get member counts for each org
    const orgsWithCounts = await Promise.all(
        (organizations || []).map(async (org) => {
            // Count from organization_members or profiles with journey role
            const { count: membersCount } = await supabase
                .from('organization_members')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)

            const { count: profilesCount } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)
                .not('role', 'is', null)

            // Count access codes
            const { data: codes } = await supabase
                .from('access_codes')
                .select('status')
                .eq('organization_id', org.id)

            const availableCodes = codes?.filter(c => c.status === 'available').length || 0
            const usedCodes = codes?.filter(c => c.status === 'used').length || 0

            // Get all subscriptions for this org with tier info
            const { data: subscriptions } = await supabase
                .from('subscriptions')
                .select(`
          id,
          license_count,
          status,
          tier:subscription_tiers(id, name, display_name)
        `)
                .eq('organization_id', org.id)
                .eq('status', 'active')

            // Extract unique tiers from subscriptions
            const tiers = subscriptions?.map(sub => {
                const tierData = sub.tier as unknown
                if (Array.isArray(tierData) && tierData[0]) {
                    return tierData[0] as { id: string; name: string; display_name: string }
                } else if (tierData && typeof tierData === 'object' && 'display_name' in tierData) {
                    return tierData as { id: string; name: string; display_name: string }
                }
                return null
            }).filter(Boolean) || []

            // Remove duplicate tiers by id
            const uniqueTiers = tiers.filter((tier, index, self) =>
                tier && self.findIndex(t => t?.id === tier.id) === index
            )

            return {
                ...org,
                member_count: Math.max(membersCount || 0, profilesCount || 0),
                available_codes: availableCodes,
                used_codes: usedCodes,
                all_tiers: uniqueTiers,
            }
        })
    )

    return orgsWithCounts
}

export default async function MasterOrganizationsPage() {
    const adminData = await getAdminUser()

    if (!adminData) {
        redirect('/admin/login')
    }

    if (!adminData.isMasterAdmin) {
        redirect('/admin/dashboard')
    }

    const organizations = await getAllOrganizations()

    const totalOrgs = organizations.length
    const activeOrgs = organizations.filter(o => o.is_active).length
    const totalMembers = organizations.reduce((sum, o) => sum + o.member_count, 0)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Organizations</h1>
                <p className="text-muted-foreground">Manage all organizations in the system</p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOrgs}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active</CardTitle>
                        <Building2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeOrgs}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalMembers}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Inactive</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOrgs - activeOrgs}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Organizations Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Organizations</CardTitle>
                    <CardDescription>View and manage organization accounts</CardDescription>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                    <div className="overflow-x-auto">
                        <Table className="min-w-[800px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Organization</TableHead>
                                    <TableHead className="whitespace-nowrap">Members</TableHead>
                                    <TableHead className="whitespace-nowrap">Access Codes</TableHead>
                                    <TableHead className="whitespace-nowrap">Tier</TableHead>
                                    <TableHead className="whitespace-nowrap">Status</TableHead>
                                    <TableHead className="whitespace-nowrap">Created</TableHead>
                                    <TableHead className="whitespace-nowrap">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {organizations.map((org) => (
                                    <TableRow key={org.id}>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{org.name}</p>
                                                <p className="text-sm text-muted-foreground">{org.slug}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Users className="h-4 w-4 text-muted-foreground" />
                                                {org.member_count} / {org.max_users || '∞'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-green-600">
                                                    {org.available_codes} available
                                                </Badge>
                                                <Badge variant="secondary">
                                                    {org.used_codes} used
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {org.all_tiers && org.all_tiers.length > 0 ? (
                                                    org.all_tiers.map((tier: { id: string; display_name: string } | null) => (
                                                        tier && (
                                                            <Badge key={tier.id} variant="secondary">
                                                                {tier.display_name}
                                                            </Badge>
                                                        )
                                                    ))
                                                ) : (
                                                    <Badge variant="outline" className="text-muted-foreground">
                                                        No Tier
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={org.is_active ? 'default' : 'secondary'}>
                                                {org.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(org.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/admin/dashboard/organizations/${org.id}`}>
                                                    Manage
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {organizations.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                            No organizations found
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
