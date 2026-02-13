'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateContactInfo(data: {
    phone?: string
    zoomLink?: string
}) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const updates: Record<string, string | null> = { updated_at: new Date().toISOString() }
        if (data.phone !== undefined) updates.phone = data.phone || null
        if (data.zoomLink !== undefined) updates.zoom_link = data.zoomLink || null

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id)

        if (error) return { error: error.message }

        revalidatePath('/dashboard/schedule')
        revalidatePath('/dashboard')
        revalidatePath('/dashboard/settings')
        return { success: true }
    } catch {
        return { error: 'Unable to update contact info.' }
    }
}

export async function saveAvailability(
    pairingId: string,
    slots: { day_of_week: number; start_time: string; end_time: string }[]
) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        // Delete existing slots for this pairing
        await supabase
            .from('availability_slots')
            .delete()
            .eq('user_id', user.id)
            .eq('pairing_id', pairingId)

        // Insert new slots
        if (slots.length > 0) {
            const { error } = await supabase.from('availability_slots').insert(
                slots.map((slot) => ({
                    user_id: user.id,
                    pairing_id: pairingId,
                    day_of_week: slot.day_of_week,
                    start_time: slot.start_time,
                    end_time: slot.end_time,
                }))
            )
            if (error) return { error: error.message }
        }

        revalidatePath('/dashboard/schedule')
        revalidatePath('/dashboard')
        return { success: true }
    } catch {
        return { error: 'Unable to save availability.' }
    }
}

export async function bookMeeting(data: {
    pairingId: string
    meetingDate: string
    startTime: string
    endTime: string
    meetingType: 'facetime' | 'zoom' | 'phone' | 'in_person'
    meetingLink?: string
    notes?: string
}) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        // Check for conflicting meetings
        const { data: existing } = await supabase
            .from('scheduled_meetings')
            .select('id')
            .eq('pairing_id', data.pairingId)
            .eq('meeting_date', data.meetingDate)
            .eq('start_time', data.startTime)
            .eq('status', 'scheduled')
            .limit(1)

        if (existing && existing.length > 0) {
            return { error: 'This time slot is already booked.' }
        }

        const { error } = await supabase.from('scheduled_meetings').insert({
            pairing_id: data.pairingId,
            scheduled_by: user.id,
            meeting_date: data.meetingDate,
            start_time: data.startTime,
            end_time: data.endTime,
            meeting_type: data.meetingType,
            meeting_link: data.meetingLink || null,
            notes: data.notes || null,
            status: 'scheduled',
        })

        if (error) return { error: error.message }

        // Get pairing to find the partner for notification
        const { data: pairing } = await supabase
            .from('pairings')
            .select('leader_id, learner_id')
            .eq('id', data.pairingId)
            .single()

        if (pairing) {
            const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id
            if (partnerId) {
                const { data: booker } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single()

                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                const meetingDateObj = new Date(data.meetingDate + 'T12:00:00')
                const dayName = dayNames[meetingDateObj.getDay()]

                await supabase.from('notifications').insert({
                    user_id: partnerId,
                    pairing_id: data.pairingId,
                    type: 'pairing',
                    title: 'Meeting Scheduled',
                    message: `${booker?.full_name || 'Your partner'} scheduled a ${data.meetingType.replace('_', ' ')} call on ${dayName}, ${data.meetingDate} at ${data.startTime}.`,
                    read: false,
                })
            }
        }

        revalidatePath('/dashboard/schedule')
        revalidatePath('/dashboard')
        return { success: true }
    } catch {
        return { error: 'Unable to book meeting.' }
    }
}

export async function cancelMeeting(meetingId: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { error } = await supabase
            .from('scheduled_meetings')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', meetingId)

        if (error) return { error: error.message }

        revalidatePath('/dashboard/schedule')
        revalidatePath('/dashboard')
        return { success: true }
    } catch {
        return { error: 'Unable to cancel meeting.' }
    }
}

export async function completeMeeting(meetingId: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { error } = await supabase
            .from('scheduled_meetings')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', meetingId)

        if (error) return { error: error.message }

        revalidatePath('/dashboard/schedule')
        revalidatePath('/dashboard')
        return { success: true }
    } catch {
        return { error: 'Unable to update meeting.' }
    }
}

export async function updateMeetingLink(meetingId: string, link: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { error } = await supabase
            .from('scheduled_meetings')
            .update({ meeting_link: link, updated_at: new Date().toISOString() })
            .eq('id', meetingId)

        if (error) return { error: error.message }

        revalidatePath('/dashboard/schedule')
        return { success: true }
    } catch {
        return { error: 'Unable to update meeting link.' }
    }
}
