import { put, del } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Check authentication
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is an org admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, admin_role')
            .eq('id', user.id)
            .single()

        if (!profile?.organization_id || profile.admin_role !== 'org_admin') {
            return NextResponse.json({ error: 'Only org admins can upload logos' }, { status: 403 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type. Use PNG, JPEG, SVG, or WebP.' }, { status: 400 })
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large. Max 2MB.' }, { status: 400 })
        }

        // Get current logo to delete later
        const { data: org } = await supabase
            .from('organizations')
            .select('branding_logo_url')
            .eq('id', profile.organization_id)
            .single()

        // Upload new logo (private access - served via /api/logo route)
        const filename = `org-logos/${profile.organization_id}/${Date.now()}-${file.name}`
        const blob = await put(filename, file, {
            access: 'private',
        })

        // Update organization with the pathname (not the URL, since it's private)
        const { error: updateError } = await supabase
            .from('organizations')
            .update({ branding_logo_url: blob.pathname })
            .eq('id', profile.organization_id)

        if (updateError) {
            // Delete uploaded blob if DB update fails
            await del(blob.url)
            return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
        }

        // Delete old logo if it exists (pathname stored in DB)
        if (org?.branding_logo_url) {
            try {
                await del(org.branding_logo_url)
            } catch {
                // Ignore deletion errors for old logo
            }
        }

        return NextResponse.json({ pathname: blob.pathname })
    } catch (error) {
        console.error('Logo upload error:', error)
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }
}
