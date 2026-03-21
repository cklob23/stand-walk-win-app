import { redirect, notFound } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Key, CheckCircle } from 'lucide-react'
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

    // Get existing access codes count
    const { count: existingCodesCount } = await supabase
        .from('access_codes')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)

    return { org, existingCodesCount: existingCodesCount || 0 }
}

async function generateAccessCodes(formData: FormData): Promise<void> {
    'use server'

    const orgId = formData.get('orgId') as string
    const count = parseInt(formData.get('count') as string) || 1
    const tierId = formData.get('tierId') as string

    const supabase = createAdminClient()

    // Generate unique codes
    const codes = []
    for (let i = 0; i < count; i++) {
        const code = `SWR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        codes.push({
            code,
            organization_id: orgId,
            tier_id: tierId || null,
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

    const { org, existingCodesCount } = data
    const subscription = Array.isArray(org.subscription) ? org.subscription[0] : org.subscription
    const maxLicenses = subscription?.license_count || org.max_users || 10

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
                            <span className="text-muted-foreground">Existing Codes</span>
                            <span className="font-bold">{existingCodesCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">License Limit</span>
                            <span className="font-bold">{maxLicenses}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Subscription Tier</span>
                            <Badge>{subscription?.tier?.display_name || 'None'}</Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Generate Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Key className="h-5 w-5" />
                            Generate New Codes
                        </CardTitle>
                        <CardDescription>
                            Create access codes that can be distributed to organization members
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={generateAccessCodes} className="space-y-4">
                            <input type="hidden" name="orgId" value={id} />
                            <input type="hidden" name="tierId" value={subscription?.tier_id || ''} />

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
                                <Key className="mr-2 h-4 w-4" />
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
