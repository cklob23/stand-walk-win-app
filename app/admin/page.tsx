import { redirect } from 'next/navigation'
import { getAdminUser, hasAdminPortalAccess } from '@/lib/admin-auth-actions'

export default async function AdminIndexPage() {
    const adminData = await getAdminUser()
    if (await hasAdminPortalAccess(adminData)) {
        redirect('/admin/dashboard')
    }
    redirect('/admin/login')
}
