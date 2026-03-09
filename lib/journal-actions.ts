'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/lib/notifications'

// ──────────────────────────────────────────
// Save / update the daily questions (prayers + free-text god speaking)
// ──────────────────────────────────────────
export async function saveJournalEntry(data: {
    prayerItems: string
    godSaying: string
    pairingId: string
    localDate?: string // 'yyyy-MM-dd' in user's local timezone
    shareWithLeader?: boolean
}) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        // Use client-provided local date, or fall back to UTC (for backward compat)
        const today = data.localDate || new Date().toISOString().split('T')[0]

        const { data: existing } = await supabase
            .from('prayer_journal')
            .select('id, god_speaking')
            .eq('user_id', user.id)
            .eq('journal_date', today)
            .single()

        let entryId: string

        if (existing) {
            entryId = existing.id
            // Preserve verse entries (sections after the first ---) when updating daily questions
            const sections = (existing.god_speaking || '').split('\n\n---\n\n')
            const verseSections = sections.slice(1) // keep verse entries
            // Always keep freeText at index 0 (may be empty) so verse entries stay at index 1+
            const newGodSpeaking = [data.godSaying.trim(), ...verseSections].join('\n\n---\n\n')

            const { error } = await supabase
                .from('prayer_journal')
                .update({
                    prayer_items: data.prayerItems,
                    god_speaking: newGodSpeaking,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)

            if (error) return { error: error.message }
        } else {
            const { data: inserted, error } = await supabase
                .from('prayer_journal')
                .insert({
                    user_id: user.id,
                    pairing_id: data.pairingId,
                    journal_date: today,
                    prayer_items: data.prayerItems,
                    god_speaking: data.godSaying.trim(),
                    shared_with_leader: data.shareWithLeader ?? false,
                    shared_sections: data.shareWithLeader ? { daily: true } : {},
                    custom_entries: [],
                })
                .select('id')
                .single()

            if (error) return { error: error.message }
            entryId = inserted.id
        }

        revalidatePath('/dashboard')
        revalidatePath('/dashboard/journal')
        return { success: true, entryId }
    } catch {
        return { error: 'Failed to save journal entry.' }
    }
}

// ──────────────────────────────────────────
// Update daily questions only (preserves verse entries in god_speaking)
// ──────────────────────────────────────────
export async function updateJournalEntry(data: {
    entryId: string
    prayerItems: string
    godSaying: string
    pairingId: string
}) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: existing } = await supabase
            .from('prayer_journal')
            .select('god_speaking, shared_with_leader, shared_sections')
            .eq('id', data.entryId)
            .eq('user_id', user.id)
            .single()

        if (!existing) return { error: 'Entry not found' }

        // Preserve verse entries (sections after the first ---)
        const sections = (existing.god_speaking || '').split('\n\n---\n\n')
        const verseSections = sections.slice(1)
        const newGodSpeaking = [data.godSaying.trim(), ...verseSections].filter(Boolean).join('\n\n---\n\n')

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                prayer_items: data.prayerItems,
                god_speaking: newGodSpeaking,
                updated_at: new Date().toISOString(),
            })
            .eq('id', data.entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        // Notify partner if the daily section was shared
        const sharedSections = (existing.shared_sections as Record<string, boolean>) || {}
        if (sharedSections.daily) {
            const { data: pairing } = await supabase
                .from('pairings')
                .select('leader_id, learner_id')
                .eq('id', data.pairingId)
                .single()

            if (pairing) {
                const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single()

                await createNotification({
                    userId: partnerId!,
                    pairingId: data.pairingId,
                    type: 'journal_shared',
                    title: 'Shared Entry Updated',
                    message: `${profile?.full_name || 'Your partner'} updated a journal entry shared with you.`,
                })
            }
        }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to update journal entry.' }
    }
}

