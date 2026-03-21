'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/lib/notifications'

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

        // Check for conflicting meetings (scheduled or pending)
        const { data: existing } = await supabase
            .from('scheduled_meetings')
            .select('id')
            .eq('pairing_id', data.pairingId)
            .eq('meeting_date', data.meetingDate)
            .eq('start_time', data.startTime)
            .in('status', ['scheduled', 'pending_approval'])
            .limit(1)

        if (existing && existing.length > 0) {
            return { error: 'This time slot is already booked or pending approval.' }
        }

        // Get pairing to determine if user is leader or learner
        const { data: pairing } = await supabase
            .from('pairings')
            .select('leader_id, learner_id')
            .eq('id', data.pairingId)
            .single()

        if (!pairing) return { error: 'Pairing not found' }

        const isLeader = pairing.leader_id === user.id
        // Leaders can directly schedule, learners need approval
        const status = isLeader ? 'scheduled' : 'pending_approval'

        const { error } = await supabase.from('scheduled_meetings').insert({
            pairing_id: data.pairingId,
            scheduled_by: user.id,
            proposed_by: user.id,
            meeting_date: data.meetingDate,
            start_time: data.startTime,
            end_time: data.endTime,
            meeting_type: data.meetingType,
            meeting_link: data.meetingLink || null,
            notes: data.notes || null,
            status,
        })

        if (error) return { error: error.message }

        // Notify partner
        const partnerId = isLeader ? pairing.learner_id : pairing.leader_id
        if (partnerId) {
            const { data: booker } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single()

            const meetingDateObj = new Date(data.meetingDate + 'T12:00:00')
            const formattedDate = meetingDateObj.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })

            if (isLeader) {
                // Leader scheduled directly
                const notifMessage = data.notes
                    ? `${booker?.full_name || 'Your leader'} scheduled a ${data.meetingType.replace('_', ' ')} call on ${formattedDate} at ${data.startTime}.\n\nNote: ${data.notes}`
                    : `${booker?.full_name || 'Your leader'} scheduled a ${data.meetingType.replace('_', ' ')} call on ${formattedDate} at ${data.startTime}.`

                await createNotification({
                    userId: partnerId,
                    pairingId: data.pairingId,
                    type: 'pairing',
                    title: data.notes?.toLowerCase().includes('journal') ? 'Meeting Scheduled: Journal Discussion' : 'Meeting Scheduled',
                    message: notifMessage,
                })
            } else {
                // Learner requested - needs approval
                const notifMessage = data.notes
                    ? `${booker?.full_name || 'Your learner'} requested a ${data.meetingType.replace('_', ' ')} call on ${formattedDate} at ${data.startTime}.\n\nNote: ${data.notes}\n\nPlease accept, decline, or propose a new time.`
                    : `${booker?.full_name || 'Your learner'} requested a ${data.meetingType.replace('_', ' ')} call on ${formattedDate} at ${data.startTime}.\n\nPlease accept, decline, or propose a new time.`

                await createNotification({
                    userId: partnerId,
                    pairingId: data.pairingId,
                    type: 'meeting_request',
                    title: 'Meeting Request',
                    message: notifMessage,
                })
            }
        }

        revalidatePath('/dashboard/schedule')
        revalidatePath('/dashboard')
        return { success: true, status }
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

        // Get meeting details for notification
        const { data: meeting } = await supabase
            .from('scheduled_meetings')
            .select('*, pairing:pairings(leader_id, learner_id)')
            .eq('id', meetingId)
            .single()

        const { error } = await supabase
            .from('scheduled_meetings')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', meetingId)

        if (error) return { error: error.message }

        // Notify the partner
        if (meeting) {
            const pairing = meeting.pairing as { leader_id: string; learner_id: string }
            const isLeader = pairing.leader_id === user.id
            const recipientId = isLeader ? pairing.learner_id : pairing.leader_id

            const { data: completer } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single()

            const meetingDateObj = new Date(meeting.meeting_date + 'T12:00:00')
            const formattedDate = meetingDateObj.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
            })

            await createNotification({
                userId: recipientId,
                pairingId: meeting.pairing_id,
                type: 'meeting_completed',
                title: 'Meeting Completed',
                message: `${completer?.full_name || 'Your partner'} marked your meeting on ${formattedDate} as completed.`,
            })
        }

        revalidatePath('/dashboard/schedule')
        revalidatePath('/dashboard')
        return { success: true }
    } catch {
        return { error: 'Unable to update meeting.' }
    }
}

