'use client'

import { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
    BookHeart, Calendar, Loader2, CalendarPlus, Pencil,
    Check, X, Plus, Trash2, Clock, Paperclip, Image, FileText, Music, Eye,
} from 'lucide-react'
import {
    toggleSectionShare,
    updateJournalGodSpeakingSection,
    addCustomEntry,
    updateCustomEntry,
    deleteCustomEntry,
    deleteJournalEntry,
    deleteVerseEntry,
    saveJournalEntry,
    type JournalAttachment,
} from '@/lib/journal-actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { AttachmentPreviewModal } from '@/components/messages/attachment-preview-modal'

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
    attachments?: JournalAttachment[]
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

    // The first part is usually the daily reflection free-text (may be empty)
    // But if it contains @@TITLE: headers, it's a corrupted verse entry that got moved to index 0
    const firstPart = (parts[0] || '').trim()
    const firstPartIsVerse = firstPart.startsWith('@@TITLE: ') || firstPart.startsWith('@@TIME: ')

    const freeText = firstPartIsVerse ? '' : firstPart

    // All subsequent parts are verse entries; if first part is also a verse, include it
    const verses: ParsedVerseSection[] = (firstPartIsVerse ? parts : parts.slice(1))
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

    // Attachment preview state
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [previewType, setPreviewType] = useState<'image' | 'file'>('file')
    const [previewFilename, setPreviewFilename] = useState<string>('')

    // Edit mode attachment state
    const editFileInputRef = useRef<HTMLInputElement>(null)
    const [editPendingFiles, setEditPendingFiles] = useState<File[]>([])
    const [uploadingEditFiles, setUploadingEditFiles] = useState(false)

    const handlePreviewAttachment = (attachment: JournalAttachment) => {
        setPreviewUrl(`/api/journal/file?id=${attachment.id}`)
        setPreviewType(attachment.file_type === 'image' ? 'image' : 'file')
        setPreviewFilename(attachment.filename)
    }

    const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        const validFiles = files.filter(file => {
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`${file.name} is too large. Maximum size is 10MB.`)
                return false
            }
            return true
        })
        setEditPendingFiles(prev => [...prev, ...validFiles])
        if (editFileInputRef.current) editFileInputRef.current.value = ''
    }

    const removeEditPendingFile = (index: number) => {
        setEditPendingFiles(prev => prev.filter((_, i) => i !== index))
    }

    const uploadEditFiles = async (entryId: string, sectionKey: string) => {
        if (editPendingFiles.length === 0) return
        setUploadingEditFiles(true)
        for (const file of editPendingFiles) {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('journalEntryId', entryId)
            formData.append('sectionKey', sectionKey)
            try {
                const res = await fetch('/api/journal/upload', { method: 'POST', body: formData })
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}))
                    toast.error(`Failed to upload ${file.name}: ${errorData.error || 'Unknown error'}`)
                }
            } catch {
                toast.error(`Failed to upload ${file.name}`)
            }
        }
        setUploadingEditFiles(false)
        setEditPendingFiles([])
    }

    const getEditFileIcon = (file: File) => {
        if (file.type.startsWith('image/')) return <Image className="h-4 w-4" />
        if (file.type.startsWith('audio/')) return <Music className="h-4 w-4" />
        return <FileText className="h-4 w-4" />
    }

    // Handler to delete an attachment
    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!confirm('Remove this attachment?')) return
        setLoadingKey(`delete-att-${attachmentId}`)
        try {
            const res = await fetch(`/api/journal/upload?attachmentId=${attachmentId}`, { method: 'DELETE' })
            if (res.ok) {
                toast.success('Attachment removed')
                router.refresh()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error || 'Failed to remove attachment')
            }
        } catch {
            toast.error('Failed to remove attachment')
        }
        setLoadingKey(null)
    }

    // Helper to render inline attachments for a specific section
    const renderSectionAttachments = (attachments: JournalAttachment[] | undefined, sectionKey: string) => {
        const sectionAttachments = attachments?.filter(att => att.section_key === sectionKey) || []
        if (sectionAttachments.length === 0) return null

        return (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                {sectionAttachments.map((att) => (
                    <div
                        key={att.id}
                        className="group relative flex items-center gap-2 p-2 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
                    >
                        <button
                            onClick={() => handlePreviewAttachment(att)}
                            className="flex items-center gap-2"
                        >
                            {att.file_type === 'image' ? (
                                <img
                                    src={`/api/journal/file?id=${att.id}`}
                                    alt={att.filename}
                                    className="h-10 w-10 object-cover rounded"
                                />
                            ) : (
                                <div className="h-10 w-10 flex items-center justify-center bg-background rounded">
                                    {att.file_type === 'audio' ? (
                                        <Music className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </div>
                            )}
                            <div className="text-left max-w-[100px]">
                                <p className="text-xs font-medium truncate">{att.filename}</p>
                                <p className="text-[10px] text-muted-foreground">
                                    {(att.file_size / 1024).toFixed(0)} KB
                                </p>
                            </div>
                            <Eye className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                        {/* Delete button - only show for entry owner, not in leader view */}
                        {!isLeaderView && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(att.id) }}
                                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove attachment"
                            >
                                {loadingKey === `delete-att-${att.id}` ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <X className="h-3 w-3" />
                                )}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        )
    }

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
        const result = await updateJournalGodSpeakingSection(entryId, sectionIndex, editText.trim(), editTitle.trim() || undefined)
        if (result.error) toast.error(result.error)
        else { toast.success('Updated!'); router.refresh() }
        setEditingKey(null)
        setEditText('')
        setEditTitle('')
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

    const handleDeleteCustom = async (entryId: string, customIndex: number, customCreatedAt?: string) => {
        if (!confirm('Delete this custom entry? This cannot be undone.')) return
        const key = `del-${entryId}-custom-${customIndex}`
        setLoadingKey(key)
        const result = await deleteCustomEntry(entryId, customIndex, pairingId, customCreatedAt)
        if (result.error) toast.error(result.error)
        else { toast.success('Deleted'); router.refresh() }
        setLoadingKey(null)
    }

    const handleDeleteEntry = async (entryId: string) => {
        if (!confirm('Delete this entire journal entry? This cannot be undone.')) return
        const key = `del-entry-${entryId}`
        setLoadingKey(key)
        const result = await deleteJournalEntry(entryId, pairingId)
        if (result.error) toast.error(result.error)
        else { toast.success('Entry deleted'); router.refresh() }
        setLoadingKey(null)
    }

    const handleDeleteVerse = async (entryId: string, sectionIndex: number) => {
        if (!confirm('Delete this entry? This cannot be undone.')) return
        const key = `del-${entryId}-verse-${sectionIndex}`
        setLoadingKey(key)
        const result = await deleteVerseEntry(entryId, sectionIndex, pairingId)
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

    // Filter out entries that have no visible content
    const visibleEntries = entries.filter((entry) => {
        const { freeText, verses } = parseGodSpeakingSections(entry.god_speaking)
        const customs = (entry.custom_entries as { title: string; content: string; created_at: string }[]) || []
        const hasDailyContent = !!entry.prayer_items?.trim() || !!freeText
        return hasDailyContent || verses.length > 0 || customs.length > 0
    })

    if (visibleEntries.length === 0) {
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
                            : 'Your daily prayer journal entries will appear here. Tap "New Reflection" above to write your first one!'}
                    </p>
                </CardContent>
            </Card>
        )
    }

    // Group entries by date for proper date headers
    const entriesByDate: Record<string, typeof visibleEntries> = {}
    for (const entry of visibleEntries) {
        const dateKey = entry.journal_date
        if (!entriesByDate[dateKey]) entriesByDate[dateKey] = []
        entriesByDate[dateKey].push(entry)
    }

    // Get sorted dates (newest first)
    const sortedDates = Object.keys(entriesByDate).sort((a, b) =>
        new Date(b).getTime() - new Date(a).getTime()
    )

    return (
        <div className="space-y-6">
            {sortedDates.map((dateKey) => {
                const dateEntries = entriesByDate[dateKey]

                return (
                    <div key={dateKey} className="space-y-3">
                        {/* ── Date header (shown once per date) ── */}
                        <div className="flex items-center gap-2 pt-1">
                            <Calendar className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-sm font-medium text-foreground">
                                {format(parseISO(dateKey), 'EEEE, MMMM d, yyyy')}
                            </span>
                            {isLeaderView && (
                                <Badge variant="secondary" className="text-xs gap-1 ml-auto">
                                    Shared by {learnerName}
                                </Badge>
                            )}
                        </div>

                        {/* Entries for this date */}
                        {dateEntries.map((entry) => {
                            const { freeText, verses } = parseGodSpeakingSections(entry.god_speaking)
                            const customs = (entry.custom_entries as { title: string; content: string; created_at: string }[]) || []
                            const hasDailyContent = !!entry.prayer_items?.trim() || !!freeText

                            // For leader view: only show sections that are shared
                            const dailyShared = isSectionShared(entry, 'daily')

                            return (
                                <div key={entry.id} className="space-y-3">

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
                                            onDelete={!isLeaderView ? () => handleDeleteEntry(entry.id) : undefined}
                                            deleteLoading={loadingKey === `del-entry-${entry.id}`}
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
                                            {/* Render attachments for daily section */}
                                            {renderSectionAttachments(entry.attachments, 'daily')}
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
                                                    setEditTitle(verse.title || '')
                                                } : undefined}
                                                onDelete={!isLeaderView ? () => handleDeleteVerse(entry.id, idx + 1) : undefined}
                                                deleteLoading={loadingKey === `del-${entry.id}-verse-${idx + 1}`}
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
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-medium text-muted-foreground">Title</label>
                                                            <Input
                                                                value={editTitle}
                                                                onChange={(e) => setEditTitle(e.target.value)}
                                                                placeholder="Entry title..."
                                                                className="text-sm h-8"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-xs font-medium text-muted-foreground">Content</label>
                                                            <Textarea
                                                                value={editText}
                                                                onChange={(e) => setEditText(e.target.value)}
                                                                rows={4}
                                                                className="resize-none text-sm"
                                                            />
                                                        </div>
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
                                                                onClick={() => { setEditingKey(null); setEditText(''); setEditTitle('') }}
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
                                        // Use created_at as stable section key (falls back to index for legacy entries)
                                        const sectionKey = custom.created_at ? `custom_${custom.created_at}` : `custom_${idx}`
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
                                                onDelete={!isLeaderView ? () => handleDeleteCustom(entry.id, idx, custom.created_at) : undefined}
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

                                                        {/* Attachment Section for Edit */}
                                                        <div className="space-y-2">
                                                            <input
                                                                ref={editFileInputRef}
                                                                type="file"
                                                                multiple
                                                                accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
                                                                onChange={handleEditFileSelect}
                                                                className="hidden"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => editFileInputRef.current?.click()}
                                                                className="w-full border-dashed h-8 text-xs"
                                                            >
                                                                <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                                                                Add attachment
                                                            </Button>

                                                            {/* Pending Files */}
                                                            {editPendingFiles.length > 0 && (
                                                                <div className="space-y-1.5">
                                                                    {editPendingFiles.map((file, fileIdx) => (
                                                                        <div
                                                                            key={`pending-edit-${fileIdx}`}
                                                                            className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-md"
                                                                        >
                                                                            {file.type.startsWith('image/') ? (
                                                                                <img
                                                                                    src={URL.createObjectURL(file)}
                                                                                    alt={file.name}
                                                                                    className="h-8 w-8 object-cover rounded"
                                                                                />
                                                                            ) : (
                                                                                <div className="h-8 w-8 flex items-center justify-center bg-background rounded">
                                                                                    {getEditFileIcon(file)}
                                                                                </div>
                                                                            )}
                                                                            <span className="flex-1 text-xs truncate">{file.name}</span>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-6 w-6"
                                                                                onClick={() => removeEditPendingFile(fileIdx)}
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                className="h-7 text-xs gap-1"
                                                                onClick={async () => {
                                                                    await handleSaveCustomEdit(entry.id, idx)
                                                                    if (editPendingFiles.length > 0) {
                                                                        // Use timestamp-based section key
                                                                        const editSectionKey = custom.created_at ? `custom_${custom.created_at}` : `custom_${idx}`
                                                                        await uploadEditFiles(entry.id, editSectionKey)
                                                                        router.refresh()
                                                                    }
                                                                }}
                                                                disabled={loadingKey === `edit-${entry.id}-custom-${idx}` || uploadingEditFiles}
                                                            >
                                                                {(loadingKey === `edit-${entry.id}-custom-${idx}` || uploadingEditFiles)
                                                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                                                    : <Check className="h-3 w-3" />}
                                                                Save
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 text-xs gap-1"
                                                                onClick={() => { setEditingKey(null); setEditText(''); setEditTitle(''); setEditPendingFiles([]) }}
                                                            >
                                                                <X className="h-3 w-3" />
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                                                            {custom.content}
                                                        </p>
                                                        {renderSectionAttachments(entry.attachments, sectionKey)}
                                                    </>
                                                )}
                                            </SectionCard>
                                        )
                                    })}

                                </div>
                            )
                        })}
                    </div>
                )
            })}

            {/* Attachment Preview Modal */}
            <AttachmentPreviewModal
                open={!!previewUrl}
                onOpenChange={(open) => { if (!open) setPreviewUrl(null) }}
                url={previewUrl || ''}
                type={previewType}
                filename={previewFilename}
            />
        </div>
    )
}

