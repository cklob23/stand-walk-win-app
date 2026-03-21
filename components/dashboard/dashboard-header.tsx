'use client'

import React from "react"

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { signOut } from '@/lib/auth-actions'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Bell, BookOpen, Calendar, LayoutDashboard, MessageSquare, ScrollText, Settings, LogOut, User, Menu, X, CheckCircle2, Users, Check, BookMarked, PenLine, UserPlus, Loader2, Shield, Crown, PanelLeftClose, PanelLeft } from 'lucide-react'
import { useSplitScreen } from '@/contexts/split-screen-context'
import { AppLogo } from '@/components/app-logo'
import { useBranding } from '@/contexts/branding-context'
import type { Notification, Profile, Pairing } from '@/lib/types'
import { setSelectedPairingId } from '@/lib/selected-pairing'

interface LearnerWithPairing {
  pairing: Pairing
  learner: Profile
}
import { useState, useEffect, useCallback, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useBrowserNotifications } from '@/hooks/use-browser-notifications'
import { useRealtimeAuth } from '@/hooks/use-realtime-auth'
import { toast } from 'sonner'

interface DashboardHeaderProps {
  profile: Profile
  notificationCount: number
  recentNotifications: Notification[]
  allLearners?: LearnerWithPairing[]
  currentPairingId?: string | null
  learnerNotificationCounts?: Record<string, number> // pairingId -> unread count
  maxLearners?: number
  slogan?: string | null
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/bible', label: 'Bible', icon: BookMarked },
  { href: '/dashboard/journal', label: 'Journal', icon: PenLine },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/dashboard/covenant', label: 'Covenant', icon: ScrollText },
]

const notificationIcons: Record<string, typeof Bell> = {
  message: MessageSquare,
  assignment: BookOpen,
  assignment_reply: MessageSquare,
  assignment_reaction: Bell,
  week_complete: CheckCircle2,
  encouragement: Bell,
  journal_shared: BookOpen,
  covenant: BookOpen,
  pairing: Users,
  meeting_request: Calendar,
  meeting_accepted: CheckCircle2,
  meeting_declined: X,
  meeting_counter_proposed: Calendar,
  meeting_completed: CheckCircle2,
}

function getNotificationHref(notification: Notification, pairingOverride?: string, userRole?: string): string {
  // Route by title for specific notification types
  const title = notification.title?.toLowerCase() || ''
  const pairingParam = pairingOverride || notification.pairing_id
  const assignmentId = notification.metadata?.assignmentId
  // Try to get weekNumber from metadata, or extract from message (e.g., "Week 1: ...")
  let weekNumber = notification.metadata?.weekNumber
  if (!weekNumber && notification.message) {
    const weekMatch = notification.message.match(/Week (\d+)/i)
    if (weekMatch) {
      weekNumber = parseInt(weekMatch[1], 10)
    }
  }

  if (title.includes('bible note shared') || title.includes('shared a verse') || title.includes('journal entry shared')) {
    return '/dashboard/journal?section=shared'
  }
  if (title.includes('meeting') || title.includes('new time proposed')) {
    return pairingParam ? `/dashboard/schedule?pairing=${pairingParam}` : '/dashboard/schedule'
  }

  switch (notification.type) {
    case 'meeting_request':
    case 'meeting_accepted':
    case 'meeting_declined':
    case 'meeting_counter_proposed':
    case 'meeting_completed':
      return pairingParam ? `/dashboard/schedule?pairing=${pairingParam}` : '/dashboard/schedule'
    case 'message':
      return '/dashboard/messages'
    case 'covenant':
      return pairingParam ? `/dashboard/covenant?pairing=${pairingParam}` : '/dashboard/covenant'
    case 'journal_shared':
      return '/dashboard/journal?section=shared'
    case 'pairing':
      return pairingParam ? `/dashboard/schedule?pairing=${pairingParam}` : '/dashboard/schedule'
    case 'assignment_reply':
    case 'assignment_reaction':
    case 'assignment': {
      // For leaders, navigate to week page where they can see assignment details
      // For learners, navigate to dashboard where assignments are shown
      if (userRole === 'leader' && weekNumber) {
        const baseUrl = `/dashboard/week/${weekNumber}`
        const params = new URLSearchParams()
        if (pairingParam) params.set('pairing', pairingParam)
        if (assignmentId) params.set('assignmentId', assignmentId)
        return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl
      }
      // Learners see assignments on main dashboard
      const baseUrl = pairingParam ? `/dashboard?pairing=${pairingParam}` : '/dashboard'
      return assignmentId ? `${baseUrl}${pairingParam ? '&' : '?'}assignmentId=${assignmentId}` : baseUrl
    }
    case 'week_complete':
    case 'encouragement':
    default:
      return pairingParam ? `/dashboard?pairing=${pairingParam}` : '/dashboard'
  }
}

