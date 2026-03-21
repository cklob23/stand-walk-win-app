import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MessagesView } from '@/components/messages/messages-view'
import { getSelectedPairingId } from '@/lib/selected-pairing'
import type { Message } from '@/lib/types'

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ draft?: string; pairing?: string }> }) {
  const { draft, pairing: urlPairingId } = await searchParams
  // Use URL param first, then fall back to cookie
  const cookiePairingId = await getSelectedPairingId()
  const selectedPairingId = urlPairingId || cookiePairingId
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
    // Fetch ALL pairings for multi-learner support
    const { data: allPairings } = await supabase
      .from('pairings')
      .select(`
        *,
        learner:profiles!pairings_learner_id_fkey(*)
      `)
      .eq('leader_id', user.id)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })

    if (allPairings && allPairings.length > 0) {
      // Use selected pairing from URL or default to most recent
      const selectedPairing = selectedPairingId
        ? allPairings.find(p => p.id === selectedPairingId)
        : allPairings[0]

      if (selectedPairing) {
        pairing = selectedPairing
        partner = selectedPairing.learner
      }
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
      sender:profiles(id, full_name, avatar_url),
      reactions:message_reactions(id, message_id, user_id, emoji, created_at)
    `)
    .eq('pairing_id', pairing.id)
    .order('created_at', { ascending: true })

  // Hydrate reply_to from the fetched messages (self-join not supported by PostgREST)
  if (messages) {
    const byId = new Map(messages.map((m: Message) => [m.id, m]))
    for (const msg of messages) {
      if (msg.reply_to_id) {
        const original = byId.get(msg.reply_to_id)
        if (original) {
          msg.reply_to = {
            id: original.id,
            content: original.content,
            sender_id: original.sender_id,
            sender: original.sender ? { full_name: original.sender.full_name } : null,
          }
        }
      }
    }
  }

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
      draftMessage={draft || null}
    />
  )
}
