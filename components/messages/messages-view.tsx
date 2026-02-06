'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Send, Loader2, MessageSquare, Circle, Check, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile, Pairing, Message } from '@/lib/types'
import { format, isToday, isYesterday } from 'date-fns'
import { notifyNewMessage } from '@/lib/notifications'
import { useBrowserNotifications } from '@/hooks/use-browser-notifications'

interface MessagesViewProps {
  profile: Profile
  pairing: Pairing
  partner: Profile
  initialMessages: Message[]
}

export function MessagesView({ profile, pairing, partner, initialMessages }: MessagesViewProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPartnerOnline, setIsPartnerOnline] = useState(false)
  const [isPartnerTyping, setIsPartnerTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { sendNotification } = useBrowserNotifications()
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const supabase = createClient()

  // Scroll to bottom when messages change or typing indicator appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isPartnerTyping])

  // Broadcast typing status
  const broadcastTyping = useCallback(() => {
    supabase.channel(`typing:${pairing.id}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: profile.id }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairing.id, profile.id])

  // Handle typing indicator with debounce
  const handleTyping = useCallback(() => {
    broadcastTyping()
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }, [broadcastTyping])

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

  // Subscribe to real-time messages, presence, and typing
  useEffect(() => {
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
        async (payload) => {
          // Only add if not our own message (we use optimistic update)
          if (payload.new.sender_id !== profile.id) {
            // Immediately clear typing indicator and cancel any pending timeout
            setIsPartnerTyping(false)
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current)
              typingTimeoutRef.current = null
            }

            const { data } = await supabase
              .from('messages')
              .select(`
                *,
                sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)
              `)
              .eq('id', payload.new.id)
              .single()

            if (data) {
              setMessages((prev) => {
                // Check if message already exists
                if (prev.some(m => m.id === data.id)) return prev
                return [...prev, data]
              })
              // Mark as read immediately since we're viewing
              await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('id', data.id)

              // Send browser push notification if tab is in background
              sendNotification(`New message from ${partner.full_name}`, {
                body: data.content?.slice(0, 100) || 'Sent you a message',
                tag: `msg-${data.id}`,
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
        (payload) => {
          // Update message read status
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? { ...m, is_read: payload.new.is_read } : m
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
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const presences = newPresences as Array<{ user_id?: string }>
        if (presences.some((p) => p.user_id === partner.id)) {
          setIsPartnerOnline(true)
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const presences = leftPresences as Array<{ user_id?: string }>
        if (presences.some((p) => p.user_id === partner.id)) {
          setIsPartnerOnline(false)
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: profile.id, online_at: new Date().toISOString() })
        }
      })

    // Typing channel
    const typingChannel = supabase
      .channel(`typing:${pairing.id}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
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

    return () => {
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(presenceChannel)
      supabase.removeChannel(typingChannel)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairing.id, partner.id, profile.id])

  const handleSend = async () => {
    if (!newMessage.trim()) return

    const messageContent = newMessage.trim()
    const tempId = `temp-${Date.now()}`
    
    // Optimistic update - add message immediately
    const optimisticMessage: Message = {
      id: tempId,
      pairing_id: pairing.id,
      sender_id: profile.id,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false,
      sender: {
        id: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url
      }
    }
    
    setMessages((prev) => [...prev, optimisticMessage])
    setNewMessage('')
    setIsPartnerTyping(false)
    setIsLoading(true)

    const { data, error } = await supabase
      .from('messages')
      .insert({
        pairing_id: pairing.id,
        sender_id: profile.id,
        content: messageContent,
      })
      .select()
      .single()

    if (error) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setNewMessage(messageContent)
      toast.error('Failed to send message')
      setIsLoading(false)
      return
    }

    // Replace temp message with real one
    setMessages((prev) => 
      prev.map((m) => m.id === tempId ? { ...optimisticMessage, id: data.id } : m)
    )

    // Send notification to partner (don't await to keep UI responsive)
    notifyNewMessage(
      partner.id,
      profile.full_name || 'Your partner',
      pairing.id,
      messageContent
    )

    setIsLoading(false)
  }

  const formatMessageDate = (date: string) => {
    const d = new Date(date)
    if (isToday(d)) return format(d, 'h:mm a')
    if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`
    return format(d, 'MMM d, h:mm a')
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
    const d = new Date(dateStr)
    if (isToday(d)) return 'Today'
    if (isYesterday(d)) return 'Yesterday'
    return format(d, 'EEEE, MMMM d')
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:py-6">
      <Card className="h-[calc(100vh-10rem)] sm:h-[calc(100vh-12rem)] flex flex-col">
        {/* Header */}
        <CardHeader className="border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={partner.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {partnerInitials}
                </AvatarFallback>
              </Avatar>
              {isPartnerOnline && (
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
              )}
            </div>
            <div>
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
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4">
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
                  <div className="space-y-4">
                    {group.messages.map((msg) => {
                      const isOwn = msg.sender_id === profile.id
                      const senderInitials = isOwn ? profileInitials : partnerInitials
                      const senderAvatar = isOwn ? profile.avatar_url : partner.avatar_url

                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={senderAvatar || undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {senderInitials}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`flex-1 max-w-[85%] sm:max-w-[75%] ${isOwn ? 'text-right' : 'text-left'}`}>
                            <div
                              className={`inline-block rounded-2xl px-4 py-2 ${
                                isOwn
                                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                  : 'bg-muted text-foreground rounded-tl-sm'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            <p className={`text-xs text-muted-foreground mt-1 flex items-center gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              <span>{formatMessageDate(msg.created_at)}</span>
                              {isOwn && (
                                msg.is_read ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )
                              )}
                            </p>
                          </div>
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
                    <AvatarImage src={partner.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
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
        <div className="border-t p-3 sm:p-4 shrink-0">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value)
                if (e.target.value.trim()) {
                  handleTyping()
                }
              }}
              placeholder={`Message ${partner.full_name}...`}
              className="min-h-[30px] sm:min-h-[40px] max-h-[100px] sm:max-h-[120px] resize-none text-base"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <Button 
              onClick={handleSend} 
              disabled={isLoading || !newMessage.trim()}
              size="icon"
              className="h-auto aspect-square"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
