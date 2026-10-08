'use client'

import { useState, useEffect, useLayoutEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { BookHeart, Plus, PenLine, ArrowLeft, ArrowDownWideNarrow } from 'lucide-react'
import { JournalHistory, AddCustomEntryButton, type JournalEntry } from '@/components/journal/journal-history'
import type { JournalAttachment } from '@/lib/journal-actions'
import { JournalEntryEditor } from '@/components/journal/journal-entry-editor'
import { SharedWithMe, type SharedItem } from '@/components/journal/shared-with-me'
import { DailyJournalPopup } from '@/components/journal/daily-journal-popup'
import { FeatureTour } from '@/components/onboarding/feature-tour'
import { getJournalSteps } from '@/lib/tour-steps'
import { useMemo } from 'react'
import { toast } from 'sonner'

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
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [entriesState, setEntriesState] = useState<JournalEntry[]>(entries)
    const [todayEntryState, setTodayEntryState] = useState<JournalEntry | null>(todayEntry)
    const [clientToday, setClientToday] = useState<string | null>(null)

    useEffect(() => {
        setEntriesState(entries)
    }, [entries])

    useEffect(() => {
        setTodayEntryState(todayEntry)
    }, [todayEntry])

    // Device-local "today" before paint so the New/Edit label matches the
    // entries the server already sent (no UTC-first-render flash).
    useLayoutEffect(() => {
        setClientToday(new Date().toLocaleDateString('en-CA'))
    }, [])

    const todayKey = clientToday || todayEntryState?.journal_date?.slice(0, 10) || todayEntry?.journal_date?.slice(0, 10) || ''
    const hasTodayEntry = useMemo(() => {
        if (todayEntryState && (!todayKey || todayEntryState.journal_date?.slice(0, 10) === todayKey)) {
            return true
        }
        if (todayKey) {
            return entriesState.some(e => e.journal_date?.slice(0, 10) === todayKey)
        }
        return !!todayEntryState
    }, [todayEntryState, entriesState, todayKey])

    // Generate tour steps based on whether today's entry exists
    const journalTourSteps = useMemo(() => getJournalSteps(hasTodayEntry), [hasTodayEntry])

    // Ensure the server has the correct local date for "today" queries.
    // Don't rewrite the URL while the editor is open — that remount used to
    // swallow the first Save (no toast, no row) and let a second click insert twice.
    useEffect(() => {
        if (showEditor) return
        const localDate = new Date().toLocaleDateString('en-CA') // yyyy-MM-dd format
        const urlDate = searchParamsHook.get('localDate')
        if (urlDate !== localDate) {
            // Read the live URL so we do not clobber a just-pushed ?pairing=
            // with a stale useSearchParams snapshot.
            const params = new URLSearchParams(window.location.search)
            params.set('localDate', localDate)
            router.replace(`/dashboard/journal?${params.toString()}`)
        }
    }, [searchParamsHook, router, showEditor])

    const todayFromList = todayKey
        ? entriesState.find(e => e.journal_date?.slice(0, 10) === todayKey) || null
        : todayEntryState

    const handleNewEntry = () => {
        if (todayFromList || todayEntryState) {
            setEditingEntry(todayFromList || todayEntryState)
        } else {
            setEditingEntry(null)
        }
        setShowEditor(true)
    }

    const handleCustomAdded = (added: {
        entryId: string
        journalDate: string
        title: string
        content: string
        createdAt: string
    }) => {
        const custom = { title: added.title, content: added.content, created_at: added.createdAt }
        const merge = (prev: JournalEntry | null): JournalEntry => {
            if (!prev) {
                return {
                    id: added.entryId,
                    journal_date: added.journalDate,
                    prayer_items: '',
                    god_speaking: '',
                    shared_with_leader: false,
                    shared_sections: {},
                    custom_entries: [custom],
                    pairing_id: pairingId,
                    created_at: added.createdAt,
                    updated_at: added.createdAt,
                    attachments: [],
                }
            }
            const existing = (prev.custom_entries || []).some(c => c.created_at === added.createdAt)
            return {
                ...prev,
                custom_entries: existing
                    ? prev.custom_entries
                    : [...(prev.custom_entries || []), custom],
            }
        }
        setEntriesState(prev => {
            const idx = prev.findIndex(e => e.id === added.entryId || e.journal_date === added.journalDate)
            if (idx >= 0) {
                const copy = [...prev]
                copy[idx] = merge(copy[idx])
                return copy
            }
            return [merge(null), ...prev]
        })
        setTodayEntryState(prev => {
            if (prev && (prev.id === added.entryId || prev.journal_date === added.journalDate)) {
                return merge(prev)
            }
            if (!prev && added.journalDate === (clientToday || added.journalDate)) {
                return merge(null)
            }
            return prev
        })
    }

    const handleEdit = (entry: JournalEntry) => {
        setEditingEntry(entry)
        setShowEditor(true)
    }

    const handleCloseEditor = () => {
        setShowEditor(false)
        setEditingEntry(null)
    }

    const handleSaved = (saved: {
        id: string
        journal_date: string
        prayer_items: string
        god_speaking: string
        pairing_id: string
        updated_at: string
        isUpdate: boolean
    }) => {
        const now = saved.updated_at || new Date().toISOString()
        const next: JournalEntry = {
            id: saved.id,
            journal_date: saved.journal_date,
            prayer_items: saved.prayer_items,
            god_speaking: saved.god_speaking,
            shared_with_leader: false,
            shared_sections: {},
            custom_entries: [],
            pairing_id: saved.pairing_id,
            created_at: now,
            updated_at: now,
            reflection_updated_at: now,
            attachments: [],
        }
        setEntriesState(prev => {
            const idx = prev.findIndex(e => e.id === saved.id || e.journal_date === saved.journal_date)
            if (idx >= 0) {
                const copy = [...prev]
                copy[idx] = {
                    ...copy[idx],
                    ...next,
                    created_at: copy[idx].created_at,
                    updated_at: now,
                    attachments: copy[idx].attachments,
                    shared_with_leader: copy[idx].shared_with_leader,
                    shared_sections: copy[idx].shared_sections,
                    custom_entries: copy[idx].custom_entries,
                }
                return copy
            }
            return [next, ...prev]
        })
        setTodayEntryState(prev => prev
            ? {
                ...prev,
                ...next,
                created_at: prev.created_at,
                updated_at: now,
                attachments: prev.attachments,
                shared_with_leader: prev.shared_with_leader,
                shared_sections: prev.shared_sections,
                custom_entries: prev.custom_entries,
            }
            : next
        )
        toast.success(saved.isUpdate ? 'Journal entry updated!' : 'Journal entry saved!', {
            duration: 8000,
        })
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
                    {hasTodayEntry ? (
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
                    existingAttachments={
                        // Only show attachments with section_key 'daily' for the daily reflection editor
                        (editingEntry?.attachments || todayEntryState?.attachments || [])
                            .filter(att => att.section_key === 'daily')
                    }
                    onClose={handleCloseEditor}
                    onSaved={handleSaved}
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
                <div className="flex items-center justify-between gap-3 mb-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Your Entries
                    </h2>
                    <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'asc' | 'desc')}>
                        <SelectTrigger size="sm" className="w-[150px] h-8 text-xs">
                            <ArrowDownWideNarrow className="h-3.5 w-3.5 text-muted-foreground" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="desc">Newest first</SelectItem>
                            <SelectItem value="asc">Oldest first</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="mb-3">
                    <AddCustomEntryButton
                        entries={entriesState}
                        pairingId={pairingId}
                        isLeaderView={isLeader}
                        onAdded={handleCustomAdded}
                    />
                </div>
                <JournalHistory
                    entries={entriesState}
                    leaderName={isLeader ? learnerName : leaderName}
                    pairingId={pairingId}
                    isLeaderView={false}
                    learnerName={isLeader ? learnerName : undefined}
                    onEditDaily={handleEdit}
                    sortOrder={sortOrder}
                    hasTodayEntry={hasTodayEntry}
                />
            </div>
            {/* Daily reflection prompt -- popup manages its own open/dismissed state */}
            <DailyJournalPopup
                pairingId={pairingId}
                hasEntryToday={hasTodayEntry}
                leaderName={isLeader ? learnerName : leaderName}
            />

            {/* Onboarding Tour */}
            <FeatureTour tourId="journal" steps={journalTourSteps} />
        </div>
    )
}
