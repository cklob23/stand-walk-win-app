import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HomeLanding } from '@/components/home/home-landing'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single()

    if (profile?.onboarding_complete) {
      redirect('/dashboard')
    } else {
      redirect('/onboarding')
    }
  }

  return <HomeLanding />
}