// ──────────────────────────────────────────
// Toggle per-section sharing  (key = "daily" | "verse_0" | "custom_0" etc)
// ──────────────────────────────────────────
export async function toggleSectionShare(
    entryId: string,
    sectionKey: string,
    shared: boolean,
    pairingId: string
) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        // Fetch current shared_sections
        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('shared_sections, shared_with_leader')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const sections: Record<string, boolean> = (entry.shared_sections as Record<string, boolean>) || {}
        sections[sectionKey] = shared

        // shared_with_leader is true if ANY section is shared
        const anyShared = Object.values(sections).some(v => v === true)

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                shared_sections: sections,
                shared_with_leader: anyShared,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        // Notify partner when sharing
        if (shared) {
            const { data: pairing } = await supabase
                .from('pairings')
                .select('leader_id, learner_id')
                .eq('id', pairingId)
                .single()

            if (pairing) {
                const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single()

                await createNotification({
                    userId: partnerId!,
                    pairingId,
                    type: 'journal_shared',
                    title: 'Journal Entry Shared',
                    message: `${profile?.full_name || 'Your partner'} shared a journal entry with you.`,
                })
            }
        }

        revalidatePath('/dashboard/journal')
        revalidatePath('/dashboard')

        // When UNSHARING, send a notification so partner's UI refreshes
        if (!shared) {
            const { data: pairing } = await supabase
                .from('pairings')
                .select('leader_id, learner_id')
                .eq('id', pairingId)
                .single()

            if (pairing) {
                const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single()

                await createNotification({
                    userId: partnerId!,
                    pairingId,
                    type: 'journal_shared',
                    title: 'Journal Entry Updated',
                    message: `${profile?.full_name || 'Your partner'} updated a shared journal entry.`,
                })
            }
        }

        return { success: true }
    } catch {
        return { error: 'Failed to update sharing.' }
    }
}

// ──────────────────────────────────────────
// Legacy toggle (kept for backward compat)
// ──────────────────────────────────────────
export async function toggleShareEntry(entryId: string, shared: boolean) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                shared_with_leader: shared,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to update entry.' }
    }
}

// ──────────────────────────────────────────
// Update a verse section in god_speaking (sections split by \n\n---\n\n)
// ──────────────────────────────────────────
export async function updateJournalGodSpeakingSection(
    entryId: string,
    sectionIndex: number,
    newText: string,
    newTitle?: string
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('god_speaking')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const sections = (entry.god_speaking || '').split('\n\n---\n\n')
        if (sectionIndex < 0 || sectionIndex >= sections.length) {
            return { error: 'Section not found' }
        }

        if (newText.trim()) {
            // Reconstruct the section preserving @@TITLE: and @@TIME: headers
            const oldLines = sections[sectionIndex].split('\n')
            const headerLines: string[] = []
            let hasTitle = false
            for (const line of oldLines) {
                if (line.startsWith('@@TITLE: ')) {
                    hasTitle = true
                    headerLines.push(newTitle !== undefined ? `@@TITLE: ${newTitle.trim()}` : line)
                } else if (line.startsWith('@@TIME: ')) {
                    headerLines.push(line)
                }
            }
            // If a new title was provided but there was no existing @@TITLE header, add one
            if (newTitle !== undefined && !hasTitle) {
                headerLines.unshift(`@@TITLE: ${newTitle.trim()}`)
            }
            sections[sectionIndex] = [...headerLines, newText.trim()].join('\n')
        } else {
            sections.splice(sectionIndex, 1)
        }

        // Preserve the structure: sections[0] is freeText (may be empty), rest are verse entries
        // Don't filter(Boolean) because that removes the empty freeText slot, breaking the format
        const updatedGodSpeaking = sections.join('\n\n---\n\n')

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                god_speaking: updatedGodSpeaking,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to update section.' }
    }
}

// ──────────────────────────────────────────
// Custom entries CRUD
// ──────────────────────────────────────────

interface CustomEntry {
    title: string
    content: string
    created_at: string
}

export async function addCustomEntry(
    entryId: string,
    title: string,
    content: string
): Promise<{ success?: boolean; error?: string; createdAt?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('custom_entries')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const createdAt = new Date().toISOString()
        const customs: CustomEntry[] = (entry.custom_entries as CustomEntry[]) || []
        customs.push({
            title: title.trim() || 'My Reflection',
            content: content.trim(),
            created_at: createdAt,
        })

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                custom_entries: customs,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        revalidatePath('/dashboard/journal')
        return { success: true, createdAt }
    } catch {
        return { error: 'Failed to add custom entry.' }
    }
}

