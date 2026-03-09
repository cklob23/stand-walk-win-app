'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BookHeart, Plus, PenLine, ArrowLeft } from 'lucide-react'
import { JournalHistory, AddCustomEntryButton, type JournalEntry } from '@/components/journal/journal-history'
import type { JournalAttachment } from '@/lib/journal-actions'
import { JournalEntryEditor } from '@/components/journal/journal-entry-editor'
import { SharedWithMe, type SharedItem } from '@/components/journal/shared-with-me'
import { DailyJournalPopup } from '@/components/journal/daily-journal-popup'
import { FeatureTour } from '@/components/onboarding/feature-tour'
import { getJournalSteps } from '@/lib/tour-steps'
import { useMemo } from 'react'

interface JournalPageClientProps {
    isLeader: boolean
    leaderName: string
    learnerName: string
    pairingId: string
    entries: JournalEntry[]
    sharedItems: SharedItem[]
    todayEntry: JournalEntry | null
    initialSection?: string | null
    currentUserId: string
    currentUserName: string
}

export function JournalPageClient({
    isLeader,
    leaderName,
    learnerName,
    pairingId,
    entries,
    sharedItems,
    todayEntry,
    initialSection,
    currentUserId,
    currentUserName,
}: JournalPageClientProps) {
    const router = useRouter()
    const searchParamsHook = useSearchParams()
    const [showEditor, setShowEditor] = useState(false)
    const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)

    // Generate tour steps based on whether today's entry exists
    const journalTourSteps = useMemo(() => getJournalSteps(!!todayEntry), [todayEntry])

    // Ensure the server has the correct local date for "today" queries
    useEffect(() => {
        const localDate = new Date().toLocaleDateString('en-CA') // yyyy-MM-dd format
        const urlDate = searchParamsHook.get('localDate')
        if (urlDate !== localDate) {
            const params = new URLSearchParams(searchParamsHook.toString())
            params.set('localDate', localDate)
            router.replace(`/dashboard/journal?${params.toString()}`)
        }
    }, [searchParamsHook, router])

    const handleNewEntry = () => {
        if (todayEntry) {
            setEditingEntry(todayEntry)
        } else {
            setEditingEntry(null)
        }
        setShowEditor(true)
    }

    const handleEdit = (entry: JournalEntry) => {
        setEditingEntry(entry)
        setShowEditor(true)
    }

    const handleCloseEditor = () => {
        setShowEditor(false)
        setEditingEntry(null)
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
            {/* Back navigation */}
            <button
                onClick={() => router.back()}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -mb-3"
            >
                <ArrowLeft className="h-4 w-4" />
                Back
            </button>

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                        <BookHeart className="h-6 w-6 text-primary" />
                        Prayer Journal
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Your daily prayer reflections and what God is saying to you
                    </p>
                </div>
                <Button data-tour="journal-new" onClick={handleNewEntry} size="sm" className="gap-1.5 shrink-0">
                    {todayEntry?.prayer_items?.trim() ? (
                        <>
                            <PenLine className="h-4 w-4" />
                            <span className="hidden sm:inline">{"Edit Today's Reflection"}</span>
                            <span className="sm:hidden">Edit</span>
                        </>
                    ) : (
                        <>
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">New Reflection</span>
                            <span className="sm:hidden">New</span>
                        </>
                    )}
                </Button>
            </div>

            {/* Inline Editor */}
            {showEditor && (
                <JournalEntryEditor
                    pairingId={pairingId}
                    leaderName={isLeader ? learnerName : leaderName}
                    existingEntry={editingEntry ? {
                        id: editingEntry.id,
                        prayer_items: editingEntry.prayer_items,
                        god_speaking: editingEntry.god_speaking,
                    } : null}
                    existingAttachments={editingEntry?.attachments || todayEntry?.attachments || []}
                    onClose={handleCloseEditor}
                />
            )}

            {/* Shared With Me section */}
            <div data-tour="journal-shared">
                <SharedWithMe
                    items={sharedItems}
                    autoOpen={initialSection === 'shared'}
                    pairingId={pairingId}
                    currentUserName={currentUserName}
                    currentUserId={currentUserId}
                />
            </div>

            {/* Own journal entries */}
            <div data-tour="journal-history">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Your Entries
                </h2>
                <div className="mb-3">
                    <AddCustomEntryButton
                        entries={entries}
                        pairingId={pairingId}
                        isLeaderView={isLeader}
                    />
                </div>
                <JournalHistory
                    entries={entries}
                    leaderName={isLeader ? learnerName : leaderName}
                    pairingId={pairingId}
                    isLeaderView={false}
                    learnerName={isLeader ? learnerName : undefined}
                    onEditDaily={handleEdit}
                />
            </div>
            {/* Daily reflection prompt -- popup manages its own open/dismissed state */}
            <DailyJournalPopup
                pairingId={pairingId}
                hasEntryToday={!!todayEntry}
                leaderName={isLeader ? learnerName : leaderName}
            />

            {/* Onboarding Tour */}
            <FeatureTour tourId="journal" steps={journalTourSteps} />
        </div>
    )
}