export async function updateMeeting(
    meetingId: string,
    data: {
        meetingType?: 'facetime' | 'zoom' | 'phone' | 'in_person'
        meetingDate?: string
        startTime?: string
        endTime?: string
        meetingLink?: string | null
        notes?: string | null
    }
) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (data.meetingType !== undefined) updates.meeting_type = data.meetingType
        if (data.meetingDate !== undefined) updates.meeting_date = data.meetingDate
        if (data.startTime !== undefined) updates.start_time = data.startTime
        if (data.endTime !== undefined) updates.end_time = data.endTime
        if (data.meetingLink !== undefined) updates.meeting_link = data.meetingLink
        if (data.notes !== undefined) updates.notes = data.notes

        // If rescheduling, check for conflicts
        if (data.meetingDate && data.startTime) {
            const { data: existing } = await supabase
                .from('scheduled_meetings')
                .select('id')
                .eq('meeting_date', data.meetingDate)
                .eq('start_time', data.startTime)
                .eq('status', 'scheduled')
                .neq('id', meetingId)
                .limit(1)

            if (existing && existing.length > 0) {
                return { error: 'That time slot is already booked.' }
            }
        }

        const { error } = await supabase
            .from('scheduled_meetings')
            .update(updates)
            .eq('id', meetingId)

        if (error) return { error: error.message }

        // Notify partner
        const { data: meeting } = await supabase
            .from('scheduled_meetings')
            .select('pairing_id')
            .eq('id', meetingId)
            .single()

        if (meeting) {
            const { data: pairing } = await supabase
                .from('pairings')
                .select('leader_id, learner_id')
                .eq('id', meeting.pairing_id)
                .single()

            if (pairing) {
                const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id
                if (partnerId) {
                    const { data: editor } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', user.id)
                        .single()

                    await createNotification({
                        userId: partnerId,
                        pairingId: meeting.pairing_id,
                        type: 'pairing',
                        title: 'Meeting Updated',
                        message: `${editor?.full_name || 'Your partner'} updated an upcoming meeting.`,
                    })
                }
            }
        }

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

// Meeting Approval Workflow Functions

export async function acceptMeeting(meetingId: string, responseNote?: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        // Get the meeting and verify it's pending approval
        const { data: meeting } = await supabase
            .from('scheduled_meetings')
            .select('*, pairing:pairings(leader_id, learner_id)')
            .eq('id', meetingId)
            .single()

        if (!meeting) return { error: 'Meeting not found' }
        if (meeting.status !== 'pending_approval' && meeting.status !== 'counter_proposed') {
            return { error: 'This meeting is not pending approval' }
        }

        // Verify user is the one who should approve
        const pairing = meeting.pairing as { leader_id: string; learner_id: string }
        const isLeader = pairing.leader_id === user.id
        const isPendingFromLearner = meeting.status === 'pending_approval' && meeting.proposed_by === pairing.learner_id
        const isCounterFromLeader = meeting.status === 'counter_proposed' && meeting.proposed_by === pairing.leader_id

        if (isLeader && !isPendingFromLearner) {
            return { error: 'You cannot approve this meeting' }
        }
        if (!isLeader && !isCounterFromLeader) {
            return { error: 'You cannot approve this meeting' }
        }

        // Accept the meeting
        const { error } = await supabase
            .from('scheduled_meetings')
            .update({
                status: 'scheduled',
                response_note: responseNote || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', meetingId)

        if (error) return { error: error.message }

        // Notify the other person in the pairing (the one who proposed)
        const recipientId = isLeader ? pairing.learner_id : pairing.leader_id

        const { data: accepter } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()

        const meetingDateObj = new Date(meeting.meeting_date + 'T12:00:00')
        const formattedDate = meetingDateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        })

        await createNotification({
            userId: recipientId,
            pairingId: meeting.pairing_id,
            type: 'meeting_accepted',
            title: 'Meeting Accepted',
            message: `${accepter?.full_name || 'Your partner'} accepted the meeting on ${formattedDate} at ${meeting.start_time.slice(0, 5)}.${responseNote ? `\n\nNote: ${responseNote}` : ''}`,
        })

        revalidatePath('/dashboard/schedule')
        revalidatePath('/dashboard')
        return { success: true }
    } catch {
        return { error: 'Unable to accept meeting.' }
    }
}

