'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, BookHeart, X, Paperclip, Image, FileText, Music, Trash2 } from 'lucide-react'
import { saveJournalEntry, updateJournalEntry, type JournalAttachment } from '@/lib/journal-actions'
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
    existingAttachments?: JournalAttachment[]
    onClose: () => void
}

export function JournalEntryEditor({
    pairingId,
    leaderName,
    existingEntry,
    existingAttachments = [],
    onClose,
}: JournalEntryEditorProps) {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // When editing, only show the free-text part (section 0, before any ---)
    const freeTextGodSpeaking = existingEntry
        ? (existingEntry.god_speaking || '').split('\n\n---\n\n')[0]
        : ''

    const [prayerItems, setPrayerItems] = useState(existingEntry?.prayer_items || '')
    const [godSaying, setGodSaying] = useState(freeTextGodSpeaking)
    const [isSaving, setIsSaving] = useState(false)
    const [attachments, setAttachments] = useState<JournalAttachment[]>(existingAttachments)
    const [pendingFiles, setPendingFiles] = useState<File[]>([])
    const [uploadingFiles, setUploadingFiles] = useState(false)

    const isEditing = !!existingEntry

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

    const removeExistingAttachment = async (attachmentId: string) => {
        try {
            const res = await fetch(`/api/journal/upload?attachmentId=${attachmentId}`, {
                method: 'DELETE',
            })
            if (!res.ok) throw new Error('Failed to delete attachment')
            setAttachments(prev => prev.filter(a => a.id !== attachmentId))
            toast.success('Attachment removed')
        } catch {
            toast.error('Failed to remove attachment')
        }
    }

    const uploadFiles = async (entryId: string) => {
        if (pendingFiles.length === 0) return

        setUploadingFiles(true)
        for (const file of pendingFiles) {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('journalEntryId', entryId)
            formData.append('sectionKey', 'daily') // Daily reflection attachments use 'daily' section key

            try {
                const res = await fetch('/api/journal/upload', {
                    method: 'POST',
                    body: formData,
                })
                if (!res.ok) {
                    const error = await res.json()
                    throw new Error(error.error || 'Upload failed')
                }
            } catch (err) {
                toast.error(`Failed to upload ${file.name}`)
            }
        }
        setUploadingFiles(false)
        setPendingFiles([])
    }

    const getFileIcon = (file: File | JournalAttachment) => {
        const fileType = 'type' in file ? file.type : file.file_type
        if (fileType === 'image' || (typeof fileType === 'string' && fileType.startsWith('image/'))) return <Image className="h-4 w-4" />
        if (fileType === 'audio' || (typeof fileType === 'string' && fileType.startsWith('audio/'))) return <Music className="h-4 w-4" />
        return <FileText className="h-4 w-4" />
    }

    const handleSave = async () => {
        if (!prayerItems.trim() && !godSaying.trim()) {
            toast.error('Please fill in at least one of the prompts.')
            return
        }

        setIsSaving(true)

        let result
        let entryId: string | undefined
        if (isEditing) {
            result = await updateJournalEntry({
                entryId: existingEntry.id,
                prayerItems: prayerItems.trim(),
                godSaying: godSaying.trim(),
                pairingId,
            })
            entryId = existingEntry.id
        } else {
            const localDate = new Date().toLocaleDateString('en-CA') // yyyy-MM-dd
            result = await saveJournalEntry({
                prayerItems: prayerItems.trim(),
                godSaying: godSaying.trim(),
                pairingId,
                localDate,
            })
            entryId = result.entryId
        }

        if (result.error) {
            toast.error(result.error)
            setIsSaving(false)
            return
        }

        // Upload pending files if we have an entry ID
        if (entryId && pendingFiles.length > 0) {
            await uploadFiles(entryId)
        }

        toast.success(isEditing ? 'Journal entry updated!' : 'Journal entry saved!')
        onClose()
        router.refresh()
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

                {/* Attachments Section */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">
                        Attachments
                    </Label>

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
                        className="w-full border-dashed"
                    >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Add photos, audio, or files
                    </Button>

                    {/* Existing Attachments */}
                    {attachments.length > 0 && (
                        <div className="space-y-2">
                            {attachments.map((attachment) => (
                                <div
                                    key={attachment.id}
                                    className="flex items-center gap-2 p-2 bg-muted rounded-md"
                                >
                                    {attachment.file_type === 'image' ? (
                                        <img
                                            src={`/api/journal/file?id=${attachment.id}`}
                                            alt={attachment.filename}
                                            className="h-10 w-10 object-cover rounded"
                                        />
                                    ) : (
                                        <div className="h-10 w-10 flex items-center justify-center bg-background rounded">
                                            {getFileIcon(attachment)}
                                        </div>
                                    )}
                                    <span className="flex-1 text-sm truncate">{attachment.filename}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => removeExistingAttachment(attachment.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pending Files */}
                    {pendingFiles.length > 0 && (
                        <div className="space-y-2">
                            {pendingFiles.map((file, index) => (
                                <div
                                    key={`pending-${index}`}
                                    className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-md"
                                >
                                    {file.type.startsWith('image/') ? (
                                        <img
                                            src={URL.createObjectURL(file)}
                                            alt={file.name}
                                            className="h-10 w-10 object-cover rounded"
                                        />
                                    ) : (
                                        <div className="h-10 w-10 flex items-center justify-center bg-background rounded">
                                            {getFileIcon(file)}
                                        </div>
                                    )}
                                    <span className="flex-1 text-sm truncate">{file.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {(file.size / 1024).toFixed(0)}KB
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => removePendingFile(index)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving || uploadingFiles}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || uploadingFiles}>
                        {(isSaving || uploadingFiles) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        {uploadingFiles ? 'Uploading...' : isEditing ? 'Update' : 'Save'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
