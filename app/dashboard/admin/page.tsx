import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { getAdminPermissions, getAllUsers, getSubscriptionTiers, getAllJourneys, getAdminStats } from '@/lib/admin-actions'
import type { Organization } from '@/lib/types'

export const metadata = {
    title: 'Admin Dashboard | Stand Walk Run',
    description: 'Manage users, subscriptions, and journeys',
}

export default async function AdminPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Check admin permissions
    const { isAdmin, role, permissions } = await getAdminPermissions()
    if (!isAdmin) {
        redirect('/dashboard')
    }

    // Fetch all data in parallel
    const [usersResult, tiersResult, journeysResult, statsResult] = await Promise.all([
        getAllUsers(),
        getSubscriptionTiers(),
        getAllJourneys(),
        getAdminStats(),
    ])

    // For org admins, fetch their organization details
    let myOrganization: Organization | null = null
    if (role === 'org_admin' && permissions.organizationId) {
        const { data: org } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', permissions.organizationId)
            .single()
        myOrganization = org
    }

    return (
        <AdminDashboard
            users={usersResult.users || []}
            tiers={tiersResult.tiers || []}
            journeys={journeysResult.journeys || []}
            stats={statsResult.stats}
            adminRole={role}
            permissions={permissions}
            myOrganization={myOrganization}
        />
    )
}
