'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, BookHeart, X } from 'lucide-react'
import { saveJournalEntry, updateJournalEntry } from '@/lib/journal-actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface JournalEntryEditorProps {
    pairingId: string
    leaderName: string
    existingEntry?: {
        id: string
        prayer_items: string
        god_speaking: string
    } | null
    onClose: () => void
}

export function JournalEntryEditor({
    pairingId,
    leaderName,
    existingEntry,
    onClose,
}: JournalEntryEditorProps) {
    const router = useRouter()

    // When editing, only show the free-text part (section 0, before any ---)
    const freeTextGodSpeaking = existingEntry
        ? (existingEntry.god_speaking || '').split('\n\n---\n\n')[0]
        : ''

    const [prayerItems, setPrayerItems] = useState(existingEntry?.prayer_items || '')
    const [godSaying, setGodSaying] = useState(freeTextGodSpeaking)
    const [isSaving, setIsSaving] = useState(false)

    const isEditing = !!existingEntry

    const handleSave = async () => {
        if (!prayerItems.trim() && !godSaying.trim()) {
            toast.error('Please fill in at least one of the prompts.')
            return
        }

        setIsSaving(true)

        let result
        if (isEditing) {
            result = await updateJournalEntry({
                entryId: existingEntry.id,
                prayerItems: prayerItems.trim(),
                godSaying: godSaying.trim(),
                pairingId,
            })
        } else {
            const localDate = new Date().toLocaleDateString('en-CA') // yyyy-MM-dd
            result = await saveJournalEntry({
                prayerItems: prayerItems.trim(),
                godSaying: godSaying.trim(),
                pairingId,
                localDate,
            })
        }

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(isEditing ? 'Journal entry updated!' : 'Journal entry saved!')
            onClose()
            router.refresh()
        }
        setIsSaving(false)
    }

    return (
        <Card className="border-primary/20">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2 text-foreground">
                        <BookHeart className="h-5 w-5 text-primary" />
                        {isEditing ? 'Edit Daily Reflection' : "Today's Daily Reflection"}
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">
                        3 things I{"'"}m praying about today
                    </Label>
                    <Textarea
                        value={prayerItems}
                        onChange={(e) => setPrayerItems(e.target.value)}
                        placeholder={"1. \n2. \n3. "}
                        rows={4}
                        className="resize-none"
                    />
                </div>

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

                <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        {isEditing ? 'Update' : 'Save'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
