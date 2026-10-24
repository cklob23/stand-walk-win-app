'use client'

import type { ComponentProps, ReactNode } from 'react'
import { DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export const DAILY_POPUP_DIALOG_CLASS =
    'flex max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg'

export function DailyPopupShell({
    header,
    footer,
    children,
    className,
    ...props
}: ComponentProps<typeof DialogContent> & {
    header: ReactNode
    footer: ReactNode
}) {
    return (
        <DialogContent className={cn(DAILY_POPUP_DIALOG_CLASS, className)} {...props}>
            <div className="shrink-0 px-6 pt-6 pr-12">{header}</div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-3 space-y-4">
                {children}
            </div>
            <div className="shrink-0 border-t border-border bg-background px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {footer}
            </div>
        </DialogContent>
    )
}