export async function declineMeeting(meetingId: string, declineReason?: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        // Get the meeting
        const { data: meeting } = await supabase
            .from('scheduled_meetings')
            .select('*, pairing:pairings(leader_id, learner_id)')
            .eq('id', meetingId)
            .single()

        if (!meeting) return { error: 'Meeting not found' }
        if (meeting.status !== 'pending_approval' && meeting.status !== 'counter_proposed') {
            return { error: 'This meeting is not pending approval' }
        }

        // Update meeting status to declined
        const { error } = await supabase
            .from('scheduled_meetings')
            .update({
                status: 'declined',
                decline_reason: declineReason || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', meetingId)

        if (error) return { error: error.message }

        // Notify the other person in the pairing
        const pairing = meeting.pairing as { leader_id: string; learner_id: string }
        const isLeader = pairing.leader_id === user.id
        const recipientId = isLeader ? pairing.learner_id : pairing.leader_id

        const { data: decliner } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()

        const meetingDateObj = new Date(meeting.meeting_date + 'T12:00:00')
        const formattedDate = meetingDateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        })

        await createNotification({
            userId: recipientId,
            pairingId: meeting.pairing_id,
            type: 'meeting_declined',
            title: 'Meeting Declined',
            message: `${decliner?.full_name || 'Your partner'} declined the meeting request for ${formattedDate} at ${meeting.start_time.slice(0, 5)}.${declineReason ? `\n\nReason: ${declineReason}` : ''}`,
        })

        revalidatePath('/dashboard/schedule')
        revalidatePath('/dashboard')
        return { success: true }
    } catch {
        return { error: 'Unable to decline meeting.' }
    }
}

export async function proposeNewTime(data: {
    originalMeetingId: string
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

        // Get the original meeting
        const { data: originalMeeting } = await supabase
            .from('scheduled_meetings')
            .select('*, pairing:pairings(leader_id, learner_id)')
            .eq('id', data.originalMeetingId)
            .single()

        if (!originalMeeting) return { error: 'Original meeting not found' }

        // Mark original meeting as having a counter-proposal
        await supabase
            .from('scheduled_meetings')
            .update({
                status: 'declined',
                decline_reason: 'Counter-proposal sent',
                updated_at: new Date().toISOString()
            })
            .eq('id', data.originalMeetingId)

        // Create the counter-proposal
        const { error } = await supabase.from('scheduled_meetings').insert({
            pairing_id: originalMeeting.pairing_id,
            scheduled_by: user.id,
            proposed_by: user.id,
            original_meeting_id: data.originalMeetingId,
            meeting_date: data.meetingDate,
            start_time: data.startTime,
            end_time: data.endTime,
            meeting_type: data.meetingType,
            meeting_link: data.meetingLink || null,
            notes: data.notes || null,
            status: 'counter_proposed',
        })

        if (error) return { error: error.message }

        // Notify the other party (not the one proposing)
        const pairing = originalMeeting.pairing as { leader_id: string; learner_id: string }
        const isLeader = pairing.leader_id === user.id
        // Send notification to the other person in the pairing
        const recipientId = isLeader ? pairing.learner_id : pairing.leader_id

        const { data: proposer } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()

        const meetingDateObj = new Date(data.meetingDate + 'T12:00:00')
        const formattedDate = meetingDateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        })

        await createNotification({
            userId: recipientId,
            pairingId: originalMeeting.pairing_id,
            type: 'meeting_counter_proposed',
            title: 'New Time Proposed',
            message: `${proposer?.full_name || (isLeader ? 'Your leader' : 'Your learner')} proposed a different time: ${formattedDate} at ${data.startTime}.${data.notes ? `\n\nNote: ${data.notes}` : ''}\n\nPlease accept or decline.`,
        })

        revalidatePath('/dashboard/schedule')
        revalidatePath('/dashboard')
        return { success: true }
    } catch {
        return { error: 'Unable to propose new time.' }
    }
}

export async function getPendingMeetings(pairingId: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated', meetings: [] }

        const { data: meetings, error } = await supabase
            .from('scheduled_meetings')
            .select(`
        *,
        proposer:profiles!scheduled_meetings_proposed_by_fkey(id, full_name, avatar_url),
        scheduler:profiles!scheduled_meetings_scheduled_by_fkey(id, full_name, avatar_url)
      `)
            .eq('pairing_id', pairingId)
            .in('status', ['pending_approval', 'counter_proposed'])
            .order('meeting_date', { ascending: true })

        if (error) return { error: error.message, meetings: [] }

        return { success: true, meetings: meetings || [] }
    } catch {
        return { error: 'Unable to fetch pending meetings.', meetings: [] }
    }
}
