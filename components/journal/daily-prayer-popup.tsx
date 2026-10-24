'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    Dialog,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { DailyPopupShell } from '@/components/journal/daily-popup-shell'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { HandHeart, Heart, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { sendDailyPrayerToPartner } from '@/lib/daily-prayer-actions'
import { prayerSendFeedback } from '@/lib/daily-prayer-send'
import { prayerDismiss } from '@/lib/daily-popup-dismiss'
import {
    formatPrayerChip,
    formatPrayerDate,
    retargetPartnerMention,
    SCRIPTURE_LINE_SEPARATOR,
    sendPrayerButtonLabel,
    type DailyPrayerContent,
    type DailyPrayerPartner,
} from '@/lib/daily-prayer-content'
import { cn } from '@/lib/utils'

export interface DailyPrayerPopupProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    viewerRole: 'leader' | 'learner'
    partners: DailyPrayerPartner[]
    content: DailyPrayerContent
    /** Skip storage writes and network sends (dev preview / tests). */
    preview?: boolean
    initiallyHearted?: boolean
    initiallyConfirming?: boolean
}

export function DailyPrayerPopup({
    open,
    onOpenChange,
    viewerRole,
    partners,
    content,
    preview = false,
    initiallyHearted = false,
    initiallyConfirming = false,
}: DailyPrayerPopupProps) {
    const defaultPartner = partners[0] || null
    const [hearted, setHearted] = useState(initiallyHearted)
    const [confirming, setConfirming] = useState(initiallyConfirming)
    const [selectedPartnerId, setSelectedPartnerId] = useState(defaultPartner?.userId || '')
    const [sending, setSending] = useState(false)

    useEffect(() => {
        if (!open) return
        setHearted(initiallyHearted)
        setConfirming(initiallyConfirming)
        setSelectedPartnerId(defaultPartner?.userId || '')
    }, [open, initiallyHearted, initiallyConfirming, defaultPartner?.userId])

    const selectedPartner = useMemo(
        () => partners.find((partner) => partner.userId === selectedPartnerId) || defaultPartner,
        [partners, selectedPartnerId, defaultPartner],
    )

    const dateLabel = formatPrayerDate()
    const chip = formatPrayerChip(content)
    const displayBody = useMemo(
        () => retargetPartnerMention(content.body, selectedPartner?.name),
        [content.body, selectedPartner?.name],
    )
    const showPicker = viewerRole === 'leader' && partners.length > 1
    const sendLabel = sendPrayerButtonLabel(selectedPartner?.name || defaultPartner?.name)
    const confirmName = selectedPartner?.name?.split(' ')[0] || 'your partner'

    const dismissForToday = () => {
        if (!preview) prayerDismiss.markDismissedToday()
    }

    const handleDismiss = () => {
        dismissForToday()
        setConfirming(false)
        onOpenChange(false)
    }

    const handleHeart = () => {
        setHearted(true)
        dismissForToday()
    }

    const handleSendClick = () => {
        if (!selectedPartner) {
            toast.error('No partner is available to send this prayer.')
            return
        }
        setConfirming(true)
    }

    const handleConfirmSend = async () => {
        if (!selectedPartner) return
        if (preview) {
            dismissForToday()
            onOpenChange(false)
            return
        }
        setSending(true)
        const result = await sendDailyPrayerToPartner({
            pairingId: selectedPartner.pairingId,
            partnerUserId: selectedPartner.userId,
            prayerBody: displayBody,
            scriptureText: content.scriptureText,
            scriptureRef: content.scriptureRef,
            localDate: new Date().toLocaleDateString('en-CA'),
            timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        })
        setSending(false)
        const feedback = prayerSendFeedback(result, confirmName)
        if (feedback.tone === 'error') {
            toast.error(feedback.message)
            return
        }
        if (feedback.tone === 'info') {
            toast.info(feedback.message)
            dismissForToday()
            setConfirming(false)
            onOpenChange(false)
            return
        }
        toast.success(feedback.message)
        dismissForToday()
        setConfirming(false)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) handleDismiss() }}>
            <DailyPopupShell
                data-prayer-popup
                header={(
                    <DialogHeader>
                        <div className="flex items-start gap-2.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                                <HandHeart className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 text-left">
                                <DialogTitle className="text-foreground">Today&apos;s prayer</DialogTitle>
                                <DialogDescription className="mt-0.5">
                                    A short prayer for you today · {dateLabel}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                )}
                footer={(
                    <div className="flex flex-wrap items-center gap-2">
                        {confirming ? (
                            <>
                                <Button variant="ghost" onClick={() => setConfirming(false)} disabled={sending}>
                                    Cancel
                                </Button>
                                <Button className="ml-auto" onClick={handleConfirmSend} disabled={sending || !selectedPartner}>
                                    {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                                    <Send className="h-4 w-4" />
                                    Send
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" onClick={handleDismiss} className="text-muted-foreground">
                                    Dismiss
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    aria-label={hearted ? 'Saved' : 'Heart'}
                                    onClick={handleHeart}
                                    className={cn(
                                        hearted && 'border-rose-300 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 hover:text-rose-600 dark:border-rose-800 dark:text-rose-400',
                                    )}
                                >
                                    <Heart className={cn('h-4 w-4', hearted && 'fill-current')} />
                                </Button>
                                {hearted && (
                                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Saved</span>
                                )}
                                <Button
                                    className="ml-auto w-full sm:w-auto"
                                    onClick={handleSendClick}
                                    disabled={!selectedPartner}
                                >
                                    <Send className="h-4 w-4" />
                                    {sendLabel}
                                </Button>
                            </>
                        )}
                    </div>
                )}
            >
                <span className="inline-flex w-fit items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                    {content.contextTopic ? (
                        <>
                            {content.contextLabel} ·{' '}
                            <strong className="ml-1 font-medium text-foreground">{content.contextTopic}</strong>
                        </>
                    ) : (
                        chip
                    )}
                </span>

                <div className="rounded-xl border border-pink-200/70 dark:border-pink-900/40 bg-gradient-to-b from-pink-50/80 dark:from-pink-950/20 to-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
                            <HandHeart className="h-4 w-4" />
                        </span>
                        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Pray this prayer
                        </p>
                    </div>
                    <p className="font-serif text-[15px] sm:text-base leading-8 text-foreground">
                        {displayBody}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Written for you today</p>
                </div>

                <p className="font-serif italic text-[13px] leading-relaxed text-muted-foreground px-0.5">
                    {content.scriptureText ? (
                        <>
                            {content.scriptureText}
                            {SCRIPTURE_LINE_SEPARATOR}
                        </>
                    ) : null}
                    <cite className="not-italic font-sans font-medium text-xs">
                        {content.scriptureRef}
                    </cite>
                </p>

                {confirming && (
                    <div className="rounded-[10px] border border-border bg-muted/50 p-3.5 space-y-3">
                        {showPicker ? (
                            <>
                                <p className="text-sm text-foreground">
                                    Send this prayer in your partner chat?
                                </p>
                                <RadioGroup
                                    value={selectedPartnerId}
                                    onValueChange={setSelectedPartnerId}
                                    className="gap-2"
                                >
                                    {partners.map((partner) => (
                                        <div key={partner.userId} className="flex items-center gap-2">
                                            <RadioGroupItem value={partner.userId} id={`prayer-learner-${partner.userId}`} />
                                            <Label htmlFor={`prayer-learner-${partner.userId}`} className="text-sm font-medium">
                                                {partner.name}
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </>
                        ) : (
                            <p className="text-sm text-foreground">
                                Send this prayer to <strong>{confirmName}</strong> in your partner chat?
                            </p>
                        )}
                    </div>
                )}
            </DailyPopupShell>
        </Dialog>
    )
}
