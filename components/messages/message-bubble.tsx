'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Check, CheckCheck, CornerUpLeft, Pencil, Smile, X, FileText, ExternalLink, ImageIcon, FileVideo, FileAudio, FileSpreadsheet, FileCode, File, FileArchive, Presentation } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { ReactionPicker, ReactionDisplay, getReactionIcon } from './reaction-picker'
import { AttachmentPreviewModal } from './attachment-preview-modal'
import type { Message, MessageReaction } from '@/lib/types'

interface MessageBubbleProps {
    msg: Message
    isOwn: boolean
    senderInitials: string
    senderAvatar?: string | null
    senderName?: string | null
    currentUserId: string
    showTimestamp?: boolean
    showAvatar?: boolean
    onReply: (msg: Message) => void
    onEdit: (msg: Message) => void
    onToggleReaction: (messageId: string, emoji: MessageReaction['emoji']) => void
    onScrollToMessage?: (messageId: string) => void
}

export function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return ImageIcon
    // Video
    if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv'].includes(ext)) return FileVideo
    // Audio
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return FileAudio
    // Spreadsheets
    if (['xls', 'xlsx', 'csv', 'numbers'].includes(ext)) return FileSpreadsheet
    // Presentations
    if (['ppt', 'pptx', 'key'].includes(ext)) return Presentation
    // Code
    if (['js', 'ts', 'tsx', 'jsx', 'html', 'css', 'json', 'xml', 'py', 'java', 'rb'].includes(ext)) return FileCode
    // Archives
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchive
    // Word docs / PDFs / text
    if (['doc', 'docx', 'pdf', 'txt', 'rtf', 'odt', 'pages'].includes(ext)) return FileText
    return File
}