export async function updateCustomEntry(
    entryId: string,
    customIndex: number,
    title: string,
    content: string
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('custom_entries')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const customs: CustomEntry[] = (entry.custom_entries as CustomEntry[]) || []
        if (customIndex < 0 || customIndex >= customs.length) return { error: 'Entry not found' }

        customs[customIndex] = {
            ...customs[customIndex],
            title: title.trim() || 'My Reflection',
            content: content.trim(),
        }

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                custom_entries: customs,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to update custom entry.' }
    }
}

export async function deleteCustomEntry(
    entryId: string,
    customIndex: number,
    pairingId?: string,
    customCreatedAt?: string // Use created_at as stable identifier
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('custom_entries, shared_sections, pairing_id')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const customs: CustomEntry[] = (entry.custom_entries as CustomEntry[]) || []
        if (customIndex < 0 || customIndex >= customs.length) return { error: 'Entry not found' }

        // Get the created_at of the entry being deleted (use provided or from array)
        const deletedCreatedAt = customCreatedAt || customs[customIndex]?.created_at

        customs.splice(customIndex, 1)

        // Check if this custom entry was shared (try both timestamp and index-based keys for backward compat)
        const sections: Record<string, boolean> = (entry.shared_sections as Record<string, boolean>) || {}
        const wasShared = sections[`custom_${deletedCreatedAt}`] || sections[`custom_${customIndex}`]

        // Remove both possible keys (timestamp-based and legacy index-based)
        delete sections[`custom_${deletedCreatedAt}`]
        delete sections[`custom_${customIndex}`]

        // No re-indexing needed for timestamp-based keys

        const anyShared = Object.values(sections).some(v => v === true)

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                custom_entries: customs,
                shared_sections: sections,
                shared_with_leader: anyShared,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        // Delete attachments for the deleted custom entry using timestamp-based key
        if (deletedCreatedAt) {
            await supabase
                .from('journal_attachments')
                .delete()
                .eq('journal_entry_id', entryId)
                .eq('section_key', `custom_${deletedCreatedAt}`)
        }

        // Also try to delete any legacy index-based attachments
        await supabase
            .from('journal_attachments')
            .delete()
            .eq('journal_entry_id', entryId)
            .eq('section_key', `custom_${customIndex}`)

        // Notify partner if the deleted entry was shared
        const resolvedPairingId = pairingId || entry.pairing_id
        if (wasShared && resolvedPairingId) {
            const { data: pairing } = await supabase
                .from('pairings')
                .select('leader_id, learner_id')
                .eq('id', resolvedPairingId)
                .single()

            if (pairing) {
                const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single()

                await createNotification({
                    userId: partnerId!,
                    pairingId: resolvedPairingId,
                    type: 'journal_shared',
                    title: 'Shared Entry Updated',
                    message: `${profile?.full_name || 'Your partner'} removed a custom entry that was shared with you.`,
                })
            }
        }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to delete entry.' }
    }
}

// ──────────────────────────────────────────
// Delete entire journal entry (entire day)
// ──────────────────────────────────────────
export async function deleteJournalEntry(
    entryId: string,
    pairingId: string
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        // Check if any section was shared so we can notify partner
        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('shared_with_leader, shared_sections')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const wasShared = entry.shared_with_leader

        // Delete all attachments for this journal entry first
        await supabase
            .from('journal_attachments')
            .delete()
            .eq('journal_entry_id', entryId)

        const { error } = await supabase
            .from('prayer_journal')
            .delete()
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        // Notify partner if anything was shared
        if (wasShared) {
            const { data: pairing } = await supabase
                .from('pairings')
                .select('leader_id, learner_id')
                .eq('id', pairingId)
                .single()

            if (pairing) {
                const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single()

                await createNotification({
                    userId: partnerId!,
                    pairingId,
                    type: 'journal_shared',
                    title: 'Shared Entry Removed',
                    message: `${profile?.full_name || 'Your partner'} removed a previously shared journal entry.`,
                })
            }
        }

        revalidatePath('/dashboard/journal')
        revalidatePath('/dashboard')
        return { success: true }
    } catch {
        return { error: 'Failed to delete journal entry.' }
    }
}

