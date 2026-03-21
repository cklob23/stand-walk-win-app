'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Sprout, ArrowRight, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { AppLogo } from '@/components/app-logo'
import { toast } from 'sonner'
import type { Profile } from '@/lib/types'

interface OnboardingWizardProps {
  userId: string
  userEmail: string
  existingProfile: Profile | null
}

// Role is now determined at signup:
// - Access code signup = leader
// - Pairing code signup = learner (already paired)
// So onboarding only needs Welcome and Profile steps
const steps = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'profile', title: 'Your Profile' },
]

export function OnboardingWizard({ userId, userEmail, existingProfile }: OnboardingWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    fullName: existingProfile?.full_name || '',
    bio: existingProfile?.bio || '',
    phone: existingProfile?.phone || '',
  })
  const supabase = createClient()

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleProfileSave = async () => {
    if (!formData.fullName.trim()) {
      toast.error('Please enter your name')
      return
    }

    setIsLoading(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.fullName,
        bio: formData.bio,
        phone: formData.phone,
      })
      .eq('id', userId)

    if (error) {
      toast.error('Failed to save profile')
      setIsLoading(false)
      return
    }

    // Get current profile to check role (set during signup)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    // For leaders: auto-create pairing code if they don't have one
    if (profile?.role === 'leader') {
      // Check if leader already has a pairing
      const { data: existingPairing } = await supabase
        .from('pairings')
        .select('id')
        .eq('leader_id', userId)
        .maybeSingle()

      if (!existingPairing) {
        const code = generatePairingCode()

        const { error: pairingError } = await supabase
          .from('pairings')
          .insert({
            leader_id: userId,
            invite_code: code,
            status: 'pending',
          })

        if (pairingError) {
          toast.error('Failed to create pairing code')
          setIsLoading(false)
          return
        }
      }
    }

    // Complete onboarding and go to dashboard
    await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', userId)

    setIsLoading(false)
    router.push('/dashboard')
  }

  const generatePairingCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress Bar */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-2xl px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm font-medium transition-colors ${index < currentStep
                      ? 'bg-primary text-primary-foreground'
                      : index === currentStep
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                >
                  {index < currentStep ? (
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`ml-1 sm:ml-2 h-0.5 w-8 sm:w-16 md:w-24 transition-colors ${index < currentStep ? 'bg-primary' : 'bg-muted'
                      }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-xs sm:text-sm text-muted-foreground">
            {steps[currentStep].title}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Welcome Step */}
          {currentStep === 0 && (
            <div className="text-center space-y-4 sm:space-y-6">
              <div className="flex justify-center">
                <AppLogo showText={false} iconClassName="h-16 w-16 sm:h-20 sm:w-20 rounded-sm" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Welcome to Stand Walk Run</h1>
                <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto px-4">
                  Embark on a transformative 6-week journey of spiritual growth and mentorship.
                </p>
              </div>
              <div className="pt-4 space-y-4 max-w-md mx-auto">
                <div className="flex items-start gap-4 text-left p-4 rounded-lg bg-card border">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Connect One-on-One</h3>
                    <p className="text-sm text-muted-foreground">
                      Pair with a Leader or Learner for personalized discipleship
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4 text-left p-4 rounded-lg bg-card border">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Sprout className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Grow Together</h3>
                    <p className="text-sm text-muted-foreground">
                      Weekly content, assignments, and meaningful conversations
                    </p>
                  </div>
                </div>
              </div>
              <Button size="lg" onClick={handleNext} className="mt-6">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Profile Step */}
          {currentStep === 1 && (
            <Card>
              <CardHeader className="text-center">
                <CardTitle>Complete Your Profile</CardTitle>
                <CardDescription>
                  Tell us a bit about yourself
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Your name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={userEmail}
                    disabled
                    className="h-11 bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Your phone number"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio (optional)</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Share a little about yourself and your faith journey..."
                    rows={4}
                  />
                </div>
                <div className="flex justify-between pt-4">
                  <Button variant="ghost" onClick={handleBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button onClick={handleProfileSave} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}


        </div>
      </div>
    </div>
  )
}
