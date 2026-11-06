'use client'

import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Bell, BookMarked, Calendar, LayoutDashboard, Menu, MessageSquare, PenLine, ScrollText } from 'lucide-react'
import { toast } from 'sonner'
import { AppLogo } from '@/components/app-logo'
import { BrandingProvider } from '@/contexts/branding-context'
import { ThemeToggle } from '@/components/theme-toggle'
import { ChatAvatar } from '@/components/messages/message-bubble'
import { MessagesConversation } from '@/components/messages/messages-conversation'
import type { AttachmentDraft } from '@/components/messages/message-composer'
import { validateMessageAttachments } from '@/lib/message-limits'
import { DEFAULT_ORG_BRANDING } from '@/lib/org-branding'
import type { Message, MessageReaction, Profile } from '@/lib/types'
import { cn } from '@/lib/utils'

const LEARNER_ID = 'preview-sarah'
const LEADER_ID = 'preview-david'
const PAIRING_ID = 'preview-pairing'

function atLocalTime(daysAgo: number, hours: number, minutes: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hours, minutes, 0, 0)
  return d.toISOString()
}

const sarah: Profile = {
  id: LEARNER_ID,
  email: 'sarah@example.com',
  full_name: 'Sarah Mitchell',
  role: 'learner',
  avatar_url: null,
  bio: null,
  phone: null,
  zoom_link: null,
  onboarding_complete: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const david: Profile = {
  id: LEADER_ID,
  email: 'david@example.com',
  full_name: 'David Carter',
  role: 'leader',
  avatar_url: null,
  bio: null,
  phone: '555-0100',
  zoom_link: null,
  onboarding_complete: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

function mockMessages(): Message[] {
  const yesterdayPray: Message = {
    id: 'msg-1',
    pairing_id: PAIRING_ID,
    sender_id: LEADER_ID,
    content: 'Love that. Ephesians 6:10 is one of my favorites. I am praying for you today.',
    is_read: true,
    created_at: atLocalTime(1, 8, 46),
    sender: { id: LEADER_ID, full_name: david.full_name, avatar_url: null },
    reactions: [],
  }
  const standPlan: Message = {
    id: 'msg-2',
    pairing_id: PAIRING_ID,
    sender_id: LEARNER_ID,
    content: 'Thank you! Can we talk Thursday about my stand plan?',
    is_read: true,
    created_at: atLocalTime(1, 12, 5),
    sender: { id: LEARNER_ID, full_name: sarah.full_name, avatar_url: null },
    reactions: [],
  }
  const booked: Message = {
    id: 'msg-3',
    pairing_id: PAIRING_ID,
    sender_id: LEADER_ID,
    content: 'Absolutely. I booked us for Thursday at 7 PM on Zoom. See you then!',
    is_read: true,
    created_at: atLocalTime(1, 12, 20),
    sender: { id: LEADER_ID, full_name: david.full_name, avatar_url: null },
    reactions: [],
  }
  const seeYou: Message = {
    id: 'msg-4',
    pairing_id: PAIRING_ID,
    sender_id: LEARNER_ID,
    content: 'Perfect, see you then 🙏',
    is_read: true,
    created_at: atLocalTime(0, 7, 30),
    sender: { id: LEARNER_ID, full_name: sarah.full_name, avatar_url: null },
    reactions: [
      {
        id: 'rxn-1',
        message_id: 'msg-4',
        user_id: LEADER_ID,
        emoji: 'pray',
        created_at: atLocalTime(0, 7, 31),
      },
    ],
  }
  return [yesterdayPray, standPlan, booked, seeYou]
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/bible', label: 'Bible', icon: BookMarked },
  { href: '/dashboard/journal', label: 'Journal', icon: PenLine },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/dashboard/covenant', label: 'Covenant', icon: ScrollText },
]

function PreviewChrome({ mobile }: { mobile: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <AppLogo
            showText={!mobile}
            showSubtitle={false}
            textClassName="text-sm lg:text-base"
            iconClassName={mobile ? 'h-10 w-10 rounded-sm' : undefined}
          />
          {!mobile && (
            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => {
                const isActive = item.href === '/dashboard/messages'
                return (
                  <span
                    key={item.href}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </span>
                )
              })}
            </nav>
          )}
          <div className="flex items-center gap-2">
            {!mobile && <ThemeToggle />}
            <span className="relative inline-flex h-9 w-9 items-center justify-center">
              <Bell className="h-5 w-5 text-foreground" />
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                1
              </span>
            </span>
            <ChatAvatar initials="SM" alt="Sarah Mitchell" className="h-9 w-9 text-xs" />
            {mobile && (
              <span className="inline-flex h-9 w-9 items-center justify-center">
                <Menu className="h-5 w-5" />
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function PreviewInner() {
  const params = useSearchParams()
  const { setTheme } = useTheme()
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light'
  const mobile = params.get('mobile') === '1'
  const empty = params.get('empty') === '1'
  const typing = params.get('typing') === '1'
  const draft = params.get('draft') || ''
  const autosend = params.get('autosend') === '1'

  const [messages, setMessages] = useState<Message[]>(() => {
    if (empty) return []
    const thread = mockMessages()
    if (autosend && draft) {
      thread.push({
        id: 'msg-preview-sent',
        pairing_id: PAIRING_ID,
        sender_id: LEARNER_ID,
        content: draft,
        is_read: false,
        created_at: new Date().toISOString(),
        sender: { id: LEARNER_ID, full_name: sarah.full_name, avatar_url: null },
        reactions: [],
      })
    }
    return thread
  })
  const [newMessage, setNewMessage] = useState(autosend ? '' : draft)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [attachmentFiles, setAttachmentFiles] = useState<AttachmentDraft[]>([])
  const [localDayReady, setLocalDayReady] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    setTheme(theme)
    setLocalDayReady(true)
  }, [setTheme, theme])

  useLayoutEffect(() => {
    const el = scrollContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing])

  const handleSend = () => {
    const typed = (textareaRef.current?.value ?? newMessage).trim()
    if (editingMessage) {
      const content = typed
      if (!content) return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingMessage.id ? { ...m, content, edited_at: new Date().toISOString() } : m,
        ),
      )
      setEditingMessage(null)
      setNewMessage('')
      return
    }

    if (!typed && attachmentFiles.length === 0) return

    const content = typed
    const files = [...attachmentFiles]
    setNewMessage('')
    setReplyTo(null)
    setAttachmentFiles([])

    const next: Message = {
      id: `msg-${Date.now()}`,
      pairing_id: PAIRING_ID,
      sender_id: LEARNER_ID,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
      reply_to_id: replyTo?.id || null,
      sender: { id: LEARNER_ID, full_name: sarah.full_name, avatar_url: null },
      reply_to: replyTo
        ? {
            id: replyTo.id,
            content: replyTo.content,
            sender_id: replyTo.sender_id,
            sender: replyTo.sender ? { full_name: replyTo.sender.full_name } : null,
          }
        : null,
      reactions: [],
      attachment_type: files[0]?.file.type.startsWith('image/')
        ? 'image'
        : files[0]
          ? 'file'
          : null,
      attachment_url: files[0]?.preview || null,
    }
    setMessages((prev) => [...prev, next])
  }

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

  const handleToggleReaction = (messageId: string, emoji: MessageReaction['emoji']) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m
        const existing = (m.reactions || []).find((r) => r.user_id === LEARNER_ID && r.emoji === emoji)
        if (existing) {
          return { ...m, reactions: (m.reactions || []).filter((r) => r.id !== existing.id) }
        }
        return {
          ...m,
          reactions: [
            ...(m.reactions || []),
            {
              id: `rxn-${Date.now()}`,
              message_id: messageId,
              user_id: LEARNER_ID,
              emoji,
              created_at: new Date().toISOString(),
            },
          ],
        }
      }),
    )
  }

  return (
    <div className={cn('min-h-screen bg-background', mobile && 'mx-auto w-[390px] overflow-x-hidden')}>
      <PreviewChrome mobile={mobile} />
      <MessagesConversation
        profile={sarah}
        partner={david}
        messages={messages}
        newMessage={newMessage}
        onNewMessageChange={setNewMessage}
        onSend={handleSend}
        isPartnerTyping={typing}
        replyTo={replyTo}
        editingMessage={editingMessage}
        onReply={(msg) => {
          setReplyTo(msg)
          setEditingMessage(null)
          textareaRef.current?.focus()
        }}
        onEdit={(msg) => {
          setEditingMessage(msg)
          setNewMessage(msg.content)
          setReplyTo(null)
          textareaRef.current?.focus()
        }}
        onCancelAction={() => {
          setReplyTo(null)
          if (editingMessage) setNewMessage('')
          setEditingMessage(null)
        }}
        onToggleReaction={handleToggleReaction}
        onScrollToMessage={(id) => {
          document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }}
        attachmentFiles={attachmentFiles}
        onFileSelect={handleFileSelect}
        onRemoveAttachment={(index) => setAttachmentFiles((prev) => prev.filter((_, i) => i !== index))}
        onAttachClick={() => fileInputRef.current?.click()}
        fileInputRef={fileInputRef}
        textareaRef={textareaRef}
        messagesEndRef={messagesEndRef}
        scrollContainerRef={scrollContainerRef}
        localDayReady={localDayReady}
        showTour={false}
      />
    </div>
  )
}

export default function MessagesPreviewPage() {
  return (
    <BrandingProvider initialBranding={DEFAULT_ORG_BRANDING}>
      <Suspense fallback={null}>
        <PreviewInner />
      </Suspense>
    </BrandingProvider>
  )
}
