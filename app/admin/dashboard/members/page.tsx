import { redirect } from 'next/navigation'
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
import { Users, UserCheck, UserX } from 'lucide-react'

interface MemberWithPairedLearner {
    id: string
    full_name: string | null
    email: string | null
    role: string | null
    created_at: string
    is_paired_learner?: boolean
    paired_with_leader?: string | null
    subscription_tier?: { name: string; display_name: string } | null
}

async function getMembers(organizationId: string, adminUserId: string): Promise<MemberWithPairedLearner[]> {
    const supabase = createAdminClient()

    // Get members who used access codes to join this organization (leaders)
    const { data: usedCodes, error: codesError } = await supabase
        .from('access_codes')
        .select('claimed_by')
        .eq('organization_id', organizationId)
        .not('claimed_by', 'is', null)

    if (codesError) {
        console.error('Error fetching access codes:', codesError)
        return []
    }

    // Get the user IDs who actually used access codes (these are leaders)
    const leaderIds = usedCodes?.map(c => c.claimed_by).filter(Boolean) || []

    // Get all active pairings for these leaders (to get both leader->learner and learner->leader relationships)
    let allPairings: { leader_id: string; learner_id: string | null; learner_name: string | null; leader_name: string | null }[] = []

    if (leaderIds.length > 0) {
        const { data: pairings } = await supabase
            .from('pairings')
            .select(`
        leader_id,
        learner_id,
        learner:profiles!pairings_learner_id_fkey(full_name),
        leader:profiles!pairings_leader_id_fkey(full_name)
      `)
            .in('leader_id', leaderIds)
            .eq('status', 'active')
            .not('learner_id', 'is', null)

        if (pairings) {
            allPairings = pairings.map(p => {
                const learnerData = p.learner as unknown
                const leaderData = p.leader as unknown
                return {
                    leader_id: p.leader_id,
                    learner_id: p.learner_id,
                    learner_name: learnerData && typeof learnerData === 'object' && 'full_name' in learnerData
                        ? (learnerData as { full_name: string | null }).full_name
                        : null,
                    leader_name: leaderData && typeof leaderData === 'object' && 'full_name' in leaderData
                        ? (leaderData as { full_name: string | null }).full_name
                        : null,
                }
            })
        }
    }

    // Get profiles for leaders with their subscription tier
    let leaders: MemberWithPairedLearner[] = []
    if (leaderIds.length > 0) {
        const { data: leaderProfiles, error } = await supabase
            .from('profiles')
            .select(`
        id, full_name, email, role, created_at,
        subscription_tier:subscription_tiers(name, display_name)
      `)
            .in('id', leaderIds)
            .order('created_at', { ascending: false })

        if (!error && leaderProfiles) {
            leaders = leaderProfiles.map(p => {
                // Find learner(s) paired with this leader
                const leaderPairings = allPairings.filter(pair => pair.leader_id === p.id)
                const pairedLearnerNames = leaderPairings
                    .map(pair => pair.learner_name)
                    .filter(Boolean)
                    .join(', ')
                const tierData = p.subscription_tier as unknown
                return {
                    ...p,
                    is_paired_learner: false,
                    paired_with_leader: pairedLearnerNames || null,
                    subscription_tier: tierData && typeof tierData === 'object' && 'name' in tierData
                        ? tierData as { name: string; display_name: string }
                        : null,
                }
            })
        }
    }

    // Now get learners who are paired with these leaders (with their tier from leader)
    if (allPairings.length > 0) {
        const learnerIds = allPairings.map(p => p.learner_id).filter(Boolean) as string[]

        if (learnerIds.length > 0) {
            const { data: learnerProfiles } = await supabase
                .from('profiles')
                .select(`
          id, full_name, email, role, created_at,
          subscription_tier:subscription_tiers(name, display_name)
        `)
                .in('id', learnerIds)

            if (learnerProfiles) {
                const learners: MemberWithPairedLearner[] = learnerProfiles.map(p => {
                    const pairing = allPairings.find(pair => pair.learner_id === p.id)
                    const tierData = p.subscription_tier as unknown
                    return {
                        id: p.id,
                        full_name: p.full_name,
                        email: p.email,
                        role: p.role,
                        created_at: p.created_at,
                        is_paired_learner: true,
                        paired_with_leader: pairing?.leader_name || null,
                        subscription_tier: tierData && typeof tierData === 'object' && 'name' in tierData
                            ? tierData as { name: string; display_name: string }
                            : null,
                    }
                })
                leaders = [...leaders, ...learners]
            }
        }
    }

    return leaders
}

export default async function AdminMembersPage() {
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

    const members = await getMembers(organization.id, adminData.user.id)
    const activeMembers = members.filter(m => m.role)
    const pendingMembers = members.filter(m => !m.role)

    // Count only access codes actually used (not learners who joined via pairing)
    const accessCodesUsed = members.filter(m => !m.is_paired_learner).length

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Team Members</h1>
                <p className="text-muted-foreground">
                    View and manage members of your organization
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Access Codes Used</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{accessCodesUsed}</div>
                        <p className="text-xs text-muted-foreground">
                            of {organization.max_users || 'unlimited'} licenses
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active</CardTitle>
                        <UserCheck className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{activeMembers.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Currently on a journey
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                        <UserX className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{pendingMembers.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Not yet started
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Members Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Members</CardTitle>
                    <CardDescription>
                        Leaders who joined using access codes and their paired learners
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Tier</TableHead>
                                    <TableHead>Paired With</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Joined</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                            No members yet. Share your access codes to invite team members.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    members.map(member => (
                                        <TableRow key={member.id}>
                                            <TableCell className="font-medium">
                                                {member.full_name || 'Unnamed'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {member.email}
                                            </TableCell>
                                            <TableCell>
                                                {member.role ? (
                                                    <Badge variant={member.role === 'leader' ? 'default' : 'secondary'}>
                                                        {member.role === 'leader' ? 'Leader' : 'Learner'}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline">Not assigned</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {member.subscription_tier ? (
                                                    <Badge variant="outline" className="font-normal">
                                                        {member.subscription_tier.display_name}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {member.paired_with_leader || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {member.role ? (
                                                    <Badge className="bg-green-500/10 text-green-600">Active</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-amber-600">Pending</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {new Date(member.created_at).toLocaleDateString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
