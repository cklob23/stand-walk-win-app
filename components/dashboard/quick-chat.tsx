'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Send, Loader2, Check, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { Message } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

interface QuickChatProps {
  pairingId: string
  odUserId: string
  partnerId: string
  recentMessages: Message[]
  partnerName: string
  partnerAvatar?: string | null
}

export function QuickChat({ pairingId, odUserId, partnerId, recentMessages, partnerName, partnerAvatar }: QuickChatProps) {
  const router = useRouter()
  const [messages, setMessages] = useState(recentMessages)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPartnerTyping, setIsPartnerTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const userId = odUserId; // Declare userId variable

  const supabase = createClient()

  // Broadcast typing status
  const broadcastTyping = useCallback(() => {
    supabase.channel(`typing:${pairingId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: odUserId }
    })
  }, [supabase, pairingId, odUserId])

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    broadcastTyping()
  }, [broadcastTyping])

  // Subscribe to real-time messages and typing
  useEffect(() => {
    // Messages channel
    const messagesChannel = supabase
      .channel(`quick-messages:${pairingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `pairing_id=eq.${pairingId}`,
        },
        async (payload) => {
          if (payload.new.sender_id !== odUserId) {
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
                if (prev.some(m => m.id === data.id)) return prev
                return [...prev, data].slice(-3) // Keep only last 3
              })
            }
          }
          setIsPartnerTyping(false)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `pairing_id=eq.${pairingId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? { ...m, is_read: payload.new.is_read } : m
            )
          )
        }
      )
      .subscribe()

    // Typing channel
    const typingChannel = supabase
      .channel(`typing:${pairingId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === partnerId) {
          setIsPartnerTyping(true)
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
      supabase.removeChannel(typingChannel)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [pairingId, partnerId, odUserId, supabase])

  const handleSend = async () => {
    if (!message.trim()) return

    const messageContent = message.trim()
    const tempId = `temp-${Date.now()}`
    
    // Optimistic update
    const optimisticMessage: Message = {
      id: tempId,
      pairing_id: pairingId,
      sender_id: odUserId,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false,
      sender: null
    }
    
    setMessages((prev) => [...prev, optimisticMessage].slice(-3))
    setMessage('')
    setIsLoading(true)

    const { data, error } = await supabase
      .from('messages')
      .insert({
        pairing_id: pairingId,
        sender_id: odUserId,
        content: messageContent,
      })
      .select()
      .single()

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setMessage(messageContent)
      toast.error('Failed to send message')
      setIsLoading(false)
      return
    }

    // Replace temp message with real one
    setMessages((prev) => 
      prev.map((m) => m.id === tempId ? { ...optimisticMessage, id: data.id } : m)
    )

    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      {/* Recent Messages Preview */}
      {messages.length > 0 && (
        <div className="space-y-3 max-h-48 overflow-y-auto">
          {messages.slice(-3).map((msg) => {
            const isOwn = msg.sender_id === odUserId
            const senderInitials = msg.sender?.full_name
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase() || '?'

            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={msg.sender?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {senderInitials}
                  </AvatarFallback>
                </Avatar>
                <div className={`flex-1 min-w-0 ${isOwn ? 'text-right' : ''}`}>
                  <div
                    className={`inline-block rounded-lg px-3 py-2 text-sm max-w-full ${
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="break-words">{msg.content}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                    <span>{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                    {isOwn && (
                      msg.is_read ? (
                        <CheckCheck className="h-3 w-3 text-primary" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )
                    )}
                  </p>
                </div>
              </div>
            )
          })}
          
          {/* Typing Indicator */}
          {isPartnerTyping && (
            <div className="flex gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={partnerAvatar || undefined} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {partnerName?.split(' ').map((n) => n[0]).join('').toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="inline-block rounded-lg bg-muted px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {messages.length === 0 && !isPartnerTyping && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            No messages yet. Send a message to {partnerName}!
          </p>
        </div>
      )}

      {/* Message Input */}
      <div className="flex gap-2">
        <Textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            if (e.target.value.trim()) {
              handleTyping()
            }
          }}
          placeholder={`Message ${partnerName}...`}
          className="min-h-[60px] sm:min-h-[80px] resize-none text-base"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <Button 
          onClick={handleSend} 
          disabled={isLoading || !message.trim()}
          size="icon"
          className="h-auto"
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
  )
}
