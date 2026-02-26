'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
    BookHeart, Calendar, Loader2, CalendarPlus, Pencil,
    Check, X, Plus, Trash2, Clock,
} from 'lucide-react'
import {
    toggleSectionShare,
    updateJournalGodSpeakingSection,
    addCustomEntry,
    updateCustomEntry,
    deleteCustomEntry,
} from '@/lib/journal-actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'

export interface JournalEntry {
    id: string
    journal_date: string
    prayer_items: string
    god_speaking: string
    shared_with_leader: boolean
    shared_sections: Record<string, boolean> | null
    custom_entries: { title: string; content: string; created_at: string }[] | null
    pairing_id: string
    created_at: string
}

interface JournalHistoryProps {
    entries: JournalEntry[]
    leaderName: string
    pairingId: string
    isLeaderView?: boolean
    learnerName?: string
    onEditDaily?: (entry: JournalEntry) => void
}

interface ParsedVerseSection {
    title: string | null
    time: string | null
    content: string
    raw: string
}

function parseVerseSection(raw: string): ParsedVerseSection {
    let title: string | null = null
    let time: string | null = null

    // Extract @@TITLE: and @@TIME: headers
    const lines = raw.split('\n')
    const contentLines: string[] = []
    for (const line of lines) {
        if (line.startsWith('@@TITLE: ')) {
            title = line.replace('@@TITLE: ', '')
        } else if (line.startsWith('@@TIME: ')) {
            time = line.replace('@@TIME: ', '')
        } else {
            contentLines.push(line)
        }
    }
    const content = contentLines.join('\n').trim()

    // Build the raw content without @@TITLE/@@TIME for editing
    const editableRaw = contentLines.join('\n').trim()

    return { title, time, content, raw: editableRaw }
}

function parseGodSpeakingSections(godSpeaking: string): { freeText: string; verses: ParsedVerseSection[] } {
    if (!godSpeaking?.trim()) return { freeText: '', verses: [] }
    const parts = godSpeaking.split('\n\n---\n\n')

    // The first part is the daily reflection free-text (may be empty)
    const freeText = (parts[0] || '').trim()

    // All subsequent parts are verse entries
    const verses: ParsedVerseSection[] = parts.slice(1)
        .map(s => s.trim())
        .filter(Boolean)
        .map(parseVerseSection)

    return { freeText, verses }
}

function formatFriendlyTime(isoStr: string): string {
    try {
        const d = new Date(isoStr)
        return d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        })
    } catch {
        return isoStr
    }
}

