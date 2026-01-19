'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Message } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

interface QuickChatProps {
  pairingId: string
  userId: string
  recentMessages: Message[]
  partnerName: string
}

export function QuickChat({ pairingId, userId, recentMessages, partnerName }: QuickChatProps) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const supabase = createClient()

  const handleSend = async () => {
    if (!message.trim()) return

    setIsLoading(true)

    const { error } = await supabase
      .from('messages')
      .insert({
        pairing_id: pairingId,
        sender_id: userId,
        content: message.trim(),
      })

    if (error) {
      toast.error('Failed to send message')
      setIsLoading(false)
      return
    }

    setMessage('')
    setIsLoading(false)
    router.refresh()
    toast.success('Message sent!')
  }

  return (
    <div className="space-y-4">
      {/* Recent Messages Preview */}
      {recentMessages.length > 0 && (
        <div className="space-y-3 max-h-48 overflow-y-auto">
          {recentMessages.slice(-3).map((msg) => {
            const isOwn = msg.sender_id === userId
            const senderInitials = msg.sender?.full_name
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase() || '?'

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={msg.sender?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {senderInitials}
                  </AvatarFallback>
                </Avatar>
                <div className={`flex-1 ${isOwn ? 'text-right' : ''}`}>
                  <div
                    className={`inline-block rounded-lg px-3 py-2 text-sm ${
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {recentMessages.length === 0 && (
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
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Message ${partnerName}...`}
          className="min-h-[80px] resize-none"
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
