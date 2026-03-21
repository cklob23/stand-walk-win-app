'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/lib/notifications'

// ──────────────────────────────────────────
// Assignment Reactions
// ──────────────────────────────────────────

export interface AssignmentReaction {
    id: string
    assignment_progress_id: string
    user_id: string
    emoji: string
    created_at: string
}

export async function toggleAssignmentReaction(
    progressId: string,
    emoji: string,
    pairingId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    try {
        // Check if reaction already exists
        const { data: existing } = await supabase
            .from('assignment_reactions')
            .select('id')
            .eq('assignment_progress_id', progressId)
            .eq('user_id', user.id)
            .eq('emoji', emoji)
            .single()

        if (existing) {
            // Remove reaction
            await supabase
                .from('assignment_reactions')
                .delete()
                .eq('id', existing.id)
        } else {
            // Add reaction
            const { error: insertError } = await supabase
                .from('assignment_reactions')
                .insert({
                    assignment_progress_id: progressId,
                    user_id: user.id,
                    emoji,
                })

            if (insertError) {
                return { success: false, error: 'Failed to add reaction' }
            }

            // Send notification to the assignment owner (learner)
            const adminSupabase = createAdminClient()
            const { data: progress } = await adminSupabase
                .from('assignment_progress')
                .select('user_id, assignment_id, assignment:assignments(week_number)')
                .eq('id', progressId)
                .single()

            if (progress && progress.user_id !== user.id) {
                // Get current user's name
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single()

                const weekNumber = (progress.assignment as { week_number?: number } | null)?.week_number ?? null

                await createNotification({
                    userId: progress.user_id,
                    pairingId,
                    type: 'assignment_reaction',
                    title: 'Reaction to Your Response',
                    message: `${profile?.full_name || 'Your leader'} reacted ${emoji} to your assignment response.`,
                    metadata: progress.assignment_id ? { assignmentId: progress.assignment_id, weekNumber } : undefined,
                })
            }
        }

        revalidatePath('/dashboard')
        return { success: true }
    } catch {
        return { success: false, error: 'Failed to toggle reaction' }
    }
}

export async function getReactionsForProgress(progressId: string): Promise<AssignmentReaction[]> {
    const supabase = await createClient()

    const { data } = await supabase
        .from('assignment_reactions')
        .select('*')
        .eq('assignment_progress_id', progressId)
        .order('created_at', { ascending: true })

    return data || []
}

// ──────────────────────────────────────────
// Assignment Reply (Leader reply to learner response)
// ──────────────────────────────────────────

export async function replyToAssignment(
    progressId: string,
    replyText: string,
    pairingId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (!replyText.trim()) return { success: false, error: 'Reply cannot be empty' }

    try {
        // Use admin client to update (bypass RLS since leader may not own this record)
        const adminSupabase = createAdminClient()

        const { error } = await adminSupabase
            .from('assignment_progress')
            .update({
                leader_reply: replyText.trim(),
                leader_reply_at: new Date().toISOString(),
            })
            .eq('id', progressId)

        if (error) return { success: false, error: error.message }

        // Get the assignment info and learner for notification
        const { data: progress } = await adminSupabase
            .from('assignment_progress')
            .select('user_id, assignment_id')
            .eq('id', progressId)
            .single()

        if (progress && progress.user_id !== user.id) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single()

            // Get assignment title
            let assignmentTitle = 'your assignment'
            let weekNumber: number | null = null
            if (progress.assignment_id) {
                const { data: assignment } = await adminSupabase
                    .from('assignments')
                    .select('title, week_number')
                    .eq('id', progress.assignment_id)
                    .single()
                if (assignment?.title) {
                    assignmentTitle = assignment.title
                }
                if (assignment?.week_number) {
                    weekNumber = assignment.week_number
                }
            }

            await createNotification({
                userId: progress.user_id,
                pairingId,
                type: 'assignment_reply',
                title: 'Reply to Your Response',
                message: `${profile?.full_name || 'Your leader'} replied to your response on "${assignmentTitle}".`,
                metadata: progress.assignment_id ? { assignmentId: progress.assignment_id, weekNumber } : undefined,
            })
        }

        revalidatePath('/dashboard')
        return { success: true }
    } catch {
        return { success: false, error: 'Failed to send reply' }
    }
}

export async function deleteAssignmentReply(
    progressId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    try {
        const adminSupabase = createAdminClient()

        const { error } = await adminSupabase
            .from('assignment_progress')
            .update({
                leader_reply: null,
                leader_reply_at: null,
            })
            .eq('id', progressId)

        if (error) return { success: false, error: error.message }

        revalidatePath('/dashboard')
        return { success: true }
    } catch {
        return { success: false, error: 'Failed to delete reply' }
    }
}