// ──────────────────────────────────────────
// Delete a verse section from god_speaking
// ──────────────────────────────────────────
export async function deleteVerseEntry(
    entryId: string,
    sectionIndex: number,
    pairingId: string
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('god_speaking, shared_sections, shared_with_leader')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const sections = (entry.god_speaking || '').split('\n\n---\n\n')
        if (sectionIndex < 0 || sectionIndex >= sections.length) {
            return { error: 'Section not found' }
        }

        // Check if this verse section was shared
        const sharedSections: Record<string, boolean> = (entry.shared_sections as Record<string, boolean>) || {}
        const verseIdx = sectionIndex - 1 // verse_0 corresponds to section index 1
        const wasShared = sharedSections[`verse_${verseIdx}`]

        // Remove the section (preserve empty freeText slot at index 0)
        sections.splice(sectionIndex, 1)
        const updatedGodSpeaking = sections.join('\n\n---\n\n')

        // Re-index verse shared_sections
        const newSections: Record<string, boolean> = {}
        for (const [key, val] of Object.entries(sharedSections)) {
            if (key.startsWith('verse_')) {
                const idx = parseInt(key.split('_')[1])
                if (idx === verseIdx) continue // skip the deleted one
                if (idx > verseIdx) {
                    newSections[`verse_${idx - 1}`] = val
                } else {
                    newSections[key] = val
                }
            } else {
                newSections[key] = val
            }
        }

        const anyShared = Object.values(newSections).some(v => v === true)

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                god_speaking: updatedGodSpeaking,
                shared_sections: newSections,
                shared_with_leader: anyShared,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        // Handle attachments: delete attachments for the deleted verse entry
        // and re-index remaining verse attachments' section_keys
        const deletedSectionKey = `verse_${verseIdx}`

        // Delete attachments for the deleted verse entry
        await supabase
            .from('journal_attachments')
            .delete()
            .eq('journal_entry_id', entryId)
            .eq('section_key', deletedSectionKey)

        // Get all remaining verse attachments that need re-indexing
        const { data: attachmentsToReindex } = await supabase
            .from('journal_attachments')
            .select('id, section_key')
            .eq('journal_entry_id', entryId)
            .like('section_key', 'verse_%')

        // Re-index attachments with higher indices
        if (attachmentsToReindex) {
            for (const att of attachmentsToReindex) {
                const match = att.section_key.match(/^verse_(\d+)$/)
                if (match) {
                    const idx = parseInt(match[1])
                    if (idx > verseIdx) {
                        await supabase
                            .from('journal_attachments')
                            .update({ section_key: `verse_${idx - 1}` })
                            .eq('id', att.id)
                    }
                }
            }
        }

        // Notify partner if was shared
        if (wasShared) {
            const { data: pairing } = await supabase
                .from('pairings')
                .select('leader_id, learner_id')
                .eq('id', pairingId)
                .single()

            if (pairing) {
                const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single()

                await createNotification({
                    userId: partnerId!,
                    pairingId,
                    type: 'journal_shared',
                    title: 'Shared Entry Updated',
                    message: `${profile?.full_name || 'Your partner'} removed a section from a shared journal entry.`,
                })
            }
        }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to delete verse entry.' }
    }
}

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

export async function hasTodayEntry(userId: string, localDate?: string): Promise<boolean> {
    const supabase = await createClient()
    const today = localDate || new Date().toISOString().split('T')[0]
    const { data } = await supabase
        .from('prayer_journal')
        .select('id')
        .eq('user_id', userId)
        .eq('journal_date', today)
        .limit(1)
    return (data?.length ?? 0) > 0
}

