'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth-actions'
import { updateNotificationSettings, deleteAccount, removeAvatar } from '@/lib/settings-actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Settings, Bell, Moon, LogOut, Trash2, Camera, Loader2, X, Building2 } from 'lucide-react'
import type { Profile } from '@/lib/types'
import { useBranding } from '@/contexts/branding-context'

interface SettingsViewProps {
  profile: Profile
}

export function SettingsView({ profile }: SettingsViewProps) {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const { branding } = useBranding()
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Avatar states
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [isUploading, setIsUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  // Notification states - initialize from profile or defaults
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [inAppNotifications, setInAppNotifications] = useState(profile.in_app_notifications ?? true)
  const [emailNotifications, setEmailNotifications] = useState(profile.email_notifications ?? true)
  const [messageNotifications, setMessageNotifications] = useState(profile.message_notifications ?? true)
  const [progressNotifications, setProgressNotifications] = useState(profile.progress_notifications ?? true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      setIsDark(theme === 'dark')
    }
  }, [mounted, theme])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarError(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const res = await fetch('/api/avatar/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setAvatarError(data.error || 'Upload failed')
        return
      }

      setAvatarUrl(data.avatar_url)
      router.refresh()
    } catch {
      setAvatarError('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    setIsUploading(true)
    setAvatarError(null)
    const result = await removeAvatar()
    if (result.error) {
      setAvatarError(result.error)
    } else {
      setAvatarUrl(null)
      router.refresh()
    }
    setIsUploading(false)
  }

  const initials = profile.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || profile.email?.[0]?.toUpperCase() || '?'

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Settings className="h-5 w-5 text-primary" />
            Settings
          </CardTitle>
          <CardDescription className="text-sm">
            Manage your app preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notifications */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </h3>
            <div className="space-y-4">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="in-app-notifications" className="text-sm">In-App Notifications</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Show popup notifications within the app
                  </p>
                </div>
                <Switch
                  id="in-app-notifications"
                  checked={inAppNotifications}
                  onCheckedChange={async (checked) => {
                    setInAppNotifications(checked)
                    await updateNotificationSettings({ in_app_notifications: checked })
                  }}
                  className="shrink-0"
                />
              </div>
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="email-notifications" className="text-sm">Email Notifications</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Receive email updates about your discipleship journey
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={async (checked) => {
                    setEmailNotifications(checked)
                    await updateNotificationSettings({ email_notifications: checked })
                  }}
                  className="shrink-0"
                />
              </div>
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="message-notifications" className="text-sm">Message Notifications</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Get notified when you receive new messages
                  </p>
                </div>
                <Switch
                  id="message-notifications"
                  checked={messageNotifications}
                  onCheckedChange={async (checked) => {
                    setMessageNotifications(checked)
                    await updateNotificationSettings({ message_notifications: checked })
                  }}
                  className="shrink-0"
                />
              </div>
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="progress-notifications" className="text-sm">Progress Updates</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Receive updates about your partner&apos;s progress
                  </p>
                </div>
                <Switch
                  id="progress-notifications"
                  checked={progressNotifications}
                  onCheckedChange={async (checked) => {
                    setProgressNotifications(checked)
                    await updateNotificationSettings({ progress_notifications: checked })
                  }}
                  className="shrink-0"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Appearance */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              <Moon className="h-4 w-4" />
              Appearance
            </h3>
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Label htmlFor="dark-mode" className="text-sm">Dark Mode</Label>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Switch to dark theme
                </p>
              </div>
              {mounted ? (
                <Switch
                  id="dark-mode"
                  className="shrink-0"
                  checked={isDark}
                  onCheckedChange={(checked) => {
                    setIsDark(checked)
                    setTheme(checked ? 'dark' : 'light')
                  }}
                />
              ) : (
                <div className="h-6 w-11 rounded-full bg-muted animate-pulse shrink-0" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your account information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Profile Picture */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative group">
              <Avatar key={avatarUrl || 'no-avatar'} className="h-20 w-20 border-2 border-border">
                {avatarUrl && avatarUrl.length > 0 ? <AvatarImage src={avatarUrl} alt={profile.full_name || 'Profile'} /> : null}
                <AvatarFallback className="text-lg bg-primary/10 text-primary" delayMs={0}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="flex flex-col items-center sm:items-start gap-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {avatarUrl ? 'Change Photo' : 'Upload Photo'}
                </Button>
                {avatarUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={isUploading}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, WebP, or GIF. Max 5MB.
              </p>
              {avatarError && (
                <p className="text-xs text-destructive">{avatarError}</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
          </div>

          <div className="h-px bg-border" />

          <div>
            <p className="text-sm font-medium text-foreground">Name</p>
            <p className="text-sm text-muted-foreground">{profile.full_name || 'Not set'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Email</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Role</p>
            <p className="text-sm text-muted-foreground capitalize">{profile.role}</p>
          </div>
          {branding.organizationName && (
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Organization
              </p>
              <p className="text-sm text-muted-foreground">{branding.organizationName}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">Member since</p>
            <p className="text-sm text-muted-foreground">
              {new Date(profile.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          <div className="h-px bg-border" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Sign out</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Sign out of your account on this device
              </p>
            </div>
            <Button variant="outline" onClick={() => signOut()} className="w-full sm:w-auto">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Delete account</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
            </div>
            <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
              setDeleteDialogOpen(open)
              if (!open) {
                setDeleteConfirmText('')
                setDeleteError(null)
              }
            }}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <span className="block">
                      This will permanently delete your account, including all your messages,
                      progress, reflections, and pairing data. This action cannot be undone.
                    </span>
                    <span className="block text-sm font-medium text-foreground">
                      Type <span className="font-mono text-destructive">delete my account</span> to confirm:
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="delete my account"
                  className="font-mono"
                  disabled={isDeleting}
                />
                {deleteError && (
                  <p className="text-sm text-destructive">{deleteError}</p>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={deleteConfirmText !== 'delete my account' || isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async (e) => {
                      e.preventDefault()
                      setIsDeleting(true)
                      setDeleteError(null)
                      const result = await deleteAccount()
                      if (result?.error) {
                        setDeleteError(result.error)
                        setIsDeleting(false)
                      }
                    }}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Account'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
