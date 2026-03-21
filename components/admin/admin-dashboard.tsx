'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Users,
    BookOpen,
    Crown,
    Settings,
    Search,
    Shield,
    ShieldCheck,
    GraduationCap,
    TrendingUp,
    UserCheck,
    Layers,
    Building2,
    UserPlus,
    Trash2,
    Ticket
} from 'lucide-react'
import type { Profile, SubscriptionTier, Journey, AdminRole, Organization, OrganizationMember } from '@/lib/types'
import type { AdminPermissions } from '@/lib/admin-actions'
import {
    updateUserTier,
    grantJourneyAccess,
    toggleUserAdmin,
    toggleCanBeLeader,
    getAllOrganizations,
    createOrganization,
    updateOrganization,
    addUserToOrganization,
    removeUserFromOrganization,
    getOrganizationMembers,
    setUserAdminRole,
    getAvailableUsersForOrg
} from '@/lib/admin-actions'
import { Spinner } from '@/components/ui/spinner'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AccessCodesManagement } from './access-codes-management'
import { OrgSettings } from './org-settings'

interface AdminDashboardProps {
    users: (Profile & {
        subscription_tier: SubscriptionTier | null
        learner_count: number
        journey_count: number
    })[]
    tiers: SubscriptionTier[]
    journeys: Journey[]
    stats?: {
        totalUsers: number
        activeLeaders: number
        activeLearners: number
        completedJourneys: number
        activePairings: number
        tierBreakdown: { tier: string; count: number }[]
    }
    adminRole: AdminRole | null
    permissions: AdminPermissions
    myOrganization?: Organization | null
}

