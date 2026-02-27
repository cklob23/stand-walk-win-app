'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { BookOpen, MessageSquare, PenLine, ChevronDown, ChevronUp, ExternalLink, Reply, Loader2, Send } from 'lucide-react'
import { format } from 'date-fns'
import { scriptureToUrl } from '@/lib/bible-utils'
import { replyToSharedItem } from '@/lib/journal-actions'
import { toast } from 'sonner'
import Link from 'next/link'

export interface SharedItem {
    id: string
    type: 'verse' | 'verse_note' | 'journal'
    scripture_ref: string
    verse_text: string
    note: string
    sender_name: string
    created_at: string
    reply_text?: string | null
    replied_at?: string | null
}

interface SharedWithMeProps {
    items: SharedItem[]
    autoOpen?: boolean
    pairingId: string
    currentUserName: string
}

export function SharedWithMe({ items, autoOpen = false, pairingId, currentUserName }: SharedWithMeProps) {
    const router = useRouter()
    const [expanded, setExpanded] = useState(autoOpen)
    const sectionRef = useRef<HTMLDivElement>(null)
    const [replyingTo, setReplyingTo] = useState<string | null>(null)
    const [replyText, setReplyText] = useState('')
    const [replySaving, setReplySaving] = useState(false)

    const handleReply = async (itemId: string) => {
        if (!replyText.trim()) return
        setReplySaving(true)
        const result = await replyToSharedItem(itemId, replyText.trim(), pairingId, currentUserName)
        if (result.error) toast.error(result.error)
        else { toast.success('Reply sent!'); router.refresh() }
        setReplyingTo(null)
        setReplyText('')
        setReplySaving(false)
    }

    useEffect(() => {
        if (autoOpen) {
            setExpanded(true)
            sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [autoOpen])

    return (
        <div ref={sectionRef} id="shared">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:bg-muted/50 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Shared With Me</span>
                    {items.length > 0 && (
                        <Badge variant="secondary" className="text-xs h-5">{items.length}</Badge>
                    )}
                </div>
                {expanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
            </button>

            {expanded && (
                <div className="mt-3 space-y-3">
                    {items.length === 0 && (
                        <Card className="border-dashed">
                            <CardContent className="py-6 text-center">
                                <p className="text-sm text-muted-foreground">
                                    Nothing shared yet. When your partner shares Bible verses, notes, or journal entries, they will appear here.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                    {items.map((item) => (
                        <Card key={item.id} className="overflow-hidden">
                            <CardContent className="p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        {item.type === 'verse_note' ? (
                                            <PenLine className="h-3.5 w-3.5 text-primary" />
                                        ) : item.type === 'journal' ? (
                                            <MessageSquare className="h-3.5 w-3.5 text-primary" />
                                        ) : (
                                            <BookOpen className="h-3.5 w-3.5 text-primary" />
                                        )}
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {item.sender_name}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                        {format(new Date(item.created_at), 'MMM d, yyyy, h:mm a')}
                                    </span>
                                </div>

                                {item.type === 'journal' ? (
                                    <>
                                        <p className="text-sm font-semibold text-foreground">
                                            {item.note || 'Journal Entry'}
                                        </p>
                                        {item.scripture_ref && (
                                            <p className="text-xs text-muted-foreground font-medium">{item.scripture_ref}</p>
                                        )}
                                    </>
                                ) : item.scripture_ref ? (
                                    <p className="text-sm font-semibold text-foreground">
                                        {item.scripture_ref}
                                    </p>
                                ) : null}

                                {item.type === 'journal' ? (
                                    <div className="text-sm text-foreground/80 whitespace-pre-line border-l-2 border-primary/30 pl-3 space-y-1">
                                        {item.verse_text.split('\n').map((line, i) => {
                                            if (line.startsWith('Q: ')) return (
                                                <p key={i} className="font-medium text-foreground/90 not-italic text-xs mt-1.5 first:mt-0">{line.slice(3)}</p>
                                            )
                                            if (line.startsWith('A: ')) return (
                                                <p key={i} className="italic">{line.slice(3)}</p>
                                            )
                                            if (line.trim() === '') return <br key={i} />
                                            return <p key={i} className="italic">{line}</p>
                                        })}
                                    </div>
                                ) : (
                                    <>
                                        {item.verse_text && (
                                            <blockquote className="text-sm text-foreground/80 italic border-l-2 border-primary/30 pl-3">
                                                {item.verse_text.length > 250
                                                    ? `${item.verse_text.slice(0, 250)}...`
                                                    : item.verse_text}
                                            </blockquote>
                                        )}

                                        {item.note && (
                                            <div className="bg-muted/50 rounded-md p-2.5">
                                                <p className="text-xs font-medium text-muted-foreground mb-0.5">Note:</p>
                                                <p className="text-sm text-foreground">{item.note}</p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {item.scripture_ref && (() => {
                                    const url = scriptureToUrl(item.scripture_ref)
                                    return url ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs gap-1.5 mt-1"
                                            asChild
                                        >
                                            <Link href={url}>
                                                <BookOpen className="h-3 w-3" />
                                                Read in Bible
                                                <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                                            </Link>
                                        </Button>
                                    ) : null
                                })()}

                                {/* Existing reply */}
                                {item.reply_text && (
                                    <div className="bg-primary/5 border border-primary/10 rounded-md p-2.5 mt-2">
                                        <p className="text-[10px] font-medium text-primary/70 mb-0.5">Your reply</p>
                                        <p className="text-sm text-foreground/85">{item.reply_text}</p>
                                        {item.replied_at && (
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {format(new Date(item.replied_at), 'MMM d, h:mm a')}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Reply form */}
                                {replyingTo === item.id ? (
                                    <div className="mt-2 space-y-2">
                                        <Textarea
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder="Write a reply..."
                                            rows={2}
                                            className="resize-none text-sm"
                                            autoFocus
                                        />
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                className="h-7 text-xs gap-1"
                                                onClick={() => handleReply(item.id)}
                                                disabled={replySaving || !replyText.trim()}
                                            >
                                                {replySaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                                Send Reply
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={() => { setReplyingTo(null); setReplyText('') }}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : !item.reply_text ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs gap-1 mt-1 text-muted-foreground hover:text-foreground"
                                        onClick={() => setReplyingTo(item.id)}
                                    >
                                        <Reply className="h-3 w-3" />
                                        Reply
                                    </Button>
                                ) : null}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
