'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Send, Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile, Pairing, Message } from '@/lib/types'
import { format, isToday, isYesterday } from 'date-fns'
import { notifyNewMessage } from '@/lib/notifications'

interface MessagesViewProps {
  profile: Profile
  pairing: Pairing
  partner: Profile
  initialMessages: Message[]
}

export function MessagesView({ profile, pairing, partner, initialMessages }: MessagesViewProps) {
  const router = useRouter()
  const [messages, setMessages] = useState(initialMessages)
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Subscribe to real-time messages
  useEffect(() => {
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `pairing_id=eq.${pairing.id}`,
        },
        async (payload) => {
          // Fetch the full message with sender info
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setMessages((prev) => [...prev, data])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pairing.id, supabase])

  const handleSend = async () => {
    if (!newMessage.trim()) return

    setIsLoading(true)

    const { error } = await supabase
      .from('messages')
      .insert({
        pairing_id: pairing.id,
        sender_id: profile.id,
        content: newMessage.trim(),
      })

    if (error) {
      toast.error('Failed to send message')
      setIsLoading(false)
      return
    }

    // Send notification to partner
    await notifyNewMessage(
      partner.id,
      profile.full_name || 'Your partner',
      pairing.id,
      newMessage.trim()
    )

    setNewMessage('')
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
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Card className="h-[calc(100vh-12rem)] flex flex-col">
        {/* Header */}
        <CardHeader className="border-b shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={partner.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {partnerInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{partner.full_name}</CardTitle>
              <p className="text-sm text-muted-foreground capitalize">{partner.role}</p>
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
                          <div className={`flex-1 max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
                            <div
                              className={`inline-block rounded-2xl px-4 py-2 ${
                                isOwn
                                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                  : 'bg-muted text-foreground rounded-tl-sm'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatMessageDate(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </CardContent>

        {/* Input */}
        <div className="border-t p-4 shrink-0">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message ${partner.full_name}...`}
              className="min-h-[60px] max-h-[120px] resize-none"
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
