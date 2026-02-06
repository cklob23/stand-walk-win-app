'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Users, GraduationCap, ArrowRight, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile, UserRole } from '@/lib/types'
import { joinPairing } from '@/lib/auth-actions'

interface OnboardingWizardProps {
  userId: string
  userEmail: string
  existingProfile: Profile | null
}

const steps = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'role', title: 'Choose Your Role' },
  { id: 'profile', title: 'Your Profile' },
  { id: 'connect', title: 'Connect' },
]

export function OnboardingWizard({ userId, userEmail, existingProfile }: OnboardingWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    fullName: existingProfile?.full_name || '',
    role: existingProfile?.role || ('' as UserRole | ''),
    bio: existingProfile?.bio || '',
    phone: existingProfile?.phone || '',
    pairingCode: '',
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

  const handleRoleSelect = (role: UserRole) => {
    setFormData({ ...formData, role })
    handleNext()
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
        role: formData.role,
        bio: formData.bio,
        phone: formData.phone,
      })
      .eq('id', userId)

    if (error) {
      toast.error('Failed to save profile')
      setIsLoading(false)
      return
    }

    // For leaders: auto-create pairing code, complete onboarding, go to dashboard
    if (formData.role === 'leader') {
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

      await supabase
        .from('profiles')
        .update({ onboarding_complete: true })
        .eq('id', userId)

      setIsLoading(false)
      router.push('/dashboard')
      return
    }

    // For learners: proceed to the connect step
    setIsLoading(false)
    handleNext()
  }

  const generatePairingCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const handleJoinPairing = async () => {
    if (!formData.pairingCode.trim()) {
      toast.error('Please enter a pairing code')
      return
    }

    setIsLoading(true)

    // Complete onboarding first
    await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', userId)

    // Use server action to join pairing (handles DB update, notifications, and revalidation)
    const result = await joinPairing(formData.pairingCode)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success('Successfully connected with your Leader!')
    router.push('/dashboard')
  }

  const handleSkipForNow = async () => {
    setIsLoading(true)
    
    await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', userId)

    router.push('/dashboard')
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
                  className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm font-medium transition-colors ${
                    index < currentStep
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
                    className={`ml-1 sm:ml-2 h-0.5 w-8 sm:w-16 md:w-24 transition-colors ${
                      index < currentStep ? 'bg-primary' : 'bg-muted'
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
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-primary">
                  <BookOpen className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground" />
                </div>
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
                    <GraduationCap className="h-5 w-5 text-primary" />
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

          {/* Role Selection Step */}
          {currentStep === 1 && (
            <div className="space-y-4 sm:space-y-6">
              <div className="text-center px-4">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Choose Your Role</h2>
                <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                  How would you like to participate in this discipleship journey?
                </p>
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <Card 
                  className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
                  onClick={() => handleRoleSelect('leader')}
                >
                  <CardHeader className="text-center pb-2">
                    <div className="flex justify-center mb-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                        <Users className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <CardTitle>Leader</CardTitle>
                    <CardDescription>Guide someone on their faith journey</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center text-sm text-muted-foreground">
                    <ul className="space-y-2">
                      <li>Mentor a Learner through 6 weeks</li>
                      <li>Create a pairing code to invite</li>
                      <li>Track progress and provide feedback</li>
                    </ul>
                  </CardContent>
                </Card>
                <Card 
                  className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
                  onClick={() => handleRoleSelect('learner')}
                >
                  <CardHeader className="text-center pb-2">
                    <div className="flex justify-center mb-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                        <GraduationCap className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <CardTitle>Learner</CardTitle>
                    <CardDescription>Grow with guidance from a Leader</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center text-sm text-muted-foreground">
                    <ul className="space-y-2">
                      <li>Complete weekly assignments</li>
                      <li>Join using your Leader&apos;s code</li>
                      <li>Track your spiritual growth</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-center">
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </div>
            </div>
          )}

          {/* Profile Step */}
          {currentStep === 2 && (
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

          {/* Connect Step (Learner only - Leaders skip to dashboard) */}
          {currentStep === 3 && (
            <div className="space-y-4 sm:space-y-6">
              <div className="text-center px-4">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  Connect with Your Leader
                </h2>
                <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                  Enter the code your Leader shared with you
                </p>
              </div>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pairingCode">Pairing Code</Label>
                    <Input
                      id="pairingCode"
                      value={formData.pairingCode}
                      onChange={(e) => setFormData({ ...formData, pairingCode: e.target.value.toUpperCase() })}
                      placeholder="Enter 6-character code"
                      maxLength={6}
                      className="h-12 text-center text-lg font-mono tracking-widest"
                    />
                  </div>
                  <Button 
                    onClick={handleJoinPairing} 
                    disabled={isLoading || formData.pairingCode.length < 6}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Join Discipleship'
                    )}
                  </Button>
                </CardContent>
              </Card>

              <div className="flex justify-between items-center pt-4">
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button variant="link" onClick={handleSkipForNow} disabled={isLoading}>
                  Skip for now
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
