'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BACK_TO_ADMIN_LABEL, getBackToAdminHref } from '@/lib/admin-journey-nav'

interface BackToAdminLinkProps {
    isOrgAdmin: boolean
    className?: string
    buttonClassName?: string
}

export function BackToAdminLink({ isOrgAdmin, className, buttonClassName }: BackToAdminLinkProps) {
    const href = getBackToAdminHref(isOrgAdmin)
    if (!href) return null

    return (
        <Button variant="ghost" size="sm" asChild className={cn('gap-1 px-2 sm:px-3', buttonClassName)}>
            <Link href={href} className={cn('whitespace-nowrap', className)}>
                <ArrowLeft className="h-4 w-4" />
                {BACK_TO_ADMIN_LABEL}
            </Link>
        </Button>
    )
}
