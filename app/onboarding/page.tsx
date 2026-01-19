import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check if user already completed onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_complete) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background">
      <OnboardingWizard 
        userId={user.id} 
        userEmail={user.email || ''} 
        existingProfile={profile}
      />
    </div>
  )
}