export function AdminDashboard({ users, tiers, journeys, stats, adminRole, permissions, myOrganization }: AdminDashboardProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedUser, setSelectedUser] = useState<typeof users[0] | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [showTierDialog, setShowTierDialog] = useState(false)
    const [showJourneyDialog, setShowJourneyDialog] = useState(false)
    const [showAdminRoleDialog, setShowAdminRoleDialog] = useState(false)

    // Organization state
    const [organizations, setOrganizations] = useState<(Organization & { member_count: number })[]>([])
    const [loadingOrgs, setLoadingOrgs] = useState(false)
    const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false)
    const [showOrgMembersDialog, setShowOrgMembersDialog] = useState(false)
    const [selectedOrg, setSelectedOrg] = useState<(Organization & { member_count: number }) | null>(null)
    const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>([])
    const [loadingMembers, setLoadingMembers] = useState(false)

    // Form states
    const [newTierId, setNewTierId] = useState<string>('')
    const [tierReason, setTierReason] = useState('')
    const [tierPaymentRef, setTierPaymentRef] = useState('')
    const [selectedJourneyId, setSelectedJourneyId] = useState<string>('')
    const [journeyPaymentRef, setJourneyPaymentRef] = useState('')
    const [journeyAmount, setJourneyAmount] = useState('')
    const [journeyNotes, setJourneyNotes] = useState('')

    // Admin role form states
    const [newAdminRole, setNewAdminRole] = useState<string>('')
    const [selectedOrgForAdmin, setSelectedOrgForAdmin] = useState<string>('')

    // Org admin add member state
    const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
    const [availableUsers, setAvailableUsers] = useState<typeof users>([])
    const [loadingAvailableUsers, setLoadingAvailableUsers] = useState(false)

    // Organization form states
    const [newOrgName, setNewOrgName] = useState('')
    const [newOrgDescription, setNewOrgDescription] = useState('')
    const [newOrgMaxMembers, setNewOrgMaxMembers] = useState('10')
    const [newOrgTierId, setNewOrgTierId] = useState<string>('')

    // Load organizations on mount (needed for user org display)
    useEffect(() => {
        loadOrganizations()
    }, [])

    const loadOrganizations = async () => {
        setLoadingOrgs(true)
        const result = await getAllOrganizations()
        if (result.success && result.organizations) {
            setOrganizations(result.organizations)
        }
        setLoadingOrgs(false)
    }

    const loadOrgMembers = async (orgId: string) => {
        setLoadingMembers(true)
        const result = await getOrganizationMembers(orgId)
        if (result.success && result.members) {
            setOrgMembers(result.members)
        }
        setLoadingMembers(false)
    }

    const filteredUsers = users.filter(user =>
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Load available users for org admin to add
    const loadAvailableUsers = async () => {
        setLoadingAvailableUsers(true)
        const result = await getAvailableUsersForOrg()
        if (result.success && result.users) {
            setAvailableUsers(result.users as typeof users)
        }
        setLoadingAvailableUsers(false)
    }

    const handleAddMemberToMyOrg = async (userId: string) => {
        if (!myOrganization) return
        setIsLoading(true)
        const result = await addUserToOrganization(userId, myOrganization.id, 'member')
        setIsLoading(false)
        if (result.success) {
            setShowAddMemberDialog(false)
            window.location.reload()
        } else {
            alert(result.error || 'Failed to add member')
        }
    }

    const handleUpdateTier = async () => {
        if (!selectedUser) return
        setIsLoading(true)

        const result = await updateUserTier(
            selectedUser.id,
            newTierId === 'none' ? null : newTierId || null,
            tierReason,
            tierPaymentRef
        )

        setIsLoading(false)
        if (result.success) {
            setShowTierDialog(false)
            setNewTierId('')
            setTierReason('')
            setTierPaymentRef('')
            // Refresh page to get updated data
            window.location.reload()
        } else {
            alert(result.error || 'Failed to update tier')
        }
    }

    const handleGrantJourney = async () => {
        if (!selectedUser || !selectedJourneyId) return
        setIsLoading(true)

        const result = await grantJourneyAccess(
            selectedUser.id,
            selectedJourneyId,
            journeyPaymentRef || undefined,
            journeyAmount ? parseFloat(journeyAmount) : undefined,
            journeyNotes || undefined
        )

        setIsLoading(false)
        if (result.success) {
            setShowJourneyDialog(false)
            setSelectedJourneyId('')
            setJourneyPaymentRef('')
            setJourneyAmount('')
            setJourneyNotes('')
            window.location.reload()
        } else {
            alert(result.error || 'Failed to grant journey access')
        }
    }

    const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
        setIsLoading(true)
        const result = await toggleUserAdmin(userId, !currentIsAdmin)
        setIsLoading(false)
        if (result.success) {
            window.location.reload()
        } else {
            alert(result.error || 'Failed to toggle admin status')
        }
    }

    const handleToggleCanBeLeader = async (userId: string, currentCanBeLeader: boolean) => {
        setIsLoading(true)
        const result = await toggleCanBeLeader(userId, !currentCanBeLeader)
        setIsLoading(false)
        if (result.success) {
            window.location.reload()
        } else {
            alert(result.error || 'Failed to toggle leader status')
        }
    }

    const handleSetAdminRole = async () => {
        if (!selectedUser) return
        setIsLoading(true)

        const role = newAdminRole === 'none' ? null : (newAdminRole as AdminRole)
        const orgId = newAdminRole === 'org_admin' ? selectedOrgForAdmin : null

        const result = await setUserAdminRole(selectedUser.id, role, orgId)
        setIsLoading(false)

        if (result.success) {
            setShowAdminRoleDialog(false)
            setNewAdminRole('')
            setSelectedOrgForAdmin('')
            window.location.reload()
        } else {
            alert(result.error || 'Failed to set admin role')
        }
    }

    const handleCreateOrganization = async () => {
        if (!newOrgName) return
        setIsLoading(true)

        const result = await createOrganization(
            newOrgName,
            parseInt(newOrgMaxMembers) || 10,
            newOrgTierId === 'none' ? null : newOrgTierId || null,
            newOrgDescription || undefined
        )

        setIsLoading(false)
        if (result.success) {
            setShowCreateOrgDialog(false)
            setNewOrgName('')
            setNewOrgDescription('')
            setNewOrgMaxMembers('10')
            setNewOrgTierId('')
            loadOrganizations()
        } else {
            alert(result.error || 'Failed to create organization')
        }
    }

    const handleAddUserToOrg = async (userId: string, orgId: string, role: 'admin' | 'member' = 'member') => {
        setIsLoading(true)
        const result = await addUserToOrganization(userId, orgId, role)
        setIsLoading(false)

        if (result.success) {
            // Reload org members and organizations to update counts
            await loadOrgMembers(orgId)
            // Fetch fresh organizations data
            const orgsResult = await getAllOrganizations()
            if (orgsResult.success && orgsResult.organizations) {
                setOrganizations(orgsResult.organizations)
                // Update selectedOrg with fresh data
                const updatedOrg = orgsResult.organizations.find(o => o.id === orgId)
                if (updatedOrg) {
                    setSelectedOrg(updatedOrg)
                }
            }
        } else {
            alert(result.error || 'Failed to add user to organization')
        }
    }

    const handleRemoveUserFromOrg = async (userId: string, orgId: string) => {
        if (!confirm('Are you sure you want to remove this user from the organization?')) return

        setIsLoading(true)
        const result = await removeUserFromOrganization(userId, orgId)
        setIsLoading(false)

        if (result.success) {
            // Reload org members and fetch fresh organizations data
            await loadOrgMembers(orgId)
            const orgsResult = await getAllOrganizations()
            if (orgsResult.success && orgsResult.organizations) {
                setOrganizations(orgsResult.organizations)
                // Update selectedOrg with fresh data
                const updatedOrg = orgsResult.organizations.find(o => o.id === orgId)
                if (updatedOrg) {
                    setSelectedOrg(updatedOrg)
                }
            }
        } else {
            alert(result.error || 'Failed to remove user from organization')
        }
    }

    // Get admin role display label
    const getAdminRoleLabel = (role: AdminRole | null | undefined) => {
        if (role === 'master_admin') return 'Master Admin'
        if (role === 'org_admin') return 'Org Admin'
        return null
    }

    return (
        <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        {adminRole === 'org_admin' && myOrganization
                            ? `${myOrganization.name} - Admin`
                            : 'Admin Dashboard'}
                    </h1>
                    <p className="text-muted-foreground">
                        {adminRole === 'master_admin' ? 'Full system administration' :
                            adminRole === 'org_admin' ? `Manage your organization members (${users.length} / ${myOrganization?.max_users || 0} members)` :
                                'Manage users, subscriptions, and journeys'}
                    </p>
                </div>
                <Badge variant="secondary" className="gap-1">
                    <Shield className="h-3 w-3" />
                    {adminRole === 'org_admin' ? 'Org Admin' : 'Admin'}
                </Badge>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                    <Users className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.totalUsers}</p>
                                    <p className="text-xs text-muted-foreground">Total Users</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                                    <Crown className="h-5 w-5 text-success" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.activeLeaders}</p>
                                    <p className="text-xs text-muted-foreground">Active Leaders</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                                    <UserCheck className="h-5 w-5 text-secondary-foreground" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.activeLearners}</p>
                                    <p className="text-xs text-muted-foreground">Active Learners</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                                    <TrendingUp className="h-5 w-5 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.activePairings}</p>
                                    <p className="text-xs text-muted-foreground">Active Pairings</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                    <GraduationCap className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.completedJourneys}</p>
                                    <p className="text-xs text-muted-foreground">Completed</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Main Content */}
            <Tabs defaultValue={adminRole === 'org_admin' ? 'members' : 'users'} className="space-y-4">
                <TabsList>
                    {adminRole === 'org_admin' ? (
                        <TabsTrigger value="members" className="gap-2">
                            <Users className="h-4 w-4" />
                            Members
                        </TabsTrigger>
                    ) : (
                        <TabsTrigger value="users" className="gap-2">
                            <Users className="h-4 w-4" />
                            Users
                        </TabsTrigger>
                    )}
                    {permissions.canManageTiers && (
                        <TabsTrigger value="tiers" className="gap-2">
                            <Layers className="h-4 w-4" />
                            Tiers
                        </TabsTrigger>
                    )}
                    {permissions.canManageJourneys && (
                        <TabsTrigger value="journeys" className="gap-2">
                            <BookOpen className="h-4 w-4" />
                            Journeys
                        </TabsTrigger>
                    )}
                    {permissions.canManageOrganizations && (
                        <TabsTrigger value="organizations" className="gap-2">
                            <Building2 className="h-4 w-4" />
                            Organizations
                        </TabsTrigger>
                    )}
                    {(adminRole === 'org_admin' || adminRole === 'master_admin') && myOrganization && (
                        <TabsTrigger value="access-codes" className="gap-2">
                            <Ticket className="h-4 w-4" />
                            Access Codes
                        </TabsTrigger>
                    )}
                    {adminRole === 'org_admin' && myOrganization && (
                        <TabsTrigger value="settings" className="gap-2">
                            <Settings className="h-4 w-4" />
                            Settings
                        </TabsTrigger>
                    )}
                </TabsList>

                {/* Users Tab */}
                <TabsContent value="users" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>User Management</CardTitle>
                                    <CardDescription>View and manage user accounts and subscriptions</CardDescription>
                                </div>
                                <div className="relative w-64">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Search users..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Tier</TableHead>
                                        <TableHead>Organization</TableHead>
                                        <TableHead>Learners</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={user.avatar_url || undefined} />
                                                        <AvatarFallback>
                                                            {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium">{user.full_name || 'No name'}</p>
                                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {user.admin_role === 'org_admin' && !user.role ? (
                                                    <Badge variant="outline" className="text-muted-foreground">
                                                        Admin Only
                                                    </Badge>
                                                ) : user.admin_role === 'master_admin' && !user.role ? (
                                                    <Badge variant="outline" className="text-muted-foreground">
                                                        Admin Only
                                                    </Badge>
                                                ) : (
                                                    <Badge variant={user.role === 'leader' ? 'default' : 'secondary'}>
                                                        {user.role === 'leader' ? 'Leader' : user.role === 'learner' ? 'Learner' : 'Not on Journey'}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {user.subscription_tier?.display_name || 'No Tier'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {user.organization_id ? (
                                                    <Badge variant="outline" className="gap-1">
                                                        <Building2 className="h-3 w-3" />
                                                        {organizations.find(o => o.id === user.organization_id)?.name || 'Unknown Org'}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {(user.admin_role === 'org_admin' || user.admin_role === 'master_admin') && !user.role ? (
                                                    <span className="text-sm text-muted-foreground">-</span>
                                                ) : (
                                                    <span className="text-sm">
                                                        {user.learner_count} / {user.subscription_tier?.max_learners || 1}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {user.admin_role === 'master_admin' && (
                                                        <Badge variant="destructive" className="gap-1">
                                                            <Shield className="h-3 w-3" />
                                                            Master Admin
                                                        </Badge>
                                                    )}
                                                    {user.admin_role === 'org_admin' && (
                                                        <Badge variant="default" className="gap-1 bg-amber-500">
                                                            <Building2 className="h-3 w-3" />
                                                            Org Admin
                                                        </Badge>
                                                    )}
                                                    {!user.admin_role && user.is_admin && (
                                                        <Badge variant="destructive" className="gap-1">
                                                            <ShieldCheck className="h-3 w-3" />
                                                            Admin (Legacy)
                                                        </Badge>
                                                    )}
                                                    {user.graduated_at && (
                                                        <Badge variant="secondary" className="gap-1">
                                                            <GraduationCap className="h-3 w-3" />
                                                            Graduated
                                                        </Badge>
                                                    )}
                                                    {user.can_be_leader === false && (
                                                        <Badge variant="outline" className="text-muted-foreground">
                                                            No Leader
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {permissions.canManageTiers && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedUser(user)
                                                                setNewTierId(user.subscription_tier_id || '')
                                                                setShowTierDialog(true)
                                                            }}
                                                        >
                                                            Change Tier
                                                        </Button>
                                                    )}
                                                    {permissions.canManageJourneys && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedUser(user)
                                                                setShowJourneyDialog(true)
                                                            }}
                                                        >
                                                            Grant Journey
                                                        </Button>
                                                    )}
                                                    {permissions.canPromoteToAdmin && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedUser(user)
                                                                setNewAdminRole(user.admin_role || 'none')
                                                                setSelectedOrgForAdmin(user.organization_id || '')
                                                                setShowAdminRoleDialog(true)
                                                            }}
                                                            disabled={isLoading}
                                                        >
                                                            <Shield className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Org Admin Members Tab */}
                {adminRole === 'org_admin' && myOrganization && (
                    <TabsContent value="members" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Organization Members</CardTitle>
                                        <CardDescription>
                                            Manage members of {myOrganization.name} ({users.length} / {myOrganization.max_users} members)
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-64">
                                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                placeholder="Search members..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-9"
                                            />
                                        </div>
                                        {users.length < myOrganization.max_users && (
                                            <Button
                                                onClick={() => {
                                                    loadAvailableUsers()
                                                    setShowAddMemberDialog(true)
                                                }}
                                                className="gap-2"
                                            >
                                                <UserPlus className="h-4 w-4" />
                                                Add Member
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                {users.length >= myOrganization.max_users && (
                                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <p className="text-sm text-amber-800">
                                            You have reached your member limit ({myOrganization.max_users} seats). Contact support to add more seats.
                                        </p>
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Member</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Tier</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Joined</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredUsers.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={user.avatar_url || undefined} />
                                                            <AvatarFallback>
                                                                {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{user.full_name || 'No name'}</p>
                                                            <p className="text-xs text-muted-foreground">{user.email}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={user.role === 'leader' ? 'default' : 'secondary'}>
                                                        {user.role === 'leader' ? 'Leader' : 'Learner'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {user.subscription_tier?.display_name || 'No Tier'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {user.admin_role === 'org_admin' && (
                                                            <Badge className="bg-blue-100 text-blue-800 gap-1">
                                                                <ShieldCheck className="h-3 w-3" />
                                                                Org Admin
                                                            </Badge>
                                                        )}
                                                        {user.onboarding_complete ? (
                                                            <Badge variant="outline" className="text-success border-success">Active</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-amber-600 border-amber-500">Onboarding</Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-muted-foreground">
                                                        {new Date(user.created_at).toLocaleDateString()}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (confirm(`Remove ${user.full_name || user.email} from ${myOrganization.name}?`)) {
                                                                handleRemoveUserFromOrg(user.id, myOrganization.id)
                                                            }
                                                        }}
                                                        disabled={isLoading || user.admin_role === 'org_admin'}
                                                        title={user.admin_role === 'org_admin' ? "Cannot remove org admins" : "Remove from organization"}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredUsers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                    No members found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Tiers Tab */}
                <TabsContent value="tiers" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Subscription Tiers</CardTitle>
                            <CardDescription>Available subscription plans and their features</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 sm:grid-cols-3">
                                {tiers.map((tier) => (
                                    <Card key={tier.id} className="relative">
                                        <CardHeader>
                                            <CardTitle className="text-lg">{tier.display_name}</CardTitle>
                                            <CardDescription>
                                                {tier.price_monthly > 0 ? `$${tier.price_monthly}/month` : 'Free'}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ul className="space-y-2 text-sm">
                                                <li className="flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-muted-foreground" />
                                                    Up to {tier.max_learners} learner{tier.max_learners > 1 ? 's' : ''}
                                                </li>
                                                {tier.features?.can_graduate_to_leader && (
                                                    <li className="flex items-center gap-2">
                                                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                                        Can graduate to leader
                                                    </li>
                                                )}
                                                {tier.features?.additional_journeys && (
                                                    <li className="flex items-center gap-2">
                                                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                                                        Additional journeys available
                                                    </li>
                                                )}
                                                {tier.features?.priority_support && (
                                                    <li className="flex items-center gap-2">
                                                        <Crown className="h-4 w-4 text-muted-foreground" />
                                                        Priority support
                                                    </li>
                                                )}
                                            </ul>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Journeys Tab */}
                <TabsContent value="journeys" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Available Journeys</CardTitle>
                            <CardDescription>Discipleship journeys and modules</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Journey</TableHead>
                                        <TableHead>Duration</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {journeys.map((journey) => (
                                        <TableRow key={journey.id}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{journey.name}</p>
                                                    {journey.description && (
                                                        <p className="text-xs text-muted-foreground line-clamp-1">
                                                            {journey.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{journey.total_weeks} weeks</TableCell>
                                            <TableCell>
                                                {journey.price > 0 ? `$${journey.price}` : 'Free'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={journey.is_available ? 'default' : 'secondary'}>
                                                    {journey.is_available ? 'Available' : 'Unavailable'}
                                                </Badge>
                                                {journey.is_default && (
                                                    <Badge variant="outline" className="ml-2">Default</Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Organizations Tab - Master Admin Only */}
                {permissions.canManageOrganizations && (
                    <TabsContent value="organizations" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Organizations</CardTitle>
                                        <CardDescription>
                                            Manage churches, groups, and their member limits
                                        </CardDescription>
                                    </div>
                                    <Button onClick={() => setShowCreateOrgDialog(true)}>
                                        <Building2 className="h-4 w-4 mr-2" />
                                        Create Organization
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {loadingOrgs ? (
                                    <div className="flex justify-center py-8">
                                        <Spinner className="h-8 w-8" />
                                    </div>
                                ) : organizations.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No organizations created yet
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Organization</TableHead>
                                                <TableHead>Members</TableHead>
                                                <TableHead>Tier</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {organizations.map((org) => (
                                                <TableRow key={org.id}>
                                                    <TableCell>
                                                        <div>
                                                            <p className="font-medium">{org.name}</p>
                                                            {org.description && (
                                                                <p className="text-xs text-muted-foreground line-clamp-1">
                                                                    {org.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={org.member_count >= org.max_users ? 'text-destructive' : ''}>
                                                            {org.member_count} / {org.max_users}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {org.subscription_tier ? (
                                                            <Badge variant="outline">{org.subscription_tier.display_name}</Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={org.is_active ? 'default' : 'secondary'}>
                                                            {org.is_active ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedOrg(org)
                                                                loadOrgMembers(org.id)
                                                                setShowOrgMembersDialog(true)
                                                            }}
                                                        >
                                                            Manage Members
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Access Codes Tab */}
                {(adminRole === 'org_admin' || adminRole === 'master_admin') && myOrganization && (
                    <TabsContent value="access-codes">
                        <AccessCodesManagement organizationId={myOrganization.id} organizationName={myOrganization.name} />
                    </TabsContent>
                )}

                {/* Settings Tab */}
                {adminRole === 'org_admin' && myOrganization && (
                    <TabsContent value="settings">
                        <OrgSettings
                            organizationId={myOrganization.id}
                            organizationName={myOrganization.name}
                            initialBranding={{
                                logo_url: (myOrganization as Organization & { branding_logo_url?: string | null }).branding_logo_url || null,
                                church_name: (myOrganization as Organization & { branding_church_name?: string | null }).branding_church_name || null,
                                slogan: (myOrganization as Organization & { branding_slogan?: string | null }).branding_slogan || null,
                                primary_color: (myOrganization as Organization & { branding_primary_color?: string | null }).branding_primary_color || null,
                                secondary_color: (myOrganization as Organization & { branding_secondary_color?: string | null }).branding_secondary_color || null,
                            }}
                        />
                    </TabsContent>
                )}
            </Tabs>

            {/* Change Tier Dialog */}
            <Dialog open={showTierDialog} onOpenChange={setShowTierDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Subscription Tier</DialogTitle>
                        <DialogDescription>
                            Update the subscription tier for {selectedUser?.full_name || 'this user'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>New Tier</Label>
                            <Select value={newTierId} onValueChange={setNewTierId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a tier" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Tier</SelectItem>
                                    {tiers.map((tier) => (
                                        <SelectItem key={tier.id} value={tier.id}>
                                            {tier.display_name} ({tier.max_learners} learners)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Reason (optional)</Label>
                            <Textarea
                                placeholder="Why is this tier being changed?"
                                value={tierReason}
                                onChange={(e) => setTierReason(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Payment Reference (optional)</Label>
                            <Input
                                placeholder="e.g., Stripe payment ID"
                                value={tierPaymentRef}
                                onChange={(e) => setTierPaymentRef(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTierDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateTier} disabled={isLoading}>
                            {isLoading && <Spinner className="mr-2" />}
                            Update Tier
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Grant Journey Dialog */}
            <Dialog open={showJourneyDialog} onOpenChange={setShowJourneyDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Grant Journey Access</DialogTitle>
                        <DialogDescription>
                            Give {selectedUser?.full_name || 'this user'} access to a journey
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Journey</Label>
                            <Select value={selectedJourneyId} onValueChange={setSelectedJourneyId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a journey" />
                                </SelectTrigger>
                                <SelectContent>
                                    {journeys.map((journey) => (
                                        <SelectItem key={journey.id} value={journey.id}>
                                            {journey.name} {journey.price > 0 && `($${journey.price})`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Payment Reference (optional)</Label>
                            <Input
                                placeholder="e.g., Stripe payment ID"
                                value={journeyPaymentRef}
                                onChange={(e) => setJourneyPaymentRef(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Amount Paid (optional)</Label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={journeyAmount}
                                onChange={(e) => setJourneyAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Notes (optional)</Label>
                            <Textarea
                                placeholder="Any additional notes..."
                                value={journeyNotes}
                                onChange={(e) => setJourneyNotes(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowJourneyDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleGrantJourney} disabled={isLoading || !selectedJourneyId}>
                            {isLoading && <Spinner className="mr-2" />}
                            Grant Access
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Organization Dialog */}
            <Dialog open={showCreateOrgDialog} onOpenChange={setShowCreateOrgDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Organization</DialogTitle>
                        <DialogDescription>
                            Create a new organization for a church or group
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Organization Name</Label>
                            <Input
                                placeholder="e.g., First Baptist Church"
                                value={newOrgName}
                                onChange={(e) => setNewOrgName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description (optional)</Label>
                            <Textarea
                                placeholder="Brief description of the organization..."
                                value={newOrgDescription}
                                onChange={(e) => setNewOrgDescription(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Max Members</Label>
                            <Input
                                type="number"
                                placeholder="10"
                                value={newOrgMaxMembers}
                                onChange={(e) => setNewOrgMaxMembers(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Subscription Tier</Label>
                            <Select value={newOrgTierId} onValueChange={setNewOrgTierId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select tier for members" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Default Tier</SelectItem>
                                    {tiers.map((tier) => (
                                        <SelectItem key={tier.id} value={tier.id}>
                                            {tier.display_name} ({tier.max_learners} learners)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateOrgDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateOrganization} disabled={isLoading || !newOrgName}>
                            {isLoading && <Spinner className="mr-2" />}
                            Create Organization
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Organization Members Dialog */}
            <Dialog open={showOrgMembersDialog} onOpenChange={setShowOrgMembersDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedOrg?.name} - Members
                        </DialogTitle>
                        <DialogDescription>
                            {selectedOrg && (
                                <span>
                                    {selectedOrg.member_count} / {selectedOrg.max_users} members
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Add member section */}
                        <div className="flex items-center gap-2 pb-4 border-b">
                            <Select
                                onValueChange={(userId) => {
                                    if (selectedOrg && userId) {
                                        handleAddUserToOrg(userId, selectedOrg.id)
                                    }
                                }}
                            >
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Add a user to this organization..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {users
                                        .filter(u => !u.organization_id || u.organization_id !== selectedOrg?.id)
                                        .map((user) => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {user.full_name ? `${user.full_name} (${user.email})` : user.email}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Members list */}
                        {loadingMembers ? (
                            <div className="flex justify-center py-8">
                                <Spinner className="h-8 w-8" />
                            </div>
                        ) : orgMembers.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No members yet. Add users from the dropdown above.
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {orgMembers.map((member) => (
                                    <div
                                        key={member.id}
                                        className="flex items-center justify-between p-3 rounded-lg border"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={(member.user as Profile)?.avatar_url || undefined} />
                                                <AvatarFallback>
                                                    {(member.user as Profile)?.full_name?.[0] || '?'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium">
                                                    {(member.user as Profile)?.full_name || 'Unknown'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {(member.user as Profile)?.email}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                                                {member.role === 'admin' ? 'Org Admin' : 'Member'}
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => selectedOrg && handleRemoveUserFromOrg(member.user_id, selectedOrg.id)}
                                                disabled={isLoading}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowOrgMembersDialog(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Org Admin Add Member Dialog */}
            {adminRole === 'org_admin' && myOrganization && (
                <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Add Member to {myOrganization.name}</DialogTitle>
                            <DialogDescription>
                                Select a user to add to your organization.
                                You have {myOrganization.max_users - users.length} seat(s) remaining.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            {loadingAvailableUsers ? (
                                <div className="flex justify-center py-8">
                                    <Spinner className="h-8 w-8" />
                                </div>
                            ) : availableUsers.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p>No available users to add.</p>
                                    <p className="text-sm mt-2">Users must first create an account before they can be added to your organization.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {availableUsers.map((user) => (
                                        <div
                                            key={user.id}
                                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={user.avatar_url || undefined} />
                                                    <AvatarFallback>
                                                        {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{user.full_name || 'No name'}</p>
                                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">
                                                    {user.subscription_tier?.display_name || 'No Tier'}
                                                </Badge>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleAddMemberToMyOrg(user.id)}
                                                    disabled={isLoading}
                                                >
                                                    {isLoading ? <Spinner className="h-4 w-4" /> : 'Add'}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
                                Cancel
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Set Admin Role Dialog */}
            {permissions.canPromoteToAdmin && (
                <Dialog open={showAdminRoleDialog} onOpenChange={setShowAdminRoleDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Set Admin Role</DialogTitle>
                            <DialogDescription>
                                Change admin privileges for {selectedUser?.full_name || 'this user'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Admin Role</Label>
                                <Select value={newAdminRole} onValueChange={setNewAdminRole}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Admin Access</SelectItem>
                                        <SelectItem value="org_admin">Organization Admin</SelectItem>
                                        <SelectItem value="master_admin">Master Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {newAdminRole === 'org_admin' && (
                                <div className="space-y-2">
                                    <Label>Organization</Label>
                                    <Select value={selectedOrgForAdmin} onValueChange={setSelectedOrgForAdmin}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select organization" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {organizations.map((org) => (
                                                <SelectItem key={org.id} value={org.id}>
                                                    {org.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowAdminRoleDialog(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSetAdminRole}
                                disabled={isLoading || (newAdminRole === 'org_admin' && !selectedOrgForAdmin)}
                            >
                                {isLoading && <Spinner className="mr-2" />}
                                Set Role
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}
