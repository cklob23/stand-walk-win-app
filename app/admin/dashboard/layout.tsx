import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AdminHeader } from '@/components/admin/admin-header'

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

    return (
        <div className="min-h-screen bg-background">
            <AdminHeader
                user={user}
                profile={profile}
                organization={organization}
                isMasterAdmin={isMasterAdmin}
            />
            <div className="flex">
                <AdminSidebar isMasterAdmin={isMasterAdmin} />
                <main className="flex-1 p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
