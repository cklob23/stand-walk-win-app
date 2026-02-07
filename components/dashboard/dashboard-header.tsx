'use client'

import React from "react"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
import { Bell, BookOpen, LayoutDashboard, MessageSquare, ScrollText, Settings, LogOut, User, Menu, X, CheckCircle2, Users, Check } from 'lucide-react'
import { AppLogo } from '@/components/app-logo'
import type { Notification, Profile } from '@/lib/types'
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
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/covenant', label: 'Covenant', icon: ScrollText },
]

const notificationIcons: Record<string, typeof Bell> = {
  message: MessageSquare,
  assignment: BookOpen,
  week_complete: CheckCircle2,
  encouragement: Bell,
  covenant: BookOpen,
  pairing: Users,
}

function getNotificationHref(notification: Notification): string {
  switch (notification.type) {
    case 'message':
      return '/dashboard/messages'
    case 'covenant':
      return '/dashboard/covenant'
    case 'assignment':
    case 'week_complete':
    case 'pairing':
    case 'encouragement':
    default:
      return '/dashboard'
  }
}

export function DashboardHeader({ profile, notificationCount, recentNotifications }: DashboardHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState(recentNotifications)
  const [unreadCount, setUnreadCount] = useState(notificationCount)
  const supabase = createClient()
  const { sendNotification, requestPermission, permission, isSubscribed, isSupported } = useBrowserNotifications()
  const realtimeReady = useRealtimeAuth()

  // Track known notification IDs to detect new ones from polling
  const knownNotifIds = useRef(new Set(recentNotifications.map(n => n.id)))

  // Helper to handle a new notification (toast + push)
  const handleNewNotification = useCallback((newNotif: Notification) => {
    setNotifications(prev => {
      if (prev.some(n => n.id === newNotif.id)) return prev
      return [newNotif, ...prev].slice(0, 5)
    })
    setUnreadCount(prev => prev + 1)

    toast(newNotif.title, {
      description: newNotif.message,
      action: {
        label: 'View',
        onClick: () => router.push(getNotificationHref(newNotif)),
      },
    })

    sendNotification(newNotif.title, {
      body: newNotif.message,
      tag: `notif-${newNotif.id}`,
      onClick: () => {
        router.push(getNotificationHref(newNotif))
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
    router.push(getNotificationHref(notification))
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
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-primary">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <span className="hidden sm:block font-semibold text-foreground text-sm sm:text-base">Stand Walk Run</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
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
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
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
                {isSupported && permission !== 'granted' && permission !== 'denied' && (
                  <div className="px-4 py-2.5 border-b bg-muted/50 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Enable notifications</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-transparent"
                      onClick={() => requestPermission()}
                    >
                      Enable
                    </Button>
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
                  <Avatar className="h-9 w-9">
                    {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.full_name || 'User'} /> : null}
                    <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile.full_name}</p>
                    <p className="text-xs text-muted-foreground">{profile.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
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
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              <span className="sr-only">Toggle menu</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
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
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