function formatMessageDate(date: string) {
    const d = new Date(date)
    if (isToday(d)) return format(d, 'h:mm a')
    if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`
    return format(d, 'MMM d, h:mm a')
}

export function MessageBubble({
    msg,
    isOwn,
    senderInitials,
    senderAvatar,
    senderName,
    currentUserId,
    showTimestamp = true,
    showAvatar = true,
    onReply,
    onEdit,
    onToggleReaction,
    onScrollToMessage,
}: MessageBubbleProps) {
    const [showActions, setShowActions] = useState(false)
    const [showReactionPicker, setShowReactionPicker] = useState(false)
    const [previewOpen, setPreviewOpen] = useState(false)
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const handleMouseEnter = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        setShowActions(true)
    }

    const handleMouseLeave = () => {
        hoverTimeoutRef.current = setTimeout(() => {
            setShowActions(false)
            setShowReactionPicker(false)
        }, 300)
    }

    const handleReactionSelect = (emoji: MessageReaction['emoji']) => {
        onToggleReaction(msg.id, emoji)
        setShowReactionPicker(false)
        setShowActions(false)
    }

    return (
        <div
            className={cn('flex items-end gap-2 sm:gap-3 group', isOwn && 'flex-row-reverse')}
            id={`msg-${msg.id}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <Avatar className={cn("h-7 w-7 sm:h-8 sm:w-8 shrink-0", !showAvatar && "invisible")}>
                {senderAvatar && senderAvatar.length > 0 ? (
                    <AvatarImage src={senderAvatar} alt={senderName || ''} />
                ) : null}
                <AvatarFallback className="text-xs bg-primary/10 text-primary" delayMs={0}>
                    {senderInitials}
                </AvatarFallback>
            </Avatar>

            <div className={cn('flex-1 max-w-[85%] sm:max-w-[75%]', isOwn ? 'text-right' : 'text-left')}>
                {/* Reply preview */}
                {msg.reply_to && (
                    <button
                        onClick={() => onScrollToMessage?.(msg.reply_to!.id)}
                        className={cn(
                            'flex items-start gap-1.5 mb-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground max-w-full truncate border-l-2 border-primary/40 bg-muted/50 hover:bg-muted transition-colors cursor-pointer',
                            isOwn ? 'ml-auto' : 'mr-auto'
                        )}
                    >
                        <CornerUpLeft className="h-3 w-3 shrink-0 mt-0.5" />
                        <span className="truncate">
                            <span className="font-medium text-foreground/70">
                                {msg.reply_to.sender?.full_name || 'Unknown'}
                            </span>
                            {': '}
                            {msg.reply_to.content?.slice(0, 60)}
                            {(msg.reply_to.content?.length || 0) > 60 ? '...' : ''}
                        </span>
                    </button>
                )}

                <div className="relative inline-block pt-2">
                    {/* Reaction badges -- iMessage style, always top-right */}
                    {msg.reactions && msg.reactions.length > 0 && (
                        <div className="absolute -top-3 right-0 z-10">
                            <ReactionDisplay
                                reactions={msg.reactions}
                                currentUserId={currentUserId}
                                onToggle={(emoji) => onToggleReaction(msg.id, emoji)}
                                isOwn={isOwn}
                            />
                        </div>
                    )}

                    {/* Action buttons (hover) */}
                    {showActions && !msg.id.startsWith('temp-') && (
                        <div
                            className={cn(
                                'absolute -top-8 flex items-center gap-0.5 z-10',
                                isOwn ? 'right-0' : 'left-0'
                            )}
                        >
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full bg-card border shadow-sm"
                                onClick={() => {
                                    setShowReactionPicker(!showReactionPicker)
                                }}
                                title="React"
                            >
                                <Smile className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full bg-card border shadow-sm"
                                onClick={() => { onReply(msg); setShowActions(false) }}
                                title="Reply"
                            >
                                <CornerUpLeft className="h-3.5 w-3.5" />
                            </Button>
                            {isOwn && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-full bg-card border shadow-sm"
                                    onClick={() => { onEdit(msg); setShowActions(false) }}
                                    title="Edit"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Reaction picker dropdown */}
                    {showReactionPicker && (
                        <div className={cn('absolute -top-16 z-20', isOwn ? 'right-0' : 'left-0')}>
                            <ReactionPicker
                                onSelect={handleReactionSelect}
                                side={isOwn ? 'right' : 'left'}
                            />
                        </div>
                    )}

                    {/* Image attachment -- standalone, no bubble */}
                    {msg.attachment_url && msg.attachment_type === 'image' && (
                        <div className={cn('mb-1', isOwn ? 'ml-auto' : 'mr-auto')}>
                            <img
                                src={msg.attachment_url}
                                alt="Shared image"
                                className="rounded-2xl max-w-full max-h-72 object-cover cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
                                onClick={() => setPreviewOpen(true)}
                                crossOrigin="anonymous"
                            />
                        </div>
                    )}

                    {/* File attachment -- standalone card, no bubble */}
                    {msg.attachment_url && msg.attachment_type === 'file' && (() => {
                        const fileName = decodeURIComponent(msg.attachment_url!.split('/').pop()?.split('?')[0] || 'File')
                        const IconComponent = getFileIcon(fileName)
                        return (
                            <button
                                type="button"
                                onClick={() => setPreviewOpen(true)}
                                className={cn(
                                    'flex items-center gap-2.5 mb-1 px-3 py-2.5 rounded-2xl text-sm transition-colors border shadow-sm cursor-pointer w-full',
                                    'bg-card hover:bg-muted text-foreground text-left'
                                )}
                            >
                                <IconComponent className="h-5 w-5 shrink-0 text-primary" />
                                <span className="truncate flex-1">{fileName}</span>
                                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </button>
                        )
                    })()}

                    {/* Text bubble -- only if there's text content or a link attachment */}
                    {(msg.content || (msg.attachment_url && msg.attachment_type === 'link')) && (
                        <div
                            className={cn(
                                'inline-block rounded-2xl px-4 py-2',
                                isOwn
                                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                    : 'bg-muted text-foreground rounded-tl-sm'
                            )}
                        >
                            {msg.attachment_url && msg.attachment_type === 'link' && (
                                <a
                                    href={msg.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                        'flex items-center gap-1.5 mb-1 text-xs underline underline-offset-2',
                                        isOwn ? 'text-primary-foreground/80' : 'text-primary'
                                    )}
                                >
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{msg.attachment_url.replace(/^https?:\/\//, '').slice(0, 40)}</span>
                                </a>
                            )}
                            {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                        </div>
                    )}
                </div>

                {/* Timestamp + edit badge + read status -- only shown when showTimestamp is true */}
                {showTimestamp && (
                    <p className={cn('text-xs text-muted-foreground mt-1 flex items-center gap-1', isOwn ? 'justify-end' : 'justify-start')}>
                        <span>{formatMessageDate(msg.created_at)}</span>
                        {msg.edited_at && (
                            <span className="italic text-muted-foreground/70">(edited)</span>
                        )}
                        {isOwn && (
                            msg.is_read ? (
                                <CheckCheck className="h-3.5 w-3.5 text-primary" />
                            ) : (
                                <Check className="h-3.5 w-3.5" />
                            )
                        )}
                    </p>
                )}
            </div>

            {/* Attachment preview modal */}
            {msg.attachment_url && (msg.attachment_type === 'image' || msg.attachment_type === 'file') && (
                <AttachmentPreviewModal
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                    url={msg.attachment_url}
                    type={msg.attachment_type}
                />
            )}
        </div>
    )
}
