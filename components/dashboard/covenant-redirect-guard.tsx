'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface CovenantRedirectGuardProps {
    children: React.ReactNode
    needsCovenantSignature: boolean
    covenantPairingId: string | null
}

export function CovenantRedirectGuard({
    children,
    needsCovenantSignature,
    covenantPairingId,
}: CovenantRedirectGuardProps) {
    const pathname = usePathname()
    const router = useRouter()
    const [isChecking, setIsChecking] = useState(true)

    useEffect(() => {
        // Skip redirect if we're already on the covenant page or admin pages
        const isCovenantPage = pathname?.includes('/dashboard/covenant')
        const isAdminPage = pathname?.includes('/dashboard/admin')

        if (needsCovenantSignature && covenantPairingId && !isCovenantPage && !isAdminPage) {
            router.replace(`/dashboard/covenant?pairing=${covenantPairingId}`)
        } else {
            setIsChecking(false)
        }
    }, [pathname, needsCovenantSignature, covenantPairingId, router])

    // Show a loading state while checking
    if (isChecking && needsCovenantSignature) {
        // Check pathname synchronously as well since useEffect hasn't run yet
        const isCovenantPage = typeof window !== 'undefined' && window.location.pathname.includes('/dashboard/covenant')
        const isAdminPage = typeof window !== 'undefined' && window.location.pathname.includes('/dashboard/admin')

        if (!isCovenantPage && !isAdminPage) {
            return (
                <div className="flex min-h-screen items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                </div>
            )
        }
    }

    return <>{children}</>
}
