import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { createAdminClient } from '@/lib/supabase/server'
import { AdminAccessCodes } from '@/components/admin/admin-access-codes'

async function getAccessCodes(organizationId: string) {
    const supabase = createAdminClient()

    // Fetch access codes with journey and tier info
    const { data: accessCodes, error } = await supabase
        .from('access_codes')
        .select(`
      *,
      journey:journeys(
        id,
        name
      ),
      tier:subscription_tiers(
        id,
        name,
        display_name
      )
    `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching access codes:', error)
        return []
    }

    // Fetch profile info for used codes
    const usedCodes = (accessCodes || []).filter(c => c.claimed_by)
    const userIds = usedCodes.map(c => c.claimed_by).filter(Boolean)

    let profilesMap: Record<string, { id: string; full_name: string | null; email: string | null }> = {}

    if (userIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds)

        if (profiles) {
            profilesMap = profiles.reduce((acc, p) => {
                acc[p.id] = p
                return acc
            }, {} as typeof profilesMap)
        }
    }

    // Merge profile info into access codes
    return (accessCodes || []).map(code => ({
        ...code,
        used_by_profile: code.claimed_by ? profilesMap[code.claimed_by] || null : null,
    }))
}

export default async function AdminAccessCodesPage() {
    const adminData = await getAdminUser()

    if (!adminData) {
        redirect('/admin/login')
    }

    const { isMasterAdmin, organization } = adminData

    // Master admin should see all codes or filter by org
    if (isMasterAdmin) {
        // For now, redirect to organizations page
        redirect('/admin/dashboard/organizations')
    }

    if (!organization) {
        redirect('/admin/dashboard')
    }

    const accessCodes = await getAccessCodes(organization.id)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Access Codes</h1>
                <p className="text-muted-foreground">
                    Manage and distribute access codes for your organization members
                </p>
            </div>

            <AdminAccessCodes
                accessCodes={accessCodes}
                organizationName={organization.name}
            />
        </div>
    )
}
