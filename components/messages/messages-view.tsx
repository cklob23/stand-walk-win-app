'use client'

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Profile, Pairing, Message, MessageReaction } from '@/lib/types'
import { validateMessageAttachments } from '@/lib/message-limits'
import { notifyNewMessage, notifyMessageReaction } from '@/lib/notifications'
import { useBrowserNotifications } from '@/hooks/use-browser-notifications'
import { useRealtimeAuth } from '@/hooks/use-realtime-auth'
import { markNotificationsReadForContext } from '@/lib/notification-actions'
import { MessagesConversation } from './messages-conversation'
import type { AttachmentDraft } from './message-composer'

interface MessagesViewProps {
  profile: Profile
  pairing: Pairing
  partner: Profile
  initialMessages: Message[]
  draftMessage?: string | null
}

export function MessagesView({ profile, pairing, partner, initialMessages, draftMessage }: MessagesViewProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [newMessage, setNewMessage] = useState(draftMessage || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isPartnerOnline, setIsPartnerOnline] = useState(false)
  const [isPartnerTyping, setIsPartnerTyping] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [attachmentFiles, setAttachmentFiles] = useState<AttachmentDraft[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevMessageCountRef = useRef(initialMessages.length)
  const userSentMessageRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sendNotification } = useBrowserNotifications()
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [localDayReady, setLocalDayReady] = useState(false)

  useLayoutEffect(() => {
    setLocalDayReady(true)
  }, [])

  const supabase = createClient()
  const realtimeReady = useRealtimeAuth()

  // Helper: check if user is scrolled near the bottom
  const isNearBottom = () => {
    const el = scrollContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior })
    }
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  // Auto-scroll: always when user sent a message, otherwise only if near bottom and new messages arrived
  useEffect(() => {
    const newCount = messages.length
    const prevCount = prevMessageCountRef.current
    prevMessageCountRef.current = newCount

    if (newCount > prevCount) {
      // User just sent a message -- always scroll to bottom
      if (userSentMessageRef.current) {
        userSentMessageRef.current = false
        requestAnimationFrame(() => scrollToLatest('smooth'))
      } else if (isNearBottom()) {
        // Incoming message from partner -- only scroll if already near bottom
        requestAnimationFrame(() => scrollToLatest('smooth'))
      }
    }
  }, [messages, scrollToLatest])

  // Scroll when typing indicator appears (only if near bottom)
  useEffect(() => {
    if (isPartnerTyping && isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isPartnerTyping])

  // Scroll to bottom on initial mount and when initialMessages changes
  useEffect(() => {
    scrollToLatest('instant')

    const timeoutId = setTimeout(() => scrollToLatest('instant'), 100)
    const timeoutId2 = setTimeout(() => scrollToLatest('instant'), 300)

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(timeoutId2)
    }
  }, [initialMessages.length, scrollToLatest])

  // Channel ref for typing broadcasts
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Broadcast typing status using the ref'd channel
  const handleTyping = useCallback(() => {
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: profile.id }
    })
  }, [profile.id])

  // Mark messages as read when viewing
  useEffect(() => {
    const markAsRead = async () => {
      // Mark all unread messages from partner as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('pairing_id', pairing.id)
        .neq('sender_id', profile.id)
        .eq('is_read', false)
    }
    markAsRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, pairing.id, profile.id])

  // Clear the bell badge after the thread is on screen — must not run during RSC render.
  // Always notify the header (do not skip when marked=0): a Strict Mode remount
  // can mark on the first invocation and return 0 on the second, which used
  // to skip refresh and leave the badge stale until the 15s poll.
  useEffect(() => {
    markNotificationsReadForContext({ pairingId: pairing.id, types: ['message'] }).then((result) => {
      if (result.error) return
      window.dispatchEvent(new CustomEvent('notifications-read', {
        detail: {
          pairingId: pairing.id,
          marked: result.marked ?? 0,
          unreadRemaining: result.unreadRemaining,
          unreadByPairing: result.unreadByPairing,
        },
      }))
      // Do not router.refresh() here. The header listens for the event
      // (unreadRemaining). A refresh of this thread after the server
      // action races learner-switch router.push and can swallow it.
    })
  }, [pairing.id])

  // Subscribe to real-time messages, presence, and typing (gated on auth)
  useEffect(() => {
    if (!realtimeReady) return

    // Messages channel for new messages and updates
    const messagesChannel = supabase
      .channel(`messages:${pairing.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `pairing_id=eq.${pairing.id}`,
        },
        async (payload: any) => {
          // Only add if not our own message (we use optimistic update)
          if (payload.new.sender_id !== profile.id) {
            // Immediately clear typing indicator and cancel any pending timeout
            setIsPartnerTyping(false)
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current)
              typingTimeoutRef.current = null
            }

            const { data: rawMsg } = await supabase
              .from('messages')
              .select(`
                *,
                sender:profiles(id, full_name, avatar_url),
                reactions:message_reactions(id, message_id, user_id, emoji, created_at)
              `)
              .eq('id', payload.new.id)
              .single()

            if (rawMsg) {
              const msg = rawMsg as unknown as Message
              setMessages((prev) => {
                if (prev.some(m => m.id === msg.id)) return prev
                // Hydrate reply_to from existing messages
                if (msg.reply_to_id) {
                  const original = prev.find(m => m.id === msg.reply_to_id)
                  if (original) {
                    msg.reply_to = {
                      id: original.id,
                      content: original.content,
                      sender_id: original.sender_id,
                      sender: original.sender ? { full_name: original.sender.full_name } : null,
                    }
                  }
                }
                return [...prev, msg]
              })
              // Mark as read immediately since we're viewing
              await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('id', msg.id)

              // Send browser push notification if tab is in background
              sendNotification(`New message from ${partner.full_name}`, {
                body: msg.content?.slice(0, 100) || 'Sent you a message',
                tag: `msg-${msg.id}`,
              })
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `pairing_id=eq.${pairing.id}`,
        },
        (payload: any) => {
          // Update message (read status, edit, etc.)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id
                ? { ...m, is_read: payload.new.is_read, content: payload.new.content, edited_at: payload.new.edited_at }
                : m
            )
          )
        }
      )
      .subscribe()

    // Presence channel for online status
    const presenceChannel = supabase
      .channel(`presence:${pairing.id}`)
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const allPresences = Object.values(state).flat() as Array<{ user_id?: string }>
        const partnerOnline = allPresences.some((p) => p.user_id === partner.id)
        setIsPartnerOnline(partnerOnline)
      })
      .on('presence', { event: 'join' }, ({ newPresences }: { newPresences: Array<{ user_id?: string }> }) => {
        if (newPresences.some((p) => p.user_id === partner.id)) {
          setIsPartnerOnline(true)
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: Array<{ user_id?: string }> }) => {
        if (leftPresences.some((p) => p.user_id === partner.id)) {
          setIsPartnerOnline(false)
        }
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: profile.id, online_at: new Date().toISOString() })
        }
      })

    // Typing channel - unique name to avoid conflicts with quick-chat
    const typingChannel = supabase
      .channel(`msg-typing:${pairing.id}`)
      .on('broadcast', { event: 'typing' }, ({ payload }: { payload: { user_id: string } }) => {
        if (payload.user_id === partner.id) {
          setIsPartnerTyping(true)
          // Clear typing indicator after 3 seconds
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
          }
          typingTimeoutRef.current = setTimeout(() => {
            setIsPartnerTyping(false)
          }, 3000)
        }
      })
      .subscribe()

    typingChannelRef.current = typingChannel

    // Reactions channel for real-time reaction updates
    const reactionsChannel = supabase
      .channel(`reactions:${pairing.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newReaction = payload.new as MessageReaction
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== newReaction.message_id) return m
                const reactions = m.reactions || []
                // Skip if already present (from optimistic update) or replace temp version
                const tempIdx = reactions.findIndex(
                  (r) => r.id.startsWith('temp-') && r.user_id === newReaction.user_id && r.emoji === newReaction.emoji
                )
                if (tempIdx >= 0) {
                  const updated = [...reactions]
                  updated[tempIdx] = newReaction
                  return { ...m, reactions: updated }
                }
                // Skip if exact id already exists
                if (reactions.some((r) => r.id === newReaction.id)) return m
                return { ...m, reactions: [...reactions, newReaction] }
              })
            )
          } else if (payload.eventType === 'DELETE') {
            const oldReaction = payload.old as { id: string; message_id: string }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === oldReaction.message_id
                  ? { ...m, reactions: (m.reactions || []).filter((r) => r.id !== oldReaction.id) }
                  : m
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(presenceChannel)
      supabase.removeChannel(typingChannel)
      supabase.removeChannel(reactionsChannel)
      typingChannelRef.current = null
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairing.id, partner.id, profile.id, realtimeReady])

  // Polling fallback: fetch latest messages every 10s in case realtime drops
  useEffect(() => {
    let pollErrors = 0

    const poll = async () => {
      const { data: rawData, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(id, full_name, avatar_url),
          reactions:message_reactions(id, message_id, user_id, emoji, created_at)
        `)
        .eq('pairing_id', pairing.id)
        .order('created_at', { ascending: true })

      if (error) {
        pollErrors++
        if (pollErrors >= 3) {
          clearInterval(interval)
        }
        return
      }

      pollErrors = 0

      if (rawData) {
        const data = rawData as unknown as Message[]
        // Hydrate reply_to from the fetched messages array
        const messagesById = new Map(data.map(m => [m.id, m]))
        for (const msg of data) {
          if (msg.reply_to_id) {
            const original = messagesById.get(msg.reply_to_id)
            if (original) {
              msg.reply_to = {
                id: original.id,
                content: original.content,
                sender_id: original.sender_id,
                sender: original.sender ? { full_name: original.sender.full_name } : null,
              }
            }
          }
        }

        setMessages(prev => {
          const hasChanges = prev.length !== data.length ||
            prev.some((m, i) => m.id !== data[i]?.id || m.is_read !== data[i]?.is_read)
          if (!hasChanges) return prev
          return data
        })
      }
    }

    const interval = setInterval(poll, 10000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairing.id])

  // Upload attachment to Supabase Storage
  const uploadAttachment = async (file: File): Promise<{ url: string; type: 'image' | 'file' } | null> => {
    const isImage = file.type.startsWith('image/')
    const ext = file.name.split('.').pop() || 'bin'
    const path = `messages/${pairing.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await supabase.storage
      .from('message-attachments')
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (error) {
      // If bucket doesn't exist, try to create it
      toast.error('Failed to upload file')
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('message-attachments')
      .getPublicUrl(path)

    return { url: publicUrl, type: isImage ? 'image' : 'file' }
  }

  const handleSend = async () => {
    if (!newMessage.trim() && attachmentFiles.length === 0) return

    // If editing, update the existing message
    if (editingMessage) {
      const content = newMessage.trim()
      if (!content) return

      setMessages((prev) =>
        prev.map((m) => m.id === editingMessage.id ? { ...m, content, edited_at: new Date().toISOString() } : m)
      )
      setEditingMessage(null)
      setNewMessage('')

      const { error } = await supabase
        .from('messages')
        .update({ content, edited_at: new Date().toISOString() })
        .eq('id', editingMessage.id)
        .eq('sender_id', profile.id)

      if (error) {
        toast.error('Failed to edit message')
        setMessages((prev) =>
          prev.map((m) => m.id === editingMessage.id ? editingMessage : m)
        )
      }
      return
    }

    const messageContent = newMessage.trim()
    const filesToSend = [...attachmentFiles]

    // Flag so auto-scroll fires regardless of scroll position
    userSentMessageRef.current = true

    // Clear inputs immediately
    setNewMessage('')
    setReplyTo(null)
    setAttachmentFiles([])
    setIsPartnerTyping(false)
    setIsLoading(true)

    // Helper to send a single message with optional attachment
    const sendSingle = async (
      content: string,
      replyId: string | null,
      file: File | null,
      linkUrl: string | null,
    ) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`

      let attachmentUrl: string | undefined
      let attachmentType: 'image' | 'file' | 'link' | undefined

      if (file) {
        setIsUploading(true)
        const result = await uploadAttachment(file)
        setIsUploading(false)
        if (result) {
          attachmentUrl = result.url
          attachmentType = result.type
        }
      } else if (linkUrl) {
        attachmentUrl = linkUrl
        attachmentType = 'link'
      }

      const optimisticMessage: Message = {
        id: tempId,
        pairing_id: pairing.id,
        sender_id: profile.id,
        content,
        created_at: new Date().toISOString(),
        is_read: false,
        reply_to_id: replyId,
        attachment_url: attachmentUrl || null,
        attachment_type: attachmentType || null,
        sender: { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url },
        reply_to: replyId && replyTo ? {
          id: replyTo.id, content: replyTo.content, sender_id: replyTo.sender_id,
          sender: replyTo.sender ? { full_name: replyTo.sender.full_name } : null
        } : null,
        reactions: []
      }

      setMessages((prev) => [...prev, optimisticMessage])
      requestAnimationFrame(() => scrollToLatest('smooth'))

      const insertPayload: Record<string, unknown> = {
        pairing_id: pairing.id, sender_id: profile.id, content,
      }
      if (replyId) insertPayload.reply_to_id = replyId
      if (attachmentUrl) insertPayload.attachment_url = attachmentUrl
      if (attachmentType) insertPayload.attachment_type = attachmentType

      const { data, error } = await supabase.from('messages').insert(insertPayload).select().single()

      if (error) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        toast.error('Failed to send message')
        return
      }

      setMessages((prev) =>
        prev.map((m) => m.id === tempId ? { ...optimisticMessage, id: data.id } : m)
      )
    }

    // Detect link in message text
    let linkUrl: string | null = null
    if (filesToSend.length === 0 && messageContent) {
      const urlMatch = messageContent.match(/https?:\/\/[^\s]+/)
      if (urlMatch) linkUrl = urlMatch[0]
    }

    // Send first message with text + first attachment (or link)
    const firstFile = filesToSend.length > 0 ? filesToSend[0].file : null
    await sendSingle(messageContent, replyTo?.id || null, firstFile, linkUrl)

    // Send remaining attachments as individual follow-up messages
    for (let i = 1; i < filesToSend.length; i++) {
      await sendSingle('', null, filesToSend[i].file, null)
    }

    notifyNewMessage(
      partner.id,
      profile.full_name || 'Your partner',
      pairing.id,
      messageContent
    ).catch(() => { })

    setIsLoading(false)
  }

  // Toggle a reaction on a message
  const handleToggleReaction = async (messageId: string, emoji: MessageReaction['emoji']) => {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg) return

    const existingReaction = (msg.reactions || []).find(
      (r) => r.user_id === profile.id && r.emoji === emoji
    )

    if (existingReaction) {
      // Remove reaction optimistically
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, reactions: (m.reactions || []).filter((r) => r.id !== existingReaction.id) }
            : m
        )
      )
      await supabase.from('message_reactions').delete().eq('id', existingReaction.id)
    } else {
      // Add reaction optimistically
      const tempReaction: MessageReaction = {
        id: `temp-${Date.now()}`,
        message_id: messageId,
        user_id: profile.id,
        emoji,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, reactions: [...(m.reactions || []), tempReaction] }
            : m
        )
      )
      const { data } = await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, user_id: profile.id, emoji })
        .select()
        .single()

      if (data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, reactions: (m.reactions || []).map((r) => r.id === tempReaction.id ? data : r) }
              : m
          )
        )

        // Notify the message author (only if it's the partner's message)
        if (msg.sender_id === partner.id) {
          notifyMessageReaction(
            partner.id,
            profile.full_name || 'Your partner',
            pairing.id,
            emoji,
            msg.content
          ).catch(() => { })
        }
      }
    }
  }

  // Reply to a message
  const handleReply = (msg: Message) => {
    setReplyTo(msg)
    setEditingMessage(null)
    textareaRef.current?.focus()
  }

  // Edit a message
  const handleEdit = (msg: Message) => {
    setEditingMessage(msg)
    setNewMessage(msg.content)
    setReplyTo(null)
    textareaRef.current?.focus()
  }

  // Cancel reply or edit
  const handleCancelAction = () => {
    setReplyTo(null)
    setEditingMessage(null)
    if (editingMessage) setNewMessage('')
  }

  // Handle file selection (multiple)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const { accepted, errors } = validateMessageAttachments(attachmentFiles.length, Array.from(files))
    for (const error of errors) toast.error(error)

    for (const file of accepted) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => {
          setAttachmentFiles((prev) => [...prev, { file, preview: reader.result as string }])
        }
        reader.readAsDataURL(file)
      } else {
        setAttachmentFiles((prev) => [...prev, { file, preview: null }])
      }
    }

    e.target.value = ''
  }

  // Remove a single attachment by index
  const removeAttachment = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Scroll to a specific message (for reply tap)
  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bg-primary/5')
      setTimeout(() => el.classList.remove('bg-primary/5'), 1500)
    }
  }

  return (
    <MessagesConversation
      profile={profile}
      partner={partner}
      messages={messages}
      newMessage={newMessage}
      onNewMessageChange={setNewMessage}
      onSend={handleSend}
      onTyping={handleTyping}
      isLoading={isLoading}
      isUploading={isUploading}
      isPartnerOnline={isPartnerOnline}
      isPartnerTyping={isPartnerTyping}
      replyTo={replyTo}
      editingMessage={editingMessage}
      onReply={handleReply}
      onEdit={handleEdit}
      onCancelAction={handleCancelAction}
      onToggleReaction={handleToggleReaction}
      onScrollToMessage={scrollToMessage}
      attachmentFiles={attachmentFiles}
      onFileSelect={handleFileSelect}
      onRemoveAttachment={removeAttachment}
      onAttachClick={() => fileInputRef.current?.click()}
      fileInputRef={fileInputRef}
      textareaRef={textareaRef}
      messagesEndRef={messagesEndRef}
      scrollContainerRef={scrollContainerRef}
      localDayReady={localDayReady}
    />
  )
}
