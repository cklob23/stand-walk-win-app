'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  MAX_MESSAGE_ATTACHMENTS,
  MESSAGE_ATTACHMENT_ACCEPT,
} from '@/lib/message-limits'
import { CornerUpLeft, Loader2, Paperclip, Pencil, Send, X } from 'lucide-react'
import type { Message } from '@/lib/types'
import { getFileIcon } from './message-bubble'

export type AttachmentDraft = { file: File; preview: string | null }

interface MessageComposerProps {
  partnerName: string | null
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onTyping?: () => void
  isLoading?: boolean
  isUploading?: boolean
  replyTo: Message | null
  editingMessage: Message | null
  onCancelAction: () => void
  attachmentFiles: AttachmentDraft[]
  onRemoveAttachment: (index: number) => void
  onAttachClick: () => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  maxAttachments?: number
}

export function MessageComposer({
  partnerName,
  value,
  onChange,
  onSend,
  onTyping,
  isLoading = false,
  isUploading = false,
  replyTo,
  editingMessage,
  onCancelAction,
  attachmentFiles,
  onRemoveAttachment,
  onAttachClick,
  onFileSelect,
  fileInputRef,
  textareaRef,
  maxAttachments = MAX_MESSAGE_ATTACHMENTS,
}: MessageComposerProps) {
  const busy = isLoading || isUploading
  const canSend = !busy && Boolean(value.trim() || attachmentFiles.length > 0)
  const placeholder = editingMessage
    ? 'Edit your message...'
    : `Message ${partnerName || 'your partner'}...`

  return (
    <div data-tour="messages-input" data-testid="message-composer" className="shrink-0 border-t">
      {(replyTo || editingMessage) && (
        <div className="flex items-center gap-2 px-4 pt-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
            {replyTo && (
              <>
                <CornerUpLeft className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">
                  Replying to{' '}
                  <span className="font-medium text-foreground">
                    {replyTo.sender?.full_name || 'message'}
                  </span>
                  {': '}
                  {replyTo.content?.slice(0, 50)}
                  {(replyTo.content?.length || 0) > 50 ? '...' : ''}
                </span>
              </>
            )}
            {editingMessage && (
              <>
                <Pencil className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">Editing message</span>
              </>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onCancelAction}>
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Cancel</span>
          </Button>
        </div>
      )}

      {attachmentFiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-6">
          {attachmentFiles.map((att, idx) => {
            const FileIcon = getFileIcon(att.file.name)
            return (
              <div key={`${att.file.name}-${idx}`} className="group relative">
                {att.preview ? (
                  <img
                    src={att.preview}
                    alt={att.file.name}
                    className="h-16 w-16 rounded-lg border object-cover"
                  />
                ) : (
                  <div className="flex h-12 items-center gap-2 rounded-lg border bg-muted px-3 text-sm">
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="max-w-[140px] truncate">{att.file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(idx)}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Remove {att.file.name}</span>
                </button>
              </div>
            )
          })}
          <span className="text-xs text-muted-foreground">
            {attachmentFiles.length}/{maxAttachments}
          </span>
        </div>
      )}

      <form
        className="flex items-end gap-3 px-4 py-4 sm:px-6 sm:py-5"
        onSubmit={(e) => {
          e.preventDefault()
          onSend()
        }}
      >
        {!editingMessage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept={MESSAGE_ATTACHMENT_ACCEPT}
              onChange={onFileSelect}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              onClick={onAttachClick}
              title="Attach file"
              data-testid="message-attach"
            >
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Attach file</span>
            </Button>
          </>
        )}

        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            if (e.target.value.trim()) onTyping?.()
          }}
          placeholder={placeholder}
          className={cn(
            'min-h-12 max-h-32 flex-1 resize-none rounded-2xl border bg-background px-4 py-3 text-base shadow-none',
            'placeholder:text-muted-foreground/80 focus-visible:ring-1',
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
            if (e.key === 'Escape') {
              onCancelAction()
            }
          }}
        />

        <Button
          type="submit"
          disabled={!canSend}
          size="icon"
          data-testid="message-send"
          className="h-11 w-11 shrink-0 rounded-xl bg-primary/80 text-primary-foreground shadow-none hover:bg-primary"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : editingMessage ? (
            <Pencil className="h-5 w-5" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          <span className="sr-only">{editingMessage ? 'Save edit' : 'Send message'}</span>
        </Button>
      </form>
    </div>
  )
}
