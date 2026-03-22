import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CompletedJourneysContent } from '@/components/dashboard/completed-journeys-content'

export const metadata: Metadata = {
    title: 'Journey History - Stand Walk Run',
    description: 'View your completed discipleship journeys and archived assignments',
}

export default async function JourneyHistoryPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/auth/login')
    }

    // Get the user's profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', user.id)
        .single()

    if (!profile) {
        redirect('/auth/login')
    }

    // Fetch completed pairings (where journey is complete)
    const { data: completedPairings } = await supabase
        .from('pairings')
        .select(`
      id,
      status,
      current_week,
      started_at,
      completed_at,
      journey_id,
      leader_id,
      learner_id,
      access_code_id,
      journey:journeys(
        id,
        name,
        description,
        duration_weeks
      ),
      leader:profiles!pairings_leader_id_fkey(
        id,
        full_name,
        avatar_url
      ),
      learner:profiles!pairings_learner_id_fkey(
        id,
        full_name,
        avatar_url
      )
    `)
        .or(`leader_id.eq.${user.id},learner_id.eq.${user.id}`)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

    // Get assignment progress for completed journeys
    const completedPairingIds = completedPairings?.map(p => p.id) || []

    let assignmentProgress: Record<string, any[]> = {}

    if (completedPairingIds.length > 0) {
        const { data: progress } = await supabase
            .from('assignment_progress')
            .select(`
        id,
        pairing_id,
        assignment_id,
        status,
        notes,
        completed_at,
        leader_reply,
        leader_reply_at,
        assignment:assignments(
          id,
          title,
          description,
          assignment_type,
          week_number
        )
      `)
            .in('pairing_id', completedPairingIds)
            .order('completed_at', { ascending: true })

        // Group by pairing_id
        progress?.forEach(p => {
            if (!assignmentProgress[p.pairing_id]) {
                assignmentProgress[p.pairing_id] = []
            }
            assignmentProgress[p.pairing_id].push(p)
        })
    }

    return (
        <div className="min-h-screen bg-background">
            <main className="container mx-auto px-4 py-8">
                <CompletedJourneysContent
                    completedPairings={completedPairings || []}
                    assignmentProgress={assignmentProgress}
                    userId={user.id}
                    userRole={profile.role}
                />
            </main>
        </div>
    )
}
