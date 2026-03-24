import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', user.id)
        .single()

    const { data: pairing } = await supabase
        .from('pairings')
        .select('id, current_week, last_celebrated_week, status')
        .eq('learner_id', user.id)
        .eq('status', 'active')
        .single()

    const currentWeek = pairing?.current_week || 1
    const lastCelebratedWeek = pairing?.last_celebrated_week || 0
    const shouldCelebrate = currentWeek > lastCelebratedWeek + 1 && currentWeek <= 6
    const weekToCheck = currentWeek - 1

    return NextResponse.json({
        user: user.id,
        profile,
        pairing,
        analysis: {
            currentWeek,
            lastCelebratedWeek,
            condition: `${currentWeek} > ${lastCelebratedWeek + 1} && ${currentWeek} <= 6`,
            shouldCelebrate,
            weekToCheck: shouldCelebrate ? weekToCheck : null
        }
    })
}

export async function POST() {
    // Force reset last_celebrated_week to trigger celebration
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' })
    }

    const { data: pairing } = await supabase
        .from('pairings')
        .select('id, current_week')
        .eq('learner_id', user.id)
        .eq('status', 'active')
        .single()

    if (!pairing) {
        return NextResponse.json({ error: 'No pairing found' })
    }

    // Set last_celebrated_week to current_week - 2 to trigger celebration for current_week - 1
    const newLastCelebrated = Math.max(0, (pairing.current_week || 1) - 2)

    const { error } = await supabase
        .from('pairings')
        .update({ last_celebrated_week: newLastCelebrated })
        .eq('id', pairing.id)

    if (error) {
        return NextResponse.json({ error: error.message })
    }

    return NextResponse.json({
        success: true,
        message: `Reset last_celebrated_week to ${newLastCelebrated}. Refresh the page to see celebration.`,
        pairing_id: pairing.id,
        current_week: pairing.current_week,
        new_last_celebrated_week: newLastCelebrated
    })
}
