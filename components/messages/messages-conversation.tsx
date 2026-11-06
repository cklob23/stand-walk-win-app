'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ChatAvatar, MessageBubble } from './message-bubble'
import { Button } from '@/components/ui/button'
import { FeatureTour } from '@/components/onboarding/feature-tour'
import { messagesSteps } from '@/lib/tour-steps'
import { ChevronLeft, Circle, MessageSquare, Phone, Video } from 'lucide-react'
import type { Message, MessageReaction, Profile } from '@/lib/types'
import {
  formatGroupDateLabel,
  groupMessagesByDay,
  needsSenderSpacing,
  profileInitials,
} from '@/lib/message-thread'
import { MAX_MESSAGE_ATTACHMENTS } from '@/lib/message-limits'
import { MessageComposer, type AttachmentDraft } from './message-composer'

function GroupDateLabel({ dateStr }: { dateStr: string }) {
  const [text, setText] = useState(() => formatGroupDateLabel(dateStr))

  useEffect(() => {
    setText(formatGroupDateLabel(dateStr))
  }, [dateStr])

  return <>{text}</>
}

export interface MessagesConversationProps {
  profile: Profile
  partner: Profile
  messages: Message[]
  newMessage: string
  onNewMessageChange: (value: string) => void
  onSend: () => void
  onTyping?: () => void
  isLoading?: boolean
  isUploading?: boolean
  isPartnerOnline?: boolean
  isPartnerTyping?: boolean
  replyTo: Message | null
  editingMessage: Message | null
  onReply: (msg: Message) => void
  onEdit: (msg: Message) => void
  onCancelAction: () => void
  onToggleReaction: (messageId: string, emoji: MessageReaction['emoji']) => void
  onScrollToMessage: (messageId: string) => void
  attachmentFiles: AttachmentDraft[]
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveAttachment: (index: number) => void
  onAttachClick: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  localDayReady: boolean
  showTour?: boolean
  onBack?: () => void
  forceEmojiOpen?: boolean
  forceListening?: boolean
  forceRecording?: boolean
  forceTranscribing?: boolean
  forceError?: boolean
}

