import { redirect, notFound } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Ticket, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'

async function getOrganization(orgId: string) {
    const supabase = createAdminClient()

    const { data: org, error } = await supabase
        .from('organizations')
        .select(`
      *,
      subscription:subscriptions(
        id,
        tier_id,
        license_count,
        tier:subscription_tiers(id, name, display_name)
      )
    `)
        .eq('id', orgId)
        .single()

    if (error || !org) {
        return null
    }

    // Get existing access codes with status breakdown
    const { data: accessCodes } = await supabase
        .from('access_codes')
        .select('id, status')
        .eq('organization_id', orgId)

    const existingCodesCount = accessCodes?.length || 0
    const availableCodes = accessCodes?.filter(c => c.status === 'available').length || 0
    const claimedCodes = accessCodes?.filter(c => c.status === 'claimed').length || 0

    // Get all available subscription tiers for the dropdown
    const { data: allTiers } = await supabase
        .from('subscription_tiers')
        .select('id, name, display_name')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

    // Get all available journeys for the dropdown
    const { data: allJourneys } = await supabase
        .from('journeys')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name', { ascending: true })

    return {
        org,
        existingCodesCount,
        availableCodes,
        claimedCodes,
        allTiers: allTiers || [],
        allJourneys: allJourneys || []
    }
}

// Generate a random alphanumeric code (8 uppercase chars, no dashes)
function generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Excluding confusing chars like 0, O, I, 1
    let code = ''
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

async function generateAccessCodes(formData: FormData): Promise<void> {
    'use server'

    const orgId = formData.get('orgId') as string
    const count = parseInt(formData.get('count') as string) || 1
    const tierId = formData.get('tierId') as string
    const journeyId = formData.get('journeyId') as string

    const supabase = createAdminClient()

    // Generate unique codes with format matching existing codes (8 uppercase alphanumeric)
    const codes = []
    for (let i = 0; i < count; i++) {
        const code = generateCode()
        codes.push({
            code,
            organization_id: orgId,
            tier_id: tierId || null,
            journey_id: journeyId || null,
            status: 'available',
            created_at: new Date().toISOString(),
        })
    }

    const { error } = await supabase
        .from('access_codes')
        .insert(codes)

    if (error) {
        console.error('Error generating codes:', error)
    }

    revalidatePath(`/admin/dashboard/organizations/${orgId}`)
    revalidatePath(`/admin/dashboard/organizations/${orgId}/generate-codes`)

    // Redirect back to the organization page after generating
    redirect(`/admin/dashboard/organizations/${orgId}`)
}

export default async function GenerateCodesPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const adminData = await getAdminUser()

    if (!adminData) {
        redirect('/admin/login')
    }

    if (!adminData.isMasterAdmin) {
        redirect('/admin/dashboard')
    }

    const data = await getOrganization(id)

    if (!data) {
        notFound()
    }

    const { org, existingCodesCount, availableCodes, claimedCodes, allTiers, allJourneys } = data
    const subscriptions = Array.isArray(org.subscription) ? org.subscription : org.subscription ? [org.subscription] : []
    const totalLicenses = subscriptions.reduce((sum: number, sub: any) => sum + (sub?.license_count || 0), 0)
    const defaultTier = subscriptions[0]?.tier

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/dashboard/organizations/${id}`}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Generate Access Codes</h1>
                    <p className="text-muted-foreground">Create new access codes for {org.name}</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Code Stats */}
                <Card>
                    <CardHeader>
                        <CardTitle>Current Status</CardTitle>
                        <CardDescription>Access code allocation for this organization</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Total Codes</span>
                            <span className="font-bold">{existingCodesCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Available</span>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                {availableCodes}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Claimed</span>
                            <Badge variant="secondary">
                                {claimedCodes}
                            </Badge>
                        </div>
                        <div className="pt-2 border-t">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Total Licenses</span>
                                <span className="font-bold">{totalLicenses}</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Subscription Plans</span>
                            <div className="flex flex-wrap gap-1 justify-end">
                                {subscriptions.length > 0 ? (
                                    subscriptions.map((sub: any, i: number) => (
                                        <Badge key={i} variant="outline">
                                            {sub?.tier?.display_name || 'Unknown'} ({sub?.license_count || 0})
                                        </Badge>
                                    ))
                                ) : (
                                    <span className="text-muted-foreground text-sm">None</span>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Generate Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Ticket className="h-5 w-5" />
                            Generate New Codes
                        </CardTitle>
                        <CardDescription>
                            Create access codes that can be distributed to organization members
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={generateAccessCodes} className="space-y-4">
                            <input type="hidden" name="orgId" value={id} />

                            <div className="space-y-2">
                                <label htmlFor="tierId" className="text-sm font-medium">
                                    Subscription Tier
                                </label>
                                <select
                                    name="tierId"
                                    id="tierId"
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    defaultValue={defaultTier?.id || ''}
                                    required
                                >
                                    <option value="" disabled>Select a tier...</option>
                                    {allTiers.map((tier: any) => (
                                        <option key={tier.id} value={tier.id}>
                                            {tier.display_name || tier.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    Users who redeem these codes will get this subscription tier
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="journeyId" className="text-sm font-medium">
                                    Journey (Optional)
                                </label>
                                <select
                                    name="journeyId"
                                    id="journeyId"
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    defaultValue=""
                                >
                                    <option value="">No specific journey</option>
                                    {allJourneys.map((journey: any) => (
                                        <option key={journey.id} value={journey.id}>
                                            {journey.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    Optionally assign a specific journey to these access codes
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="count" className="text-sm font-medium">
                                    Number of Codes
                                </label>
                                <select
                                    name="count"
                                    id="count"
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    defaultValue="1"
                                >
                                    <option value="1">1 code</option>
                                    <option value="5">5 codes</option>
                                    <option value="10">10 codes</option>
                                    <option value="25">25 codes</option>
                                    <option value="50">50 codes</option>
                                </select>
                            </div>

                            <Button type="submit" className="w-full">
                                <Ticket className="mr-2 h-4 w-4" />
                                Generate Codes
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Success Info */}
            <Card>
                <CardContent className="flex items-start gap-4 py-4">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                        <p className="font-medium">How it works</p>
                        <p className="text-sm text-muted-foreground">
                            Generated codes will be automatically linked to this organization.
                            Members who sign up with these codes will be added to {org.name} and
                            inherit the organization&apos;s subscription tier.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button variant="outline" asChild>
                    <Link href={`/admin/dashboard/organizations/${id}`}>
                        Back to Organization
                    </Link>
                </Button>
            </div>
        </div>
    )
}
