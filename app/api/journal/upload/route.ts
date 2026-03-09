import { put, del } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File
        const journalEntryId = formData.get('journalEntryId') as string
        const sectionKey = formData.get('sectionKey') as string || 'daily' // default to 'daily'

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        if (!journalEntryId) {
            return NextResponse.json({ error: 'No journal entry ID provided' }, { status: 400 })
        }

        // Verify the journal entry belongs to this user
        const { data: entry, error: entryError } = await supabase
            .from('prayer_journal')
            .select('id, user_id')
            .eq('id', journalEntryId)
            .single()

        if (entryError || !entry || entry.user_id !== user.id) {
            return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 })
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
        }

        // Determine file type
        const isImage = file.type.startsWith('image/')
        const isAudio = file.type.startsWith('audio/')
        const fileType = isImage ? 'image' : isAudio ? 'audio' : 'file'

        // Upload to Vercel Blob with private access
        const blob = await put(`journal/${user.id}/${journalEntryId}/${Date.now()}-${file.name}`, file, {
            access: 'private',
        })

        // Save attachment record to database - store pathname for private blob access
        const { data: attachment, error: attachError } = await supabase
            .from('journal_attachments')
            .insert({
                journal_entry_id: journalEntryId,
                user_id: user.id,
                url: blob.pathname, // Store pathname, not URL, for private blobs
                filename: file.name,
                file_type: fileType,
                file_size: file.size,
                section_key: sectionKey,
            })
            .select()
            .single()

        if (attachError) {
            // Clean up blob if database insert fails
            await del(blob.url)
            throw attachError
        }

        return NextResponse.json({
            attachment: {
                ...attachment,
            }
        })
    } catch (error) {
        console.error('Journal upload error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Upload failed'
        // Check for blob token error
        if (errorMessage.includes('No token found') || errorMessage.includes('BLOB_READ_WRITE_TOKEN')) {
            return NextResponse.json({ error: 'Storage not configured. Please check BLOB_READ_WRITE_TOKEN.' }, { status: 500 })
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get attachmentId from query params (not JSON body)
        const { searchParams } = new URL(request.url)
        const attachmentId = searchParams.get('attachmentId')

        if (!attachmentId) {
            return NextResponse.json({ error: 'No attachment ID provided' }, { status: 400 })
        }

        // Get and verify the attachment belongs to this user
        const { data: attachment, error: fetchError } = await supabase
            .from('journal_attachments')
            .select('*')
            .eq('id', attachmentId)
            .eq('user_id', user.id)
            .single()

        if (fetchError || !attachment) {
            return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
        }

        // Delete from Vercel Blob - attachment.url stores the pathname
        // For private blobs, we need to construct the full URL or use the pathname
        try {
            await del(attachment.url)
        } catch {
            // Blob may already be deleted or pathname format issue - continue with DB cleanup
        }

        // Delete from database
        const { error: deleteError } = await supabase
            .from('journal_attachments')
            .delete()
            .eq('id', attachmentId)

        if (deleteError) {
            throw deleteError
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Journal attachment delete error:', error)
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    }
}
