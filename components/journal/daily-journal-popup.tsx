'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, BookHeart } from 'lucide-react'
import { saveJournalEntry } from '@/lib/journal-actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { isAnyTourActive, onTourStateChange } from '@/hooks/use-feature-tour'

interface DailyJournalPopupProps {
    pairingId: string
    hasEntryToday: boolean
    leaderName: string
}

const LS_KEY = 'swr-journal-dismissed'

function getDismissedDate(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(LS_KEY)
}

function setDismissedToday(): void {
    const today = new Date().toLocaleDateString('en-CA') // local yyyy-MM-dd
    localStorage.setItem(LS_KEY, today)
}

export function DailyJournalPopup({ pairingId, hasEntryToday, leaderName }: DailyJournalPopupProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [prayerItems, setPrayerItems] = useState('')
    const [godSaying, setGodSaying] = useState('')
    const [shareWithLeader, setShareWithLeader] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        // Only show if learner hasn't already written today and hasn't dismissed today
        if (hasEntryToday) return

        const today = new Date().toLocaleDateString('en-CA')
        const dismissed = getDismissedDate()
        if (dismissed === today) return

        let unsub: (() => void) | null = null
        let delayTimer: ReturnType<typeof setTimeout> | null = null

        function showPopup() {
            // Extra safety: wait a beat after tour ends for smooth transition
            delayTimer = setTimeout(() => setOpen(true), 600)
        }

        // Wait 1500ms to give tours time to register as active
        const initTimer = setTimeout(() => {
            if (!isAnyTourActive()) {
                // No tour active -- safe to show immediately
                setOpen(true)
                return
            }
            // A tour is active -- wait for it to finish
            unsub = onTourStateChange((active) => {
                if (!active) {
                    showPopup()
                    unsub?.()
                    unsub = null
                }
            })
        }, 1500)

        return () => {
            clearTimeout(initTimer)
            if (delayTimer) clearTimeout(delayTimer)
            unsub?.()
        }
    }, [hasEntryToday])

    const handleDismiss = () => {
        setDismissedToday()
        setOpen(false)
    }

    const handleSave = async () => {
        if (!prayerItems.trim() && !godSaying.trim()) {
            toast.error('Please fill in at least one of the prompts.')
            return
        }

        setIsSaving(true)
        const localDate = new Date().toLocaleDateString('en-CA') // yyyy-MM-dd
        const result = await saveJournalEntry({
            prayerItems: prayerItems.trim(),
            godSaying: godSaying.trim(),
            pairingId,
            localDate,
            shareWithLeader,
        })

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Journal entry saved!')
            setDismissedToday()
            setOpen(false)
            router.refresh()
        }
        setIsSaving(false)
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss() }}>
            <DialogContent className="sm:max-w-lg" data-journal-popup>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                        <BookHeart className="h-5 w-5 text-primary" />
                        Daily Prayer Journal
                    </DialogTitle>
                    <DialogDescription>
                        Take a moment to reflect on your prayer life today.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Question 1 */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                            3 things I{"'"}m praying about today
                        </Label>
                        <Textarea
                            value={prayerItems}
                            onChange={(e) => setPrayerItems(e.target.value)}
                            placeholder="1. &#10;2. &#10;3. "
                            rows={4}
                            className="resize-none"
                        />
                    </div>

                    {/* Question 2 */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                            What am I learning today?
                        </Label>
                        <Textarea
                            value={godSaying}
                            onChange={(e) => setGodSaying(e.target.value)}
                            placeholder="Write what you're learning today..."
                            rows={4}
                            className="resize-none"
                        />
                    </div>

                    {/* Share toggle */}
                    <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                        <div>
                            <p className="text-sm font-medium text-foreground">Share with {leaderName}</p>
                            <p className="text-xs text-muted-foreground">Your leader can see this entry and discuss it with you</p>
                        </div>
                        <Switch
                            checked={shareWithLeader}
                            onCheckedChange={setShareWithLeader}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={handleDismiss} disabled={isSaving}>
                        Skip for today
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Save Entry
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
