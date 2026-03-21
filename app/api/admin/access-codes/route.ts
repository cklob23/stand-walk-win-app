import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check admin status
    const { data: profile } = await supabase
        .from('profiles')
        .select('admin_role, organization_id')
        .eq('id', user.id)
        .single()

    if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const orgId = searchParams.get('orgId')

    // Master admins can see all, org admins can only see their org's codes
    let query = supabase
        .from('access_codes')
        .select(`
      *,
      user_profile:profiles!access_codes_claimed_by_fkey(
        full_name,
        email
      )
    `)
        .order('created_at', { ascending: false })

    if (profile.admin_role === 'master_admin') {
        // Master admin can filter by org or see all
        if (orgId) {
            query = query.eq('organization_id', orgId)
        }
    } else if (profile.admin_role === 'org_admin') {
        // Org admin can only see their organization's codes
        if (!profile.organization_id) {
            return NextResponse.json({ error: 'No organization assigned' }, { status: 403 })
        }
        query = query.eq('organization_id', profile.organization_id)
    } else {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { data: accessCodes, error } = await query

    if (error) {
        console.error('Error fetching access codes:', error)
        return NextResponse.json({ error: 'Failed to fetch access codes' }, { status: 500 })
    }

    return NextResponse.json({ accessCodes })
}
