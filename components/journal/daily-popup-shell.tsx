'use client'

import type { ComponentProps, ReactNode } from 'react'
import { DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export const DAILY_POPUP_DIALOG_CLASS =
    'top-[max(1rem,env(safe-area-inset-top))] left-[50%] flex h-auto min-h-0 max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] translate-x-[-50%] translate-y-0 flex-col gap-0 overflow-hidden p-0 data-[state=open]:zoom-in-100 sm:max-w-lg'

export function DailyPopupShell({
    header,
    footer,
    children,
    className,
    style,
    ...props
}: ComponentProps<typeof DialogContent> & {
    header: ReactNode
    footer: ReactNode
}) {
    return (
        <DialogContent
            {...props}
            className={cn(DAILY_POPUP_DIALOG_CLASS, className)}
            style={{
                top: 'max(1rem, env(safe-area-inset-top, 0px))',
                maxHeight: 'min(90dvh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem))',
                ...style,
            }}
        >
            <div className="shrink-0 px-6 pt-6 pr-12">{header}</div>
            <div
                data-popup-scroll
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y px-6 py-3 space-y-4"
            >
                {children}
            </div>
            <div className="shrink-0 border-t border-border bg-background px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {footer}
            </div>
        </DialogContent>
    )
}