export function JournalHistory({
    entries,
    leaderName,
    pairingId,
    isLeaderView = false,
    learnerName,
    onEditDaily,
}: JournalHistoryProps) {
    const router = useRouter()
    const [loadingKey, setLoadingKey] = useState<string | null>(null)

    // Inline editing state
    const [editingKey, setEditingKey] = useState<string | null>(null)
    const [editText, setEditText] = useState('')
    const [editTitle, setEditTitle] = useState('')

    // New custom entry state
    const [addingCustomFor, setAddingCustomFor] = useState<string | null>(null)
    const [newTitle, setNewTitle] = useState('')
    const [newContent, setNewContent] = useState('')

    const handleToggleSectionShare = async (entryId: string, sectionKey: string, currentShared: boolean) => {
        const key = `${entryId}-${sectionKey}`
        setLoadingKey(key)
        const result = await toggleSectionShare(entryId, sectionKey, !currentShared, pairingId)
        if (result.error) toast.error(result.error)
        else {
            toast.success(!currentShared ? `Shared with ${leaderName}` : 'Unshared')
            router.refresh()
        }
        setLoadingKey(null)
    }

    const isSectionShared = (entry: JournalEntry, sectionKey: string): boolean => {
        return (entry.shared_sections as Record<string, boolean>)?.[sectionKey] ?? false
    }

    // ── Verse section editing ──
    const handleSaveVerseEdit = async (entryId: string, sectionIndex: number) => {
        const key = `edit-${entryId}-verse-${sectionIndex}`
        setLoadingKey(key)
        const result = await updateJournalGodSpeakingSection(entryId, sectionIndex, editText.trim())
        if (result.error) toast.error(result.error)
        else { toast.success('Updated!'); router.refresh() }
        setEditingKey(null)
        setEditText('')
        setLoadingKey(null)
    }

    // ── Custom entry editing ──
    const handleSaveCustomEdit = async (entryId: string, customIndex: number) => {
        const key = `edit-${entryId}-custom-${customIndex}`
        setLoadingKey(key)
        const result = await updateCustomEntry(entryId, customIndex, editTitle.trim(), editText.trim())
        if (result.error) toast.error(result.error)
        else { toast.success('Updated!'); router.refresh() }
        setEditingKey(null)
        setEditText('')
        setEditTitle('')
        setLoadingKey(null)
    }

    const handleDeleteCustom = async (entryId: string, customIndex: number) => {
        const key = `del-${entryId}-custom-${customIndex}`
        setLoadingKey(key)
        const result = await deleteCustomEntry(entryId, customIndex)
        if (result.error) toast.error(result.error)
        else { toast.success('Deleted'); router.refresh() }
        setLoadingKey(null)
    }

    // ── Add new custom entry ──
    const handleAddCustom = async (entryId: string) => {
        if (!newContent.trim()) { toast.error('Please write something.'); return }
        const key = `add-${entryId}`
        setLoadingKey(key)
        const result = await addCustomEntry(entryId, newTitle.trim(), newContent.trim())
        if (result.error) toast.error(result.error)
        else { toast.success('Entry added!'); router.refresh() }
        setAddingCustomFor(null)
        setNewTitle('')
        setNewContent('')
        setLoadingKey(null)
    }

    if (entries.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <BookHeart className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-foreground mb-1">
                        {isLeaderView ? 'No shared entries yet' : 'No journal entries yet'}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        {isLeaderView
                            ? `${learnerName || 'Your learner'} hasn't shared any journal entries with you yet.`
                            : 'Your daily prayer journal entries will appear here. Tap "New Entry" above to write your first one!'}
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {entries.map((entry) => {
                const { freeText, verses } = parseGodSpeakingSections(entry.god_speaking)
                const customs = (entry.custom_entries as { title: string; content: string; created_at: string }[]) || []
                const hasDailyContent = !!entry.prayer_items?.trim() || !!freeText

                // For leader view: only show sections that are shared
                const dailyShared = isSectionShared(entry, 'daily')

                return (
                    <div key={entry.id} className="space-y-3">
                        {/* ── Date header ── */}
                        <div className="flex items-center gap-2 pt-1">
                            <Calendar className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-sm font-medium text-foreground">
                                {format(parseISO(entry.journal_date), 'EEEE, MMMM d, yyyy')}
                            </span>
                            {isLeaderView && (
                                <Badge variant="secondary" className="text-xs gap-1 ml-auto">
                                    Shared by {learnerName}
                                </Badge>
                            )}
                        </div>

                        {/* ── Daily Questions Card ── */}
                        {hasDailyContent && (!isLeaderView || dailyShared) && (
                            <SectionCard
                                label="Daily Reflection"
                                timestamp={formatFriendlyTime(entry.created_at)}
                                isLeaderView={isLeaderView}
                                shared={dailyShared}
                                loadingKey={loadingKey}
                                sectionLoadKey={`${entry.id}-daily`}
                                leaderName={leaderName}
                                learnerName={learnerName}
                                onToggleShare={() => handleToggleSectionShare(entry.id, 'daily', dailyShared)}
                                onEdit={!isLeaderView && onEditDaily ? () => onEditDaily(entry) : undefined}
                                onScheduleMeeting={isLeaderView ? async () => {
                                    setLoadingKey(`meet-${entry.id}`)
                                    const result = await import('@/lib/journal-actions').then(m =>
                                        m.requestJournalMeeting(entry.id, format(parseISO(entry.journal_date), 'MMM d'))
                                    )
                                    if (result.error) toast.error(result.error)
                                    else { toast.success('Meeting request sent!'); router.push('/dashboard/schedule') }
                                    setLoadingKey(null)
                                } : undefined}
                                meetingLoading={loadingKey === `meet-${entry.id}`}
                            >
                                {entry.prayer_items?.trim() && (
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Praying About
                                        </p>
                                        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                                            {entry.prayer_items}
                                        </p>
                                    </div>
                                )}
                                {freeText && (
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Learning
                                        </p>
                                        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed font-serif italic">
                                            {freeText}
                                        </p>
                                    </div>
                                )}
                            </SectionCard>
                        )}

                        {/* ── Verse Entry Cards ── */}
                        {verses.map((verse, idx) => {
                            const sectionKey = `verse_${idx}`
                            const verseShared = isSectionShared(entry, sectionKey)
                            const editKey = `verse-${entry.id}-${idx}`
                            const isEditing = editingKey === editKey

                            if (isLeaderView && !verseShared) return null

                            return (
                                <SectionCard
                                    key={editKey}
                                    label={verse.title || 'Learning'}
                                    timestamp={verse.time || undefined}
                                    isLeaderView={isLeaderView}
                                    shared={verseShared}
                                    loadingKey={loadingKey}
                                    sectionLoadKey={`${entry.id}-${sectionKey}`}
                                    leaderName={leaderName}
                                    learnerName={learnerName}
                                    onToggleShare={() => handleToggleSectionShare(entry.id, sectionKey, verseShared)}
                                    onEdit={!isLeaderView && !isEditing ? () => {
                                        setEditingKey(editKey)
                                        setEditText(verse.content)
                                    } : undefined}
                                    onScheduleMeeting={isLeaderView ? async () => {
                                        setLoadingKey(`meet-${entry.id}`)
                                        const result = await import('@/lib/journal-actions').then(m =>
                                            m.requestJournalMeeting(entry.id, format(parseISO(entry.journal_date), 'MMM d'))
                                        )
                                        if (result.error) toast.error(result.error)
                                        else { toast.success('Meeting request sent!'); router.push('/dashboard/schedule') }
                                        setLoadingKey(null)
                                    } : undefined}
                                    meetingLoading={loadingKey === `meet-${entry.id}`}
                                >
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <Textarea
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                rows={4}
                                                className="resize-none text-sm"
                                            />
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    className="h-7 text-xs gap-1"
                                                    onClick={() => handleSaveVerseEdit(entry.id, idx + 1)}
                                                    disabled={loadingKey === `edit-${entry.id}-verse-${idx + 1}`}
                                                >
                                                    {loadingKey === `edit-${entry.id}-verse-${idx + 1}`
                                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                                        : <Check className="h-3 w-3" />}
                                                    Save
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs gap-1"
                                                    onClick={() => { setEditingKey(null); setEditText('') }}
                                                >
                                                    <X className="h-3 w-3" />
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed font-serif italic">
                                            {verse.content}
                                        </p>
                                    )}
                                </SectionCard>
                            )
                        })}

                        {/* ── Custom Entry Cards ── */}
                        {customs.map((custom, idx) => {
                            const sectionKey = `custom_${idx}`
                            const customShared = isSectionShared(entry, sectionKey)
                            const editKey = `custom-${entry.id}-${idx}`
                            const isEditing = editingKey === editKey

                            if (isLeaderView && !customShared) return null

                            return (
                                <SectionCard
                                    key={editKey}
                                    label={custom.title || 'My Reflection'}
                                    timestamp={custom.created_at ? formatFriendlyTime(custom.created_at) : undefined}
                                    isLeaderView={isLeaderView}
                                    shared={customShared}
                                    loadingKey={loadingKey}
                                    sectionLoadKey={`${entry.id}-${sectionKey}`}
                                    leaderName={leaderName}
                                    learnerName={learnerName}
                                    onToggleShare={() => handleToggleSectionShare(entry.id, sectionKey, customShared)}
                                    onEdit={!isLeaderView && !isEditing ? () => {
                                        setEditingKey(editKey)
                                        setEditTitle(custom.title)
                                        setEditText(custom.content)
                                    } : undefined}
                                    onDelete={!isLeaderView ? () => handleDeleteCustom(entry.id, idx) : undefined}
                                    deleteLoading={loadingKey === `del-${entry.id}-custom-${idx}`}
                                    onScheduleMeeting={isLeaderView ? async () => {
                                        setLoadingKey(`meet-${entry.id}`)
                                        const result = await import('@/lib/journal-actions').then(m =>
                                            m.requestJournalMeeting(entry.id, format(parseISO(entry.journal_date), 'MMM d'))
                                        )
                                        if (result.error) toast.error(result.error)
                                        else { toast.success('Meeting request sent!'); router.push('/dashboard/schedule') }
                                        setLoadingKey(null)
                                    } : undefined}
                                    meetingLoading={loadingKey === `meet-${entry.id}`}
                                >
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <Input
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                placeholder="Title"
                                                className="text-sm"
                                            />
                                            <Textarea
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                rows={4}
                                                className="resize-none text-sm"
                                            />
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    className="h-7 text-xs gap-1"
                                                    onClick={() => handleSaveCustomEdit(entry.id, idx)}
                                                    disabled={loadingKey === `edit-${entry.id}-custom-${idx}`}
                                                >
                                                    {loadingKey === `edit-${entry.id}-custom-${idx}`
                                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                                        : <Check className="h-3 w-3" />}
                                                    Save
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs gap-1"
                                                    onClick={() => { setEditingKey(null); setEditText(''); setEditTitle('') }}
                                                >
                                                    <X className="h-3 w-3" />
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                                            {custom.content}
                                        </p>
                                    )}
                                </SectionCard>
                            )
                        })}

                        {/* ── Add Custom Entry ── */}
                        {!isLeaderView && (
                            addingCustomFor === entry.id ? (
                                <Card className="border-dashed">
                                    <CardContent className="py-4 space-y-3">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            New Journal Entry
                                        </p>
                                        <Input
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            placeholder="Title (optional)"
                                            className="text-sm"
                                        />
                                        <Textarea
                                            value={newContent}
                                            onChange={(e) => setNewContent(e.target.value)}
                                            placeholder="Write your reflection..."
                                            rows={4}
                                            className="resize-none text-sm"
                                        />
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                className="h-7 text-xs gap-1"
                                                onClick={() => handleAddCustom(entry.id)}
                                                disabled={loadingKey === `add-${entry.id}`}
                                            >
                                                {loadingKey === `add-${entry.id}`
                                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                                    : <Check className="h-3 w-3" />}
                                                Save
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs gap-1"
                                                onClick={() => { setAddingCustomFor(null); setNewTitle(''); setNewContent('') }}
                                            >
                                                <X className="h-3 w-3" />
                                                Cancel
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs gap-1.5 w-full border-dashed"
                                    onClick={() => setAddingCustomFor(entry.id)}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Custom Entry
                                </Button>
                            )
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// ──────────────────────────────────────────
// Reusable Section Card
// ──────────────────────────────────────────

function SectionCard({
    label,
    timestamp,
    children,
    isLeaderView,
    shared,
    loadingKey,
    sectionLoadKey,
    leaderName,
    learnerName,
    onToggleShare,
    onEdit,
    onDelete,
    deleteLoading,
    onScheduleMeeting,
    meetingLoading,
}: {
    label: string
    timestamp?: string
    children: React.ReactNode
    isLeaderView: boolean
    shared: boolean
    loadingKey: string | null
    sectionLoadKey: string
    leaderName: string
    learnerName?: string
    onToggleShare: () => void
    onEdit?: (() => void) | undefined
    onDelete?: (() => void) | undefined
    deleteLoading?: boolean
    onScheduleMeeting?: (() => Promise<void>) | undefined
    meetingLoading?: boolean
}) {
    const isToggling = loadingKey === sectionLoadKey

    return (
        <Card>
            <CardContent className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {label}
                    </p>
                    {timestamp && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                            <Clock className="h-3 w-3" />
                            {timestamp}
                        </span>
                    )}
                </div>

                {children}

                <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                    {/* Edit button (learner only) */}
                    {onEdit && (
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onEdit}>
                            <Pencil className="h-3 w-3" />
                            Edit
                        </Button>
                    )}

                    {/* Delete button (custom entries, learner only) */}
                    {onDelete && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                            onClick={onDelete}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            Delete
                        </Button>
                    )}

                    {/* Share toggle (learner only) */}
                    {!isLeaderView && (
                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs text-muted-foreground">
                                Share with {leaderName}
                            </span>
                            <Switch
                                checked={shared}
                                onCheckedChange={onToggleShare}
                                disabled={isToggling}
                            />
                            {isToggling && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        </div>
                    )}

                    {/* Schedule Meeting button (leader only) */}
                    {onScheduleMeeting && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 ml-auto"
                            disabled={meetingLoading}
                            onClick={onScheduleMeeting}
                        >
                            {meetingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarPlus className="h-3 w-3" />}
                            Schedule Meeting
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
