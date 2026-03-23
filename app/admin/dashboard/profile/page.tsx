import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { ProfileView } from '@/components/profile/profile-view'
import { createAdminClient } from '@/lib/supabase/server'

export default async function AdminProfilePage() {
    const adminData = await getAdminUser()

    if (!adminData) {
        redirect('/admin/login')
    }

    const { profile, isMasterAdmin, organization } = adminData

    if (!profile) {
        redirect('/admin/dashboard')
    }

    // For org admins, get the organization name
    let organizationName: string | null = null
    if (!isMasterAdmin && organization?.id) {
        const supabase = createAdminClient()
        const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', organization.id)
            .single()
        organizationName = org?.name || null
    }

    return (
        <ProfileView
            profile={profile}
            hideExtendedFields={true}
            roleLabel={isMasterAdmin ? 'Master Admin' : 'Org Admin'}
            organizationName={isMasterAdmin ? null : organizationName}
        />
    )
}
