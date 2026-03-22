import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Users, Crown, GraduationCap, Shield, Building2 } from 'lucide-react'
import { DeleteUserButton } from '@/components/admin/delete-user-button'

async function getAllUsers() {
    const supabase = createAdminClient()

    const { data: users, error } = await supabase
        .from('profiles')
        .select(`
      *,
      organization:organizations!profiles_organization_id_fkey(id, name),
      subscription_tier:subscription_tiers(id, name, display_name)
    `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching users:', error)
        return []
    }

    // Get all active pairings with leader and learner names, journey info, and current week
    const { data: pairings } = await supabase
        .from('pairings')
        .select(`
      leader_id,
      learner_id,
      current_week,
      journey_id,
      leader:profiles!pairings_leader_id_fkey(id, full_name),
      learner:profiles!pairings_learner_id_fkey(id, full_name),
      journey:journeys(id, name)
    `)
        .eq('status', 'active')

    // Create maps for quick lookup
    const leaderToLearners = new Map<string, string[]>()
    const learnerToLeader = new Map<string, string>()
    const userToJourney = new Map<string, { journeyName: string; currentWeek: number }>()

    if (pairings) {
        for (const pairing of pairings) {
            // Get learner name for this pairing
            const learnerData = pairing.learner as unknown
            const learnerName = learnerData && typeof learnerData === 'object' && 'full_name' in learnerData
                ? (learnerData as { full_name: string | null }).full_name
                : null

            // Get leader name for this pairing
            const leaderData = pairing.leader as unknown
            const leaderName = leaderData && typeof leaderData === 'object' && 'full_name' in leaderData
                ? (leaderData as { full_name: string | null }).full_name
                : null

            // Map leader to their learners
            if (pairing.leader_id && learnerName) {
                const existing = leaderToLearners.get(pairing.leader_id) || []
                existing.push(learnerName)
                leaderToLearners.set(pairing.leader_id, existing)
            }

            // Map learner to their leader
            if (pairing.learner_id && leaderName) {
                learnerToLeader.set(pairing.learner_id, leaderName)
            }

            // Get journey name for this pairing
            const journeyData = pairing.journey as unknown
            const journeyName = journeyData && typeof journeyData === 'object' && 'name' in journeyData
                ? (journeyData as { name: string }).name
                : null

            // Map users to their journey info (both learner and leader)
            if (journeyName && pairing.current_week) {
                if (pairing.learner_id) {
                    userToJourney.set(pairing.learner_id, {
                        journeyName,
                        currentWeek: pairing.current_week
                    })
                }
                if (pairing.leader_id) {
                    // For leaders, only track if they don't have one yet (use first/primary)
                    if (!userToJourney.has(pairing.leader_id)) {
                        userToJourney.set(pairing.leader_id, {
                            journeyName,
                            currentWeek: pairing.current_week
                        })
                    }
                }
            }
        }
    }

    // Attach pairing info to users
    return (users || []).map(user => {
        const journeyInfo = userToJourney.get(user.id)
        return {
            ...user,
            paired_with: user.role === 'leader'
                ? leaderToLearners.get(user.id)?.join(', ') || null
                : learnerToLeader.get(user.id) || null,
            journey_name: journeyInfo?.journeyName || null,
            current_week: journeyInfo?.currentWeek || null
        }
    })
}

export default async function MasterUsersPage() {
    const adminData = await getAdminUser()

    if (!adminData) {
        redirect('/admin/login')
    }

    if (!adminData.isMasterAdmin) {
        redirect('/admin/dashboard')
    }

    const users = await getAllUsers()

    const totalUsers = users.length
    const leaders = users.filter(u => u.role === 'leader').length
    const learners = users.filter(u => u.role === 'learner').length
    const admins = users.filter(u => u.admin_role).length

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">All Users</h1>
                <p className="text-muted-foreground">Manage all users across the platform</p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalUsers}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Leaders</CardTitle>
                        <Crown className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{leaders}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Learners</CardTitle>
                        <GraduationCap className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{learners}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Admins</CardTitle>
                        <Shield className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{admins}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>View and manage all user accounts</CardDescription>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                    <div className="overflow-x-auto">
                        <Table className="min-w-[900px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">User</TableHead>
                                    <TableHead className="whitespace-nowrap">Role</TableHead>
                                    <TableHead className="whitespace-nowrap">Journey</TableHead>
                                    <TableHead className="whitespace-nowrap">Week</TableHead>
                                    <TableHead className="whitespace-nowrap">Paired With</TableHead>
                                    <TableHead className="whitespace-nowrap">Admin Role</TableHead>
                                    <TableHead className="whitespace-nowrap">Organization</TableHead>
                                    <TableHead className="whitespace-nowrap">Tier</TableHead>
                                    <TableHead className="whitespace-nowrap">Joined</TableHead>
                                    <TableHead className="w-16 whitespace-nowrap">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={user.avatar_url || ''} />
                                                    <AvatarFallback>
                                                        {user.full_name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{user.full_name || 'Unknown'}</p>
                                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {user.role ? (
                                                <Badge variant={user.role === 'leader' ? 'default' : 'secondary'}>
                                                    {user.role === 'leader' ? 'Leader' : 'Learner'}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {user.journey_name ? (
                                                <span className="font-medium">{user.journey_name}</span>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {user.current_week ? (
                                                <Badge variant="outline" className="text-xs">
                                                    Week {user.current_week}/6
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {user.paired_with || '-'}
                                        </TableCell>
                                        <TableCell>
                                            {user.admin_role ? (
                                                <Badge variant="outline" className={
                                                    user.admin_role === 'master_admin'
                                                        ? 'border-red-500 text-red-500'
                                                        : 'border-amber-500 text-amber-600'
                                                }>
                                                    {user.admin_role === 'master_admin' ? 'Master Admin' : 'Org Admin'}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {user.organization ? (
                                                <div className="flex items-center gap-1">
                                                    <Building2 className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-sm">{user.organization.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {user.subscription_tier ? (
                                                <Badge variant="secondary">
                                                    {user.subscription_tier.display_name}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">No Tier</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <DeleteUserButton
                                                userId={user.id}
                                                userName={user.full_name || 'Unknown'}
                                                userEmail={user.email || ''}
                                                currentAdminId={adminData.user.id}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {users.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                                            No users found
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