export function MessagesConversation({
  profile,
  partner,
  messages,
  newMessage,
  onNewMessageChange,
  onSend,
  onTyping,
  isLoading = false,
  isUploading = false,
  isPartnerOnline = false,
  isPartnerTyping = false,
  replyTo,
  editingMessage,
  onReply,
  onEdit,
  onCancelAction,
  onToggleReaction,
  onScrollToMessage,
  attachmentFiles,
  onFileSelect,
  onRemoveAttachment,
  onAttachClick,
  fileInputRef,
  textareaRef,
  messagesEndRef,
  scrollContainerRef,
  localDayReady,
  showTour = true,
  onBack,
  forceEmojiOpen = false,
  forceListening = false,
  forceRecording = false,
  forceTranscribing = false,
  forceError = false,
}: MessagesConversationProps) {
  const partnerInitials = profileInitials(partner.full_name)
  const ownInitials = profileInitials(profile.full_name)
  const groupedMessages = groupMessagesByDay(messages, localDayReady)

  return (
    <div
      className={cn(
        'bg-background max-md:fixed max-md:inset-0 max-md:z-40 max-md:flex max-md:flex-col',
        'md:mx-auto md:max-w-3xl md:px-3 md:py-3 lg:px-6 lg:py-6',
      )}
    >
      <div
        data-tour="messages-chat"
        data-testid="messages-conversation"
        className={cn(
          'flex min-w-0 flex-col overflow-hidden bg-card',
          'max-md:h-full max-md:rounded-none max-md:border-0 max-md:shadow-none',
          'md:h-[calc(100vh-8.5rem)] md:rounded-2xl md:border md:shadow-sm',
        )}
      >
        <header className="flex shrink-0 items-center gap-3 border-b px-2 py-3 md:gap-4 md:px-5 md:py-4 lg:px-6 lg:py-5">
          {onBack && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 text-foreground md:hidden"
              onClick={onBack}
              data-testid="messages-back"
            >
              <ChevronLeft className="h-6 w-6" />
              <span className="sr-only">Back</span>
            </Button>
          )}
          <div className="relative">
            <ChatAvatar
              initials={partnerInitials}
              src={partner.avatar_url}
              alt={partner.full_name || ''}
              className="h-12 w-12 text-sm font-semibold sm:h-14 sm:w-14"
            />
            {isPartnerOnline && (
              <span className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {partner.full_name}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              {isPartnerTyping ? (
                <span className="animate-pulse text-primary">typing...</span>
              ) : isPartnerOnline ? (
                <>
                  <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                  <span>Online</span>
                </>
              ) : (
                <span className="capitalize">{partner.role}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {partner.phone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-muted-foreground hover:text-foreground"
                asChild
              >
                <a href={`tel:${partner.phone}`} title={`Call ${partner.full_name}`}>
                  <Phone className="h-5 w-5" />
                  <span className="sr-only">Call {partner.full_name}</span>
                </a>
              </Button>
            )}
            {partner.phone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-muted-foreground hover:text-foreground"
                asChild
              >
                <a href={`facetime:${partner.phone}`} title={`FaceTime ${partner.full_name}`}>
                  <Video className="h-5 w-5" />
                  <span className="sr-only">FaceTime {partner.full_name}</span>
                </a>
              </Button>
            )}
          </div>
        </header>

        <div
          ref={scrollContainerRef}
          className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-8 sm:py-8"
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground">No messages yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Send a message to start the conversation
              </p>
            </div>
          ) : (
            <div className="min-w-0 space-y-8">
              {groupedMessages.map((group) => (
                <div key={group.date}>
                  <div className="my-3 flex items-center gap-4 sm:my-6">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium text-muted-foreground">
                      <GroupDateLabel dateStr={group.date} />
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="space-y-4 sm:space-y-5">
                    {group.messages.map((threadMsg, idx) => {
                      const isOwn = threadMsg.sender_id === profile.id
                      const prevMsg = group.messages[idx - 1]
                      const extraSpace = needsSenderSpacing(threadMsg, prevMsg)

                      return (
                        <div key={threadMsg.id} className={cn(extraSpace && 'pt-2')}>
                          <MessageBubble
                            msg={threadMsg}
                            isOwn={isOwn}
                            senderInitials={isOwn ? ownInitials : partnerInitials}
                            senderAvatar={isOwn ? profile.avatar_url : partner.avatar_url}
                            senderName={isOwn ? profile.full_name : partner.full_name}
                            currentUserId={profile.id}
                            showTimestamp
                            showAvatar
                            onReply={onReply}
                            onEdit={onEdit}
                            onToggleReaction={onToggleReaction}
                            onScrollToMessage={onScrollToMessage}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {isPartnerTyping && (
                <div className="flex items-end gap-3">
                  <ChatAvatar
                    initials={partnerInitials}
                    src={partner.avatar_url}
                    alt={partner.full_name || ''}
                    className="h-9 w-9 text-xs"
                  />
                  <div className="inline-flex h-11 items-center rounded-2xl bg-secondary px-4">
                    <div className="flex items-center gap-1">
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>
          )}
        </div>

        <MessageComposer
          partnerName={partner.full_name}
          value={newMessage}
          onChange={onNewMessageChange}
          onSend={onSend}
          onTyping={onTyping}
          isLoading={isLoading}
          isUploading={isUploading}
          replyTo={replyTo}
          editingMessage={editingMessage}
          onCancelAction={onCancelAction}
          attachmentFiles={attachmentFiles}
          onRemoveAttachment={onRemoveAttachment}
          onAttachClick={onAttachClick}
          onFileSelect={onFileSelect}
          fileInputRef={fileInputRef}
          textareaRef={textareaRef}
          maxAttachments={MAX_MESSAGE_ATTACHMENTS}
          forceEmojiOpen={forceEmojiOpen}
          forceListening={forceListening}
          forceRecording={forceRecording}
          forceTranscribing={forceTranscribing}
          forceError={forceError}
        />
      </div>

      {showTour && <FeatureTour tourId="messages" steps={messagesSteps} />}
    </div>
  )
}
