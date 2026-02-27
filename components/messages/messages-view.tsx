'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FeatureTour } from '@/components/onboarding/feature-tour'
import { messagesSteps } from '@/lib/tour-steps'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Send, Loader2, MessageSquare, Circle, Phone, Video, Paperclip, X, CornerUpLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile, Pairing, Message, MessageReaction } from '@/lib/types'
import { format, isToday, isYesterday } from 'date-fns'
import { MessageBubble, getFileIcon } from './message-bubble'
import { notifyNewMessage, notifyMessageReaction } from '@/lib/notifications'
import { useBrowserNotifications } from '@/hooks/use-browser-notifications'
import { useRealtimeAuth } from '@/hooks/use-realtime-auth'

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
  const [attachmentFiles, setAttachmentFiles] = useState<{ file: File; preview: string | null }[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const MAX_ATTACHMENTS = 5
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevMessageCountRef = useRef(initialMessages.length)
  const userSentMessageRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sendNotification } = useBrowserNotifications()
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const supabase = createClient()
  const realtimeReady = useRealtimeAuth()

  // Helper: check if user is scrolled near the bottom
  const isNearBottom = () => {
    const el = scrollContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }

  // Auto-scroll: always when user sent a message, otherwise only if near bottom and new messages arrived
  useEffect(() => {
    const newCount = messages.length
    const prevCount = prevMessageCountRef.current
    prevMessageCountRef.current = newCount

    if (newCount > prevCount) {
      // User just sent a message -- always scroll to bottom
      if (userSentMessageRef.current) {
        userSentMessageRef.current = false
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      } else if (isNearBottom()) {
        // Incoming message from partner -- only scroll if already near bottom
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  // Scroll when typing indicator appears (only if near bottom)
  useEffect(() => {
    if (isPartnerTyping && isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isPartnerTyping])

  // Scroll to bottom on initial mount
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [])

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

    const remaining = MAX_ATTACHMENTS - attachmentFiles.length
    if (remaining <= 0) {
      toast.error(`You can only attach up to ${MAX_ATTACHMENTS} files per message`)
      e.target.value = ''
      return
    }

    const filesToAdd = Array.from(files).slice(0, remaining)
    if (files.length > remaining) {
      toast.error(`You can only attach up to ${MAX_ATTACHMENTS} files per message. ${files.length - remaining} file(s) were not added.`)
    }

    for (const file of filesToAdd) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds the 10 MB file size limit`)
        continue
      }

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

  const partnerInitials = partner.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '?'

  const profileInitials = profile.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '?'

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = []
  let currentDate = ''

  messages.forEach((msg) => {
    const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd')
    if (msgDate !== currentDate) {
      currentDate = msgDate
      groupedMessages.push({ date: msgDate, messages: [msg] })
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg)
    }
  })

  const formatGroupDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    if (isToday(d)) return 'Today'
    if (isYesterday(d)) return 'Yesterday'
    // Within the last week, show day name
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 7) return format(d, 'EEEE')
    return format(d, 'EEEE, MMMM d')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:py-6">
      <Card data-tour="messages-chat" className="h-[calc(100vh-10rem)] sm:h-[calc(100vh-12rem)] flex flex-col">
        {/* Header */}
        <CardHeader className="border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-10 w-10">
                {partner.avatar_url && partner.avatar_url.length > 0 ? <AvatarImage src={partner.avatar_url} alt={partner.full_name!} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary" delayMs={0}>
                  {partnerInitials}
                </AvatarFallback>
              </Avatar>
              {isPartnerOnline && (
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base">{partner.full_name}</CardTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                {isPartnerTyping ? (
                  <span className="text-primary animate-pulse">typing...</span>
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
            {/* Call & FaceTime buttons */}
            <div className="flex items-center gap-1">
              {partner.phone && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 text-muted-foreground hover:text-primary"
                  asChild
                >
                  <a href={`tel:${partner.phone}`} title={`Call ${partner.full_name}`}>
                    <Phone className="h-6 w-6" />
                    <span className="sr-only">Call {partner.full_name}</span>
                  </a>
                </Button>
              )}
              {partner.phone && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 text-muted-foreground hover:text-primary"
                  asChild
                >
                  <a href={`facetime:${partner.phone}`} title={`FaceTime ${partner.full_name}`}>
                    <Video className="h-6 w-6" />
                    <span className="sr-only">FaceTime {partner.full_name}</span>
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground">No messages yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Send a message to start the conversation
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedMessages.map((group) => (
                <div key={group.date}>
                  {/* Date Separator */}
                  <div className="flex items-center gap-4 my-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground font-medium">
                      {formatGroupDate(group.date)}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Messages */}
                  <div className="space-y-0.5">
                    {group.messages.map((msg, idx) => {
                      const isOwn = msg.sender_id === profile.id
                      const prevMsg = group.messages[idx - 1]
                      const nextMsg = group.messages[idx + 1]

                      // Show timestamp if: last message, next message is from different sender,
                      // or more than 5 minutes gap to next message
                      const isLastInGroup = !nextMsg
                      const senderChanges = nextMsg && nextMsg.sender_id !== msg.sender_id
                      const timeDiff = nextMsg
                        ? new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime()
                        : Infinity
                      const bigTimeGap = timeDiff > 5 * 60 * 1000 // 5 minutes
                      const showTimestamp = isLastInGroup || senderChanges || bigTimeGap

                      // Show avatar only on last consecutive message from same sender
                      const nextIsSameSender = nextMsg && nextMsg.sender_id === msg.sender_id && !bigTimeGap
                      const showAvatar = !nextIsSameSender

                      // Add extra spacing when sender changes or time gap
                      const needsSpacing = prevMsg && (prevMsg.sender_id !== msg.sender_id ||
                        (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000))

                      return (
                        <div key={msg.id} className={cn(needsSpacing && 'pt-3')}>
                          <MessageBubble
                            msg={msg}
                            isOwn={isOwn}
                            senderInitials={isOwn ? profileInitials : partnerInitials}
                            senderAvatar={isOwn ? profile.avatar_url : partner.avatar_url}
                            senderName={isOwn ? profile.full_name : partner.full_name}
                            currentUserId={profile.id}
                            showTimestamp={showTimestamp}
                            showAvatar={showAvatar}
                            onReply={handleReply}
                            onEdit={handleEdit}
                            onToggleReaction={handleToggleReaction}
                            onScrollToMessage={scrollToMessage}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {/* Typing Indicator */}
              {isPartnerTyping && (
                <div className="flex items-end gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    {partner.avatar_url && partner.avatar_url.length > 0 ? <AvatarImage src={partner.avatar_url} alt={partner.full_name!} /> : null}
                    <AvatarFallback className="text-xs bg-primary/10 text-primary" delayMs={0}>
                      {partnerInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="inline-flex items-center rounded-2xl rounded-tl-sm bg-muted px-4 h-10">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </CardContent>

        {/* Input */}
        <div data-tour="messages-input" className="border-t shrink-0">
          {/* Reply / Edit bar */}
          {(replyTo || editingMessage) && (
            <div className="flex items-center gap-2 px-3 sm:px-4 pt-2 pb-1">
              <div className="flex-1 min-w-0 flex items-center gap-2 text-xs text-muted-foreground">
                {replyTo && (
                  <>
                    <CornerUpLeft className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">
                      Replying to <span className="font-medium text-foreground">{replyTo.sender?.full_name || 'message'}</span>
                      {': '}{replyTo.content?.slice(0, 50)}{(replyTo.content?.length || 0) > 50 ? '...' : ''}
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
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCancelAction}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Attachment previews */}
          {attachmentFiles.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 pt-2 pb-1">
              {attachmentFiles.map((att, idx) => {
                const FileIcon = getFileIcon(att.file.name)
                return (
                  <div key={idx} className="relative group">
                    {att.preview ? (
                      <img src={att.preview} alt={att.file.name} className="h-16 w-16 object-cover rounded-lg border" />
                    ) : (
                      <div className="h-12 flex items-center gap-2 px-3 rounded-lg border bg-muted text-sm">
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[140px]">{att.file.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
              <span className="text-xs text-muted-foreground">
                {attachmentFiles.length}/{MAX_ATTACHMENTS}
              </span>
            </div>
          )}

          <div className="flex gap-2 items-end p-3 sm:p-4 pt-2">
            {/* Attachment button */}
            {!editingMessage && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.mp3,.mp4,.mov"
                  onChange={handleFileSelect}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
              </>
            )}

            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value)
                if (e.target.value.trim()) {
                  handleTyping()
                }
              }}
              placeholder={editingMessage ? 'Edit your message...' : `Message ${partner.full_name}...`}
              className="min-h-[50px] sm:min-h-[60px] max-h-[100px] sm:max-h-[120px] resize-none text-base"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
                if (e.key === 'Escape') {
                  handleCancelAction()
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || isUploading || (!newMessage.trim() && attachmentFiles.length === 0)}
              size="icon"
              className="h-10 w-10 shrink-0"
            >
              {isLoading || isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingMessage ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">{editingMessage ? 'Save edit' : 'Send message'}</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Onboarding Tour */}
      <FeatureTour tourId="messages" steps={messagesSteps} />
    </div>
  )
}
