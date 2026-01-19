import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MessagesView } from '@/components/messages/messages-view'

export default async function MessagesPage() {
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

  // Get pairing
  let pairing = null
  let partner = null

  if (profile.role === 'leader') {
    const { data } = await supabase
      .from('pairings')
      .select(`
        *,
        learner:profiles!pairings_learner_id_fkey(*)
      `)
      .eq('leader_id', user.id)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (data) {
      pairing = data
      partner = data.learner
    }
  } else {
    const { data } = await supabase
      .from('pairings')
      .select(`
        *,
        leader:profiles!pairings_leader_id_fkey(*)
      `)
      .eq('learner_id', user.id)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (data) {
      pairing = data
      partner = data.leader
    }
  }

  if (!pairing || !partner) {
    redirect('/dashboard')
  }

  // Get messages
  const { data: messages } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)
    `)
    .eq('pairing_id', pairing.id)
    .order('created_at', { ascending: true })

  // Mark unread messages as read
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('pairing_id', pairing.id)
    .neq('sender_id', user.id)
    .eq('is_read', false)

  return (
    <MessagesView 
      profile={profile}
      pairing={pairing}
      partner={partner}
      initialMessages={messages || []}
    />
  )
}
