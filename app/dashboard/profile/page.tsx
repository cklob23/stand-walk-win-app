import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileView } from '@/components/profile/profile-view'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/onboarding')
  }

  return <ProfileView profile={profile} />
}
