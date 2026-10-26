import { Suspense } from 'react'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { SuccessContent } from './success-content'

export default async function CheckoutSuccessPage() {
    const adminData = await getAdminUser()
    const isOrgAdmin = Boolean(adminData && !adminData.isMasterAdmin && adminData.organization)

    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
        }>
            <SuccessContent isOrgAdmin={isOrgAdmin} />
        </Suspense>
    )
}
