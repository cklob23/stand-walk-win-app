import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ScheduleView } from '@/components/schedule/schedule-view'

export default async function SchedulePage() {
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

    // Get current week topic
    const currentWeek = pairing.current_week || 1
    const { data: weekContent } = await supabase
        .from('weekly_content')
        .select('title')
        .eq('week_number', currentWeek)
        .single()

    // Get leader's availability slots
    const { data: availabilitySlots } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('pairing_id', pairing.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true })

    // Get scheduled meetings (upcoming + recent past)
    const today = new Date().toISOString().split('T')[0]

    const { data: upcomingMeetings } = await supabase
        .from('scheduled_meetings')
        .select('*')
        .eq('pairing_id', pairing.id)
        .eq('status', 'scheduled')
        .gte('meeting_date', today)
        .order('meeting_date', { ascending: true })
        .order('start_time', { ascending: true })

    const { data: pastMeetings } = await supabase
        .from('scheduled_meetings')
        .select('*')
        .eq('pairing_id', pairing.id)
        .in('status', ['completed', 'cancelled'])
        .order('meeting_date', { ascending: false })
        .limit(10)

    return (
        <ScheduleView
            profile={profile}
            pairing={pairing}
            partner={partner}
            availabilitySlots={availabilitySlots || []}
            upcomingMeetings={upcomingMeetings || []}
            pastMeetings={pastMeetings || []}
            weekTopic={weekContent?.title || null}
            weekNumber={currentWeek}
        />
    )
}
