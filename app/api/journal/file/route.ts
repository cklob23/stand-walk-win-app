import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { get } from '@vercel/blob'

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const attachmentId = request.nextUrl.searchParams.get('id')

        if (!attachmentId) {
            return NextResponse.json({ error: 'Missing attachment ID' }, { status: 400 })
        }

        // Get attachment and verify access
        const { data: attachment, error } = await supabase
            .from('journal_attachments')
            .select(`
        *,
        prayer_journal!inner (
          id,
          user_id,
          shared_with_leader,
          pairing_id
        )
      `)
            .eq('id', attachmentId)
            .single()

        if (error || !attachment) {
            return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
        }

        // Check if user has access (owner or partner with shared entry)
        const entry = attachment.prayer_journal
        const isOwner = entry.user_id === user.id

        let hasAccess = isOwner
        if (!isOwner && entry.shared_with_leader) {
            // Check if user is the partner in the same pairing
            const { data: pairing } = await supabase
                .from('pairings')
                .select('id')
                .eq('id', entry.pairing_id)
                .or(`leader_id.eq.${user.id},learner_id.eq.${user.id}`)
                .single()

            hasAccess = !!pairing
        }

        if (!hasAccess) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 })
        }

        // Use get() for private blob access
        const result = await get(attachment.url, {
            access: 'private',
            ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
        })

        if (!result) {
            return new NextResponse('File not found', { status: 404 })
        }

        // Blob hasn't changed - tell the browser to use its cached copy
        if (result.statusCode === 304) {
            return new NextResponse(null, {
                status: 304,
                headers: {
                    ETag: result.blob.etag,
                    'Cache-Control': 'private, no-cache',
                },
            })
        }

        return new NextResponse(result.stream, {
            headers: {
                'Content-Type': result.blob.contentType,
                'Content-Disposition': `inline; filename="${attachment.filename}"`,
                ETag: result.blob.etag,
                'Cache-Control': 'private, no-cache',
            },
        })
    } catch (error) {
        console.error('Error serving journal file:', error)
        return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
    }
}
