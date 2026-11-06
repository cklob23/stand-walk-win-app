'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  MAX_MESSAGE_ATTACHMENTS,
  MESSAGE_ATTACHMENT_ACCEPT,
} from '@/lib/message-limits'
import { MESSAGE_COMPOSER_EMOJIS, insertTextAtCursor } from '@/lib/message-composer-emojis'
import {
  DICTATION_LISTENING_LABEL,
  DICTATION_PERMISSION_MESSAGE,
  DICTATION_UNSAFE_MESSAGE,
  DICTATION_UNSUPPORTED_MESSAGE,
  appendDictatedText,
  shouldSendOnEnterKey,
} from '@/lib/speech-dictation'
import { useSpeechDictation } from '@/hooks/use-speech-dictation'
import { useIsMobile } from '@/hooks/use-mobile'
import { CornerUpLeft, Loader2, Mic, Paperclip, Pencil, Send, Smile, X } from 'lucide-react'
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
  forceEmojiOpen?: boolean
  forceListening?: boolean
  forceUnsupported?: boolean
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
  forceEmojiOpen = false,
  forceListening = false,
  forceUnsupported = false,
}: MessageComposerProps) {
  const isMobile = useIsMobile()
  const [emojiOpen, setEmojiOpen] = useState(forceEmojiOpen)
  const dictation = useSpeechDictation({
    onFinalTranscript: (transcript) => {
      const current = textareaRef.current?.value ?? value
      onChange(appendDictatedText(current, transcript))
      onTyping?.()
    },
  })
  const listening = forceListening || dictation.listening
  const busy = isLoading || isUploading
  const canSend = !busy && Boolean(value.trim() || attachmentFiles.length > 0)
  const emojiVisible = forceEmojiOpen || emojiOpen
  const placeholder = editingMessage
    ? 'Edit your message...'
    : `Message ${partnerName || 'your partner'}...`

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current
    const { next, cursor } = insertTextAtCursor(value, emoji, el?.selectionStart, el?.selectionEnd)
    onChange(next)
    onTyping?.()
    setEmojiOpen(false)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(cursor, cursor)
    })
  }

  const emojiButton = (placement: 'desktop' | 'mobile') => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'shrink-0 rounded-full text-muted-foreground hover:text-foreground',
        placement === 'desktop' &&
          'hidden h-11 w-11 md:inline-flex',
        placement === 'mobile' &&
          'absolute top-1/2 h-9 w-9 -translate-y-1/2 md:hidden',
        placement === 'mobile' && (canSend ? 'right-10' : 'right-1'),
        emojiVisible && 'bg-primary/10 text-primary',
      )}
      title="Insert emoji"
      data-testid={placement === 'mobile' ? 'message-emoji' : 'message-emoji-desktop'}
      aria-expanded={emojiVisible}
      onClick={() => setEmojiOpen((open) => !open)}
    >
      <Smile className="h-5 w-5" />
      <span className="sr-only">Insert emoji</span>
    </Button>
  )

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

      {listening && (
        <p
          data-testid="dictation-status"
          className="px-4 pt-2 text-xs font-medium text-primary sm:px-6"
        >
          {DICTATION_LISTENING_LABEL}
        </p>
      )}
      {dictation.status === 'permission' && !listening && (
        <p data-testid="dictation-permission" className="px-4 pt-2 text-xs text-destructive sm:px-6">
          {DICTATION_PERMISSION_MESSAGE}
        </p>
      )}
      {(forceUnsupported || dictation.notice) && !listening && (
        <p data-testid="dictation-unavailable" className="px-4 pt-2 text-xs text-muted-foreground sm:px-6">
          {forceUnsupported ? DICTATION_UNSAFE_MESSAGE : dictation.notice}
        </p>
      )}
      {dictation.status === 'error' && !forceUnsupported && !dictation.notice && !listening && (
        <p data-testid="dictation-unsupported" className="px-4 pt-2 text-xs text-destructive sm:px-6">
          {DICTATION_UNSUPPORTED_MESSAGE}
        </p>
      )}

      {emojiVisible && (
        <div
          data-testid="message-emoji-picker"
          className="border-t px-4 py-2 sm:px-6"
        >
          <div className="grid grid-cols-8 gap-1">
            {MESSAGE_COMPOSER_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-md text-lg hover:bg-muted"
                onClick={() => insertEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        className="flex items-end gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-md:items-center max-md:gap-2.5 md:gap-3 md:px-6 md:py-5 md:pb-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (listening) dictation.stop()
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

        {emojiButton('desktop')}

        <div className="relative min-w-0 flex-1">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              if (e.target.value.trim()) onTyping?.()
            }}
            placeholder={placeholder}
            className={cn(
              'min-h-12 max-h-32 w-full resize-none border bg-background py-3 text-base shadow-none',
              'placeholder:text-muted-foreground/80 focus-visible:ring-1',
              'rounded-full px-4 max-md:min-h-11 max-md:py-2.5 max-md:pr-12 md:rounded-2xl md:px-4',
              canSend && 'max-md:pr-[5.5rem]',
            )}
            rows={1}
            onKeyDown={(e) => {
              if (shouldSendOnEnterKey(e.key, e.shiftKey, !isMobile)) {
                e.preventDefault()
                if (listening) dictation.stop()
                onSend()
              }
              if (e.key === 'Escape') {
                onCancelAction()
              }
            }}
          />
          {emojiButton('mobile')}
          {canSend && (
            <Button
              type="submit"
              size="icon"
              data-testid="message-send-mobile"
              className="absolute top-1/2 right-1 h-9 w-9 -translate-y-1/2 rounded-full bg-primary/80 text-primary-foreground shadow-none hover:bg-primary md:hidden"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingMessage ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">{editingMessage ? 'Save edit' : 'Send message'}</span>
            </Button>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="message-mic"
          aria-pressed={listening}
          title={listening ? 'Stop dictation' : 'Dictate message'}
          className={cn(
            'h-11 w-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground',
            listening && 'bg-primary/15 text-primary hover:text-primary',
          )}
          onClick={() => dictation.toggle()}
        >
          <Mic className={cn('h-5 w-5', listening && 'animate-pulse')} />
          <span className="sr-only">{listening ? 'Stop dictation' : 'Dictate message'}</span>
        </Button>

        <Button
          type="submit"
          disabled={!canSend}
          size="icon"
          data-testid="message-send"
          className="hidden h-11 w-11 shrink-0 rounded-xl bg-primary/80 text-primary-foreground shadow-none hover:bg-primary md:inline-flex"
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