// ── Standalone Add Custom Entry component ──
// Placed once above all entries in the parent component
export function AddCustomEntryButton({
    entries,
    pairingId,
    isLeaderView,
}: {
    entries: JournalEntry[]
    pairingId: string
    isLeaderView: boolean
}) {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [adding, setAdding] = useState(false)
    const [newTitle, setNewTitle] = useState('')
    const [newContent, setNewContent] = useState('')
    const [saving, setSaving] = useState(false)
    const [pendingFiles, setPendingFiles] = useState<File[]>([])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        const validFiles = files.filter(file => {
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`${file.name} is too large. Maximum size is 10MB.`)
                return false
            }
            return true
        })
        setPendingFiles(prev => [...prev, ...validFiles])
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const removePendingFile = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index))
    }

    const getFileIcon = (file: File) => {
        if (file.type.startsWith('image/')) return <Image className="h-4 w-4" />
        if (file.type.startsWith('audio/')) return <Music className="h-4 w-4" />
        return <FileText className="h-4 w-4" />
    }

    const uploadFiles = async (entryId: string, sectionKey: string) => {
        for (const file of pendingFiles) {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('journalEntryId', entryId)
            formData.append('sectionKey', sectionKey)

            try {
                const res = await fetch('/api/journal/upload', {
                    method: 'POST',
                    body: formData,
                })
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}))
                    toast.error(`Failed to upload ${file.name}: ${errorData.error || 'Unknown error'}`)
                }
            } catch {
                toast.error(`Failed to upload ${file.name}`)
            }
        }
    }

    const handleSave = async () => {
        if (!newContent.trim()) { toast.error('Please write something.'); return }
        setSaving(true)

        const localDate = new Date().toLocaleDateString('en-CA')

        // Find an existing entry for TODAY's date, or create one
        let targetEntryId: string | null = entries.find(e => e.journal_date === localDate)?.id || null

        // If no entry for today exists, create a blank journal entry for today
        if (!targetEntryId) {
            const createResult = await saveJournalEntry({
                prayerItems: '',
                godSaying: '',
                pairingId,
                localDate,
            })
            if (createResult.error) {
                toast.error(createResult.error)
                setSaving(false)
                return
            }
            targetEntryId = createResult.entryId || null
        }

        if (!targetEntryId) {
            toast.error('Could not create journal entry.')
            setSaving(false)
            return
        }

        const result = await addCustomEntry(targetEntryId, newTitle.trim(), newContent.trim())
        if (result.error) {
            toast.error(result.error)
            setSaving(false)
            return
        }

        // Upload any pending files with timestamp-based section_key (stable identifier)
        if (pendingFiles.length > 0 && result.createdAt) {
            await uploadFiles(targetEntryId, `custom_${result.createdAt}`)
        }

        toast.success('Entry added!')
        router.refresh()
        setAdding(false)
        setNewTitle('')
        setNewContent('')
        setPendingFiles([])
        setSaving(false)
    }

    if (adding) {
        return (
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

                    {/* Attachment Section */}
                    <div className="space-y-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full border-dashed h-8 text-xs"
                        >
                            <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                            Add photos, audio, or files
                        </Button>

                        {/* Pending Files */}
                        {pendingFiles.length > 0 && (
                            <div className="space-y-1.5">
                                {pendingFiles.map((file, index) => (
                                    <div
                                        key={`pending-${index}`}
                                        className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-md"
                                    >
                                        {file.type.startsWith('image/') ? (
                                            <img
                                                src={URL.createObjectURL(file)}
                                                alt={file.name}
                                                className="h-8 w-8 object-cover rounded"
                                            />
                                        ) : (
                                            <div className="h-8 w-8 flex items-center justify-center bg-background rounded">
                                                {getFileIcon(file)}
                                            </div>
                                        )}
                                        <span className="flex-1 text-xs truncate">{file.name}</span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {(file.size / 1024).toFixed(0)}KB
                                        </span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => removePendingFile(index)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Check className="h-3 w-3" />}
                            Save
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => { setAdding(false); setNewTitle(''); setNewContent(''); setPendingFiles([]) }}
                        >
                            <X className="h-3 w-3" />
                            Cancel
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 w-full border-dashed"
            onClick={() => setAdding(true)}
        >
            <Plus className="h-3.5 w-3.5" />
            Add Custom Entry
        </Button>
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
                <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide min-w-0 break-words leading-relaxed flex-1">
                        {label}
                    </p>
                    {timestamp && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 pt-0.5">
                            <Clock className="h-3 w-3 shrink-0" />
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