export async function getTodayEntry(userId: string, localDate?: string) {
    const supabase = await createClient()
    const today = localDate || new Date().toISOString().split('T')[0]
    const { data } = await supabase
        .from('prayer_journal')
        .select('*')
        .eq('user_id', userId)
        .eq('journal_date', today)
        .single()

    if (!data) return null

    // Fetch attachments for this entry
    const { data: attachments } = await supabase
        .from('journal_attachments')
        .select('*')
        .eq('journal_entry_id', data.id)

    return {
        ...data,
        attachments: attachments || [],
    }
}

export async function requestJournalMeeting(
    entryId: string,
    entryDateLabel: string
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('pairing_id, user_id')
            .eq('id', entryId)
            .single()

        if (!entry) return { error: 'Journal entry not found' }

        const { data: leaderProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()

        await createNotification({
            userId: entry.user_id,
            pairingId: entry.pairing_id,
            type: 'pairing',
            title: 'Meeting Requested',
            message: `${leaderProfile?.full_name || 'Your leader'} would like to schedule a meeting to discuss your journal entry from ${entryDateLabel}. Head to the Schedule page to pick a time.`,
        })

        return { success: true }
    } catch {
        return { error: 'Failed to send meeting request.' }
    }
}

// ──────────────────────────────────────────
// Save assignment response to prayer journal
// ──────────────────────────────────────────
export async function saveAssignmentToJournal(
    pairingId: string,
    assignmentTitle: string,
    assignmentType: string,
    responseText: string,
    customTitle?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    const typeLabel = assignmentType.charAt(0).toUpperCase() + assignmentType.slice(1)
    const title = customTitle?.trim() || `${typeLabel}: ${assignmentTitle}`
    const friendlyTime = new Date(now).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    })

    const noteContent = `@@TITLE: ${title}\n@@TIME: ${friendlyTime}\n${responseText.trim()}`

    const { data: existing } = await supabase
        .from('prayer_journal')
        .select('id, god_speaking')
        .eq('user_id', user.id)
        .eq('journal_date', today)
        .single()

    if (existing) {
        const updatedGodSpeaking = existing.god_speaking
            ? `${existing.god_speaking}\n\n---\n\n${noteContent}`
            : `\n\n---\n\n${noteContent}`

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                god_speaking: updatedGodSpeaking,
                updated_at: now,
            })
            .eq('id', existing.id)

        if (error) return { success: false, error: error.message }
    } else {
        const { error } = await supabase
            .from('prayer_journal')
            .insert({
                user_id: user.id,
                pairing_id: pairingId,
                journal_date: today,
                prayer_items: '',
                god_speaking: `\n\n---\n\n${noteContent}`,
                shared_with_leader: false,
                shared_sections: {},
                custom_entries: [],
            })

        if (error) return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/journal')
    return { success: true }
}