export function DashboardHeader({ profile, notificationCount, recentNotifications, allLearners = [], currentPairingId, learnerNotificationCounts = {}, maxLearners = 1, slogan: initialSlogan }: DashboardHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { branding } = useBranding()

  // Use branding context slogan if available, fall back to prop
  const slogan = branding.slogan ?? initialSlogan
  const urlPairingId = searchParams.get('pairing')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Use prop if provided, otherwise fall back to URL param
  const activePairingId = currentPairingId || urlPairingId

  // Helper to add pairing param to URLs for leaders
  const getNavHref = (href: string) => {
    if (profile.role !== 'leader' || !activePairingId) return href
    // Don't add pairing param to Bible and Journal pages
    if (href === '/dashboard/bible' || href === '/dashboard/journal') return href
    const url = new URL(href, 'http://localhost')
    url.searchParams.set('pairing', activePairingId)
    return `${url.pathname}${url.search}`
  }
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState(recentNotifications)
  const [unreadCount, setUnreadCount] = useState(notificationCount)
  const supabase = createClient()
  const { sendNotification, requestPermission, permission, isSubscribed, isSupported } = useBrowserNotifications()
  const [enablingNotifications, setEnablingNotifications] = useState(false)
  const [switchingLearnerId, setSwitchingLearnerId] = useState<string | null>(null)
  const realtimeReady = useRealtimeAuth()

  // Reset loading state when currentPairingId changes (data has loaded)
  useEffect(() => {
    if (switchingLearnerId && currentPairingId === switchingLearnerId) {
      setSwitchingLearnerId(null)
    }
  }, [currentPairingId, switchingLearnerId])

  // Track known notification IDs to detect new ones from polling
  const knownNotifIds = useRef(new Set(recentNotifications.map(n => n.id)))

  // Helper to handle a new notification (toast + push)
  const handleNewNotification = useCallback((newNotif: Notification) => {
    setNotifications(prev => {
      if (prev.some(n => n.id === newNotif.id)) return prev
      return [newNotif, ...prev].slice(0, 5)
    })
    setUnreadCount(prev => prev + 1)

    // Only show toast popup if user has in-app notifications enabled
    if (profile.in_app_notifications !== false) {
      toast(newNotif.title, {
        description: newNotif.message,
        action: {
          label: 'View',
          onClick: () => router.push(getNotificationHref(newNotif, undefined, profile.role || undefined)),
        },
      })
    }

    sendNotification(newNotif.title, {
      body: newNotif.message,
      tag: `notif-${newNotif.id}`,
      onClick: () => {
        router.push(getNotificationHref(newNotif, undefined, profile.role || undefined))
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Real-time subscription (gated on auth being ready)
  useEffect(() => {
    if (!realtimeReady) return

    const channel = supabase
      .channel('header-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload: any) => {
          const newNotif = payload.new as Notification
          knownNotifIds.current.add(newNotif.id)
          handleNewNotification(newNotif)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload: any) => {
          const updated = payload.new as Notification
          setNotifications(prev =>
            prev.map(n => n.id === updated.id ? updated : n)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, realtimeReady])

  // Polling fallback: check for new notifications every 15s in case realtime misses them
  useEffect(() => {
    const poll = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5)

      if (data) {
        // Update unread count
        setUnreadCount(data.length)

        // Check for any new notifications we haven't seen
        for (const notif of data) {
          if (!knownNotifIds.current.has(notif.id)) {
            knownNotifIds.current.add(notif.id)
            handleNewNotification(notif)
          }
        }
      }
    }

    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notification.id)

      if (!error) {
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    }

    setNotifOpen(false)

    // For leaders, if this notification is from a different learner, switch to that learner
    if (profile.role === 'leader' && notification.pairing_id && notification.pairing_id !== currentPairingId) {
      // Check if we have this learner in our list
      const matchingLearner = allLearners.find(l => l.pairing.id === notification.pairing_id)
      if (matchingLearner) {
        setSwitchingLearnerId(notification.pairing_id)
        await setSelectedPairingId(notification.pairing_id)
        router.push(getNotificationHref(notification, notification.pairing_id, profile.role))
        router.refresh()
        return
      }
    }

    router.push(getNotificationHref(notification, undefined, profile.role || undefined))
  }

  const handleMarkAllRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('read', false)

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
      router.refresh()
    }
  }

  const initials = profile.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '?'

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/dashboard" className="shrink-0">
              <AppLogo textClassName="hidden lg:block text-sm lg:text-base" showSubtitle />
            </Link>

            {/* Desktop Navigation */}
            <nav data-tour="dashboard-nav" className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const href = getNavHref(item.href)
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
              {/* Admin tab - visible to master admins and org admins */}
              {(profile.is_admin || profile.admin_role) && (
                <Link
                  href="/admin/dashboard"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${pathname.startsWith('/admin')
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                  <Shield className="h-4 w-4" />
                  {profile.admin_role === 'org_admin' ? 'Org Admin' : 'Admin'}
                </Link>
              )}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Split Screen Toggle - Desktop only */}
              <SplitScreenToggle />

              {/* Notifications */}
              <Popover open={notifOpen} onOpenChange={setNotifOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                    <span className="sr-only">Notifications</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {isSupported && permission !== 'granted' && !isSubscribed && (
                    <div className="px-4 py-2.5 border-b bg-muted/50 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {permission === 'denied' ? 'Notifications blocked in browser settings' : 'Enable notifications'}
                      </p>
                      {permission !== 'denied' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs bg-transparent"
                          disabled={enablingNotifications}
                          onClick={async () => {
                            setEnablingNotifications(true)
                            try {
                              const result = await requestPermission()
                              if (result === 'granted') {
                                toast.success('Notifications enabled!')
                              } else if (result === 'denied') {
                                toast.error('Notifications were blocked. You can enable them in your browser settings.')
                              } else {
                                toast.info('Please allow notifications when your browser prompts you.')
                              }
                            } catch {
                              toast.error('Could not enable notifications. Try again.')
                            } finally {
                              setEnablingNotifications(false)
                            }
                          }}
                        >
                          {enablingNotifications ? 'Enabling...' : 'Enable'}
                        </Button>
                      )}
                    </div>
                  )}
                  {isSupported && (permission === 'granted' || isSubscribed) && (
                    <div className="px-4 py-2.5 border-b bg-muted/50 flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <p className="text-xs text-muted-foreground">Notifications enabled</p>
                    </div>
                  )}
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((notification) => {
                        const Icon = notificationIcons[notification.type] || Bell
                        return (
                          <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={cn(
                              "flex items-start gap-3 px-4 py-3 border-b last:border-b-0 transition-colors w-full text-left cursor-pointer",
                              !notification.read
                                ? "bg-primary/5 hover:bg-primary/10"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <div className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5",
                              !notification.read
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm leading-snug text-foreground",
                                !notification.read && "font-semibold"
                              )}>
                                {notification.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            {!notification.read && (
                              <button
                                type="button"
                                onClick={(e) => handleMarkAsRead(notification.id, e)}
                                className="shrink-0 mt-0.5 rounded-full p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                aria-label="Mark as read"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                  <div className="border-t px-4 py-2.5">
                    <Link
                      href="/dashboard/notifications"
                      onClick={() => setNotifOpen(false)}
                      className="block text-center text-sm font-medium text-primary hover:underline"
                    >
                      View all notifications
                    </Link>
                  </div>
                </PopoverContent>
              </Popover>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar key={profile.avatar_url || 'no-avatar'} className="h-9 w-9">
                      {profile.avatar_url && profile.avatar_url.length > 0 ? <AvatarImage src={profile.avatar_url} alt={profile.full_name || 'User'} /> : null}
                      <AvatarFallback className="bg-primary/10 text-primary" delayMs={0}>{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  {/* User info section */}
                  <div className="px-3 py-3 border-b">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        {profile.avatar_url && profile.avatar_url.length > 0 ? <AvatarImage src={profile.avatar_url} alt={profile.full_name || 'User'} /> : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-lg" delayMs={0}>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{profile.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                        {branding.organizationName && (
                          <p className="text-xs text-primary/80 truncate mt-0.5">{branding.organizationName}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Learner switcher for leaders */}
                  {profile.role === 'leader' && allLearners.length > 0 && (
                    <>
                      <div className="px-3 py-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Your Learners</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {allLearners.map(({ pairing, learner }) => {
                            const isSelected = pairing.id === currentPairingId
                            const learnerInitials = learner.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'
                            const needsCovenant = !pairing.covenant_accepted_leader || !pairing.covenant_accepted_learner
                            const unreadFromLearner = learnerNotificationCounts[pairing.id] || 0

                            return (
                              <button
                                key={pairing.id}
                                type="button"
                                disabled={switchingLearnerId !== null}
                                onClick={async () => {
                                  if (isSelected) return
                                  setSwitchingLearnerId(pairing.id)
                                  await setSelectedPairingId(pairing.id)
                                  router.push(`/dashboard?pairing=${pairing.id}`)
                                  router.refresh()
                                }}
                                className={cn(
                                  "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors border-2",
                                  isSelected
                                    ? "bg-primary/10 text-primary border-primary"
                                    : "hover:bg-muted border-transparent",
                                  switchingLearnerId !== null && !isSelected && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                <div className="relative">
                                  <Avatar className="h-8 w-8">
                                    {learner.avatar_url && <AvatarImage src={learner.avatar_url} alt={learner.full_name || 'Learner'} />}
                                    <AvatarFallback className={cn(
                                      "text-xs",
                                      isSelected ? "bg-primary/20 text-primary" : "bg-muted"
                                    )} delayMs={0}>
                                      {learnerInitials}
                                    </AvatarFallback>
                                  </Avatar>
                                  {!isSelected && unreadFromLearner > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                                      {unreadFromLearner > 9 ? '9+' : unreadFromLearner}
                                    </span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{learner.full_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {needsCovenant ? 'Covenant pending' : `Week ${pairing.current_week || 1}`}
                                  </p>
                                </div>
                                {switchingLearnerId === pairing.id ? (
                                  <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
                                ) : isSelected ? (
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                ) : null}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div className="px-3 pb-2">
                        {allLearners.length < maxLearners ? (
                          <Link
                            href="/dashboard?new=true"
                            className="flex items-center gap-2 p-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <UserPlus className="h-4 w-4" />
                            Add New Learner
                          </Link>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 p-2 text-xs text-muted-foreground">
                            <Crown className="h-3 w-3" />
                            <span>{profile.subscription_tier?.display_name || 'Basic'}: {allLearners.length}/{maxLearners} learners</span>
                          </div>
                        )}
                      </div>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/profile" className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings" className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {profile.is_admin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin/dashboard" className="flex items-center">
                        <Shield className="mr-2 h-4 w-4" />
                        Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                <span className="sr-only">Toggle menu</span>
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="lg:hidden py-4 border-t">
              <div className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const href = getNavHref(item.href)
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  )
                })}
                {/* Admin tab - visible to master admins and org admins */}
                {(profile.is_admin || profile.admin_role) && (
                  <Link
                    href="/admin/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${pathname.startsWith('/admin')
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                  >
                    <Shield className="h-4 w-4" />
                    {profile.admin_role === 'org_admin' ? 'Org Admin' : 'Admin'}
                  </Link>
                )}
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Slogan Banner */}
      {slogan && (
        <div className="bg-primary/5 border-b py-2">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <p className="text-sm text-muted-foreground italic">{slogan}</p>
          </div>
        </div>
      )}
    </>
  )
}

// Split Screen Toggle Button Component
function SplitScreenToggle() {
  const { isSplitScreen, toggleSplitScreen } = useSplitScreen()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Only show on desktop (lg breakpoint and above)
  if (!isMounted) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSplitScreen}
      className="hidden lg:flex"
      title={isSplitScreen ? 'Exit split view' : 'Enable split view'}
    >
      {isSplitScreen ? (
        <PanelLeftClose className="h-5 w-5" />
      ) : (
        <PanelLeft className="h-5 w-5" />
      )}
      <span className="sr-only">{isSplitScreen ? 'Exit split view' : 'Enable split view'}</span>
    </Button>
  )
}
