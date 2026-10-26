import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AdminHeader } from '@/components/admin/admin-header'
import { BrandingProvider } from '@/contexts/branding-context'
import { brandingFromOrganization } from '@/lib/org-branding'

export default async function AdminDashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const adminData = await getAdminUser()

    if (!adminData) {
        redirect('/admin/login')
    }

    const { user, profile, isMasterAdmin, organization } = adminData

    // If not master admin and no organization, redirect
    if (!isMasterAdmin && !organization) {
        redirect('/admin/login?error=no_org')
    }

    const orgBranding = brandingFromOrganization(organization)

    return (
        <BrandingProvider initialBranding={orgBranding}>
            <div className="min-h-screen bg-background overflow-x-hidden">
                <AdminHeader
                    user={user}
                    profile={profile}
                    organization={organization}
                    isMasterAdmin={isMasterAdmin}
                />
                <div className="flex">
                    <AdminSidebar isMasterAdmin={isMasterAdmin} journeyRole={profile?.role} />
                    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
                        {children}
                    </main>
                </div>
            </div>
        </BrandingProvider>
    )
}
