'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { User, Loader2, Save, Camera, Building2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile } from '@/lib/types'
import { useBranding } from '@/contexts/branding-context'
import { EmailChangeDialog } from './email-change-dialog'

interface ProfileViewProps {
  profile: Profile
  /** If true, hides phone and bio fields (for admin profiles) */
  hideExtendedFields?: boolean
  /** Custom role label to display (e.g., "Master Admin") */
  roleLabel?: string
  /** Organization name to display (overrides branding context) */
  organizationName?: string | null
}

export function ProfileView({
  profile: initialProfile,
  hideExtendedFields = false,
  roleLabel,
  organizationName: propOrgName,
}: ProfileViewProps) {
  const router = useRouter()
  const { branding } = useBranding()
  const [profile, setProfile] = useState(initialProfile)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url)
  const [currentEmail, setCurrentEmail] = useState(initialProfile.email)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  const initials = profile.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '?'

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
        toast.error(data.error || 'Upload failed')
        return
      }

      setAvatarUrl(data.avatar_url)
      toast.success('Profile photo updated!')
      router.refresh()
    } catch {
      toast.error('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    setIsLoading(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        bio: profile.bio,
        phone: profile.phone,
      })
      .eq('id', profile.id)

    if (error) {
      toast.error('Failed to update profile')
      setIsLoading(false)
      return
    }

    toast.success('Profile updated!')
    setIsLoading(false)
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Your Profile
          </CardTitle>
          <CardDescription>
            Manage your personal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="relative group cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-label="Upload profile photo"
            >
              <Avatar key={avatarUrl || 'no-avatar'} className="h-20 w-20 transition-opacity group-hover:opacity-75">
                {avatarUrl && avatarUrl.length > 0 ? (
                  <AvatarImage src={avatarUrl} alt={profile.full_name || 'Profile'} />
                ) : null}
                <AvatarFallback className="text-2xl bg-primary/10 text-primary" delayMs={0}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                {isUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </div>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <div>
              <h3 className="font-semibold text-foreground">{profile.full_name}</h3>
              <p className="text-sm text-muted-foreground">{currentEmail}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="secondary" className="capitalize">
                  {roleLabel || profile.role}
                </Badge>
                {(propOrgName || branding.organizationName) && (
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {propOrgName || branding.organizationName}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Your name"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  value={currentEmail}
                  disabled
                  className="h-11 bg-muted flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEmailDialogOpen(true)}
                  className="h-11 shrink-0"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Change
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Click Change to update your email with verification
              </p>
            </div>

            {!hideExtendedFields && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input
                    id="phone"
                    value={profile.phone || ''}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="Your phone number"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio (optional)</Label>
                  <Textarea
                    id="bio"
                    value={profile.bio || ''}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="Share a little about yourself and your faith journey..."
                    rows={4}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <EmailChangeDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        currentEmail={currentEmail}
        userId={profile.id}
        onEmailChanged={(newEmail: any) => {
          setCurrentEmail(newEmail)
          router.refresh()
        }}
      />
    </div>
  )
}