// ──────────────────────────────────────────
// Reply to a shared journal item
// ──────────────────────────────────────────
export async function replyToSharedItem(
    itemId: string,
    replyText: string,
    pairingId: string,
    senderName: string
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        if (!replyText.trim()) return { error: 'Reply cannot be empty' }

        // Check if this is a DB shared_item (UUID) or a computed journal item (journal-*)
        const isJournalItem = itemId.startsWith('journal-')

        if (isJournalItem) {
            // For journal-based shared items, we store the reply on the prayer_journal entry
            // Format: journal-daily-{entryId}, journal-verse-{entryId}-{idx}, journal-custom-{entryId}-{idx}
            const parts = itemId.split('-')
            let entryId: string | null = null
            if (parts[1] === 'daily') {
                entryId = parts.slice(2).join('-')
            } else if (parts[1] === 'verse' || parts[1] === 'custom') {
                // journal-verse-{uuid}-{idx} or journal-custom-{uuid}-{idx}
                entryId = parts.slice(2, -1).join('-')
            }

            if (!entryId) return { error: 'Invalid item reference' }

            // Use admin client to update partner's entry (bypass RLS)
            const { createAdminClient } = await import('@/lib/supabase/server')
            const adminSupabase = createAdminClient()

            const { error } = await adminSupabase
                .from('prayer_journal')
                .update({
                    partner_reply: replyText.trim(),
                    partner_reply_by: user.id,
                    partner_reply_at: new Date().toISOString(),
                })
                .eq('id', entryId)

            if (error) return { error: error.message }

            // Get original entry owner for notification
            const { data: entry } = await adminSupabase
                .from('prayer_journal')
                .select('user_id')
                .eq('id', entryId)
                .single()

            if (entry) {
                await createNotification({
                    userId: entry.user_id,
                    pairingId,
                    type: 'journal_shared',
                    title: 'Reply to Your Journal',
                    message: `${senderName} replied to your shared journal entry.`,
                })
            }
        } else {
            // DB shared_item -- update directly
            const { error } = await supabase
                .from('shared_items')
                .update({
                    reply_text: replyText.trim(),
                    reply_sender_id: user.id,
                    replied_at: new Date().toISOString(),
                })
                .eq('id', itemId)
                .eq('recipient_id', user.id)

            if (error) return { error: error.message }

            // Get the sender for notification
            const { data: item } = await supabase
                .from('shared_items')
                .select('sender_id')
                .eq('id', itemId)
                .single()

            if (item) {
                await createNotification({
                    userId: item.sender_id,
                    pairingId,
                    type: 'journal_shared',
                    title: 'Reply to Your Shared Item',
                    message: `${senderName} replied to something you shared.`,
                })
            }
        }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to send reply.' }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Journal Attachments
// ─────────────────────────────────────────────────────────────────────────────

export interface JournalAttachment {
    id: string
    journal_entry_id: string
    user_id: string
    url: string
    filename: string
    file_type: 'image' | 'audio' | 'file'
    file_size: number
    section_key: string
    created_at: string
}

export async function getAttachmentsForEntry(entryId: string): Promise<JournalAttachment[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
        .from('journal_attachments')
        .select('*')
        .eq('journal_entry_id', entryId)
        .order('created_at', { ascending: true })

    return data || []
}

// ─────────────────────────────────────────────────────────────────────────────
// Journal Reactions (for shared entries)
// ─────────────────────────────────────────────────────────────────────────────

export interface JournalReaction {
    id: string
    journal_entry_id: string
    user_id: string
    emoji: string
    section_key: string
    created_at: string
}

export async function toggleJournalReaction(
    entryId: string,
    emoji: string,
    sectionKey: string = 'daily'
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    try {
        // Check if reaction already exists for this section
        const { data: existing } = await supabase
            .from('journal_reactions')
            .select('id')
            .eq('journal_entry_id', entryId)
            .eq('user_id', user.id)
            .eq('emoji', emoji)
            .eq('section_key', sectionKey)
            .single()

        if (existing) {
            // Remove reaction
            await supabase
                .from('journal_reactions')
                .delete()
                .eq('id', existing.id)
        } else {
            // Add reaction
            const { error: insertError } = await supabase
                .from('journal_reactions')
                .insert({
                    journal_entry_id: entryId,
                    user_id: user.id,
                    emoji,
                    section_key: sectionKey,
                })

            if (insertError) {
                return { success: false, error: 'Failed to add reaction' }
            }

            // Send notification to the journal entry owner
            const { data: entry } = await supabase
                .from('prayer_journal')
                .select('user_id, pairing_id')
                .eq('id', entryId)
                .single()

            if (entry && entry.user_id !== user.id) {
                // Get current user's name
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single()

                const { notifyJournalReaction } = await import('@/lib/notifications')
                await notifyJournalReaction(
                    entry.user_id,
                    profile?.full_name || 'Your partner',
                    entry.pairing_id,
                    emoji
                )
            }
        }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { success: false, error: 'Failed to toggle reaction' }
    }
}

export async function getReactionsForEntry(entryId: string, sectionKey?: string): Promise<JournalReaction[]> {
    const supabase = await createClient()

    let query = supabase
        .from('journal_reactions')
        .select('*')
        .eq('journal_entry_id', entryId)

    if (sectionKey) {
        query = query.eq('section_key', sectionKey)
    }

    const { data } = await query.order('created_at', { ascending: true })

    return data || []
}
