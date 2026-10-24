'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BACK_TO_JOURNEY_LABEL } from '@/lib/admin-journey-nav'

interface AdminBackToJourneyLinkProps {
    href: string
    onClick?: () => void
    className?: string
    iconClassName?: string
}

export function AdminBackToJourneyLink({
    href,
    onClick,
    className,
    iconClassName,
}: AdminBackToJourneyLinkProps) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground',
                className
            )}
        >
            <ArrowLeft className={cn('h-4 w-4', iconClassName)} />
            {BACK_TO_JOURNEY_LABEL}
        </Link>
    )
}
