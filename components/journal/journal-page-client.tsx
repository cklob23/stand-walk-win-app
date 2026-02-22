'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BookHeart, Plus, PenLine } from 'lucide-react'
import { JournalHistory, type JournalEntry } from '@/components/journal/journal-history'
import { JournalEntryEditor } from '@/components/journal/journal-entry-editor'
import { SharedWithMe, type SharedItem } from '@/components/journal/shared-with-me'

interface JournalPageClientProps {
    isLeader: boolean
    leaderName: string
    learnerName: string
    pairingId: string
    entries: JournalEntry[]
    sharedItems: SharedItem[]
    todayEntry: JournalEntry | null
    initialSection?: string | null
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
}: JournalPageClientProps) {
    const [showEditor, setShowEditor] = useState(false)
    const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)

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
                <Button onClick={handleNewEntry} size="sm" className="gap-1.5 shrink-0">
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
                    onClose={handleCloseEditor}
                />
            )}

            {/* Shared With Me section */}
            <SharedWithMe items={sharedItems} autoOpen={initialSection === 'shared'} />

            {/* Own journal entries */}
            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Your Entries
                </h2>
                <JournalHistory
                    entries={entries}
                    leaderName={isLeader ? learnerName : leaderName}
                    pairingId={pairingId}
                    isLeaderView={false}
                    learnerName={isLeader ? learnerName : undefined}
                    onEditDaily={handleEdit}
                />
            </div>
        </div>
    )
}
