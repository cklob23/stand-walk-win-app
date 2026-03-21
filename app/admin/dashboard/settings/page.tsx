import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Building2, Mail, Calendar, Shield } from 'lucide-react'
import { OrgSettings } from '@/components/admin/org-settings'
import { createAdminClient } from '@/lib/supabase/server'

// Map admin_role values to display names
const ROLE_DISPLAY_NAMES: Record<string, string> = {
    'org_admin': 'Organization Admin',
    'master_admin': 'Master Admin',
}

export default async function AdminSettingsPage() {
    const adminData = await getAdminUser()

    if (!adminData) {
        redirect('/admin/login')
    }

    const { user, profile, isMasterAdmin, organization } = adminData

    if (isMasterAdmin) {
        redirect('/admin/dashboard')
    }

    if (!organization) {
        redirect('/admin/dashboard')
    }

    // Fetch branding data for the organization
    const supabase = createAdminClient()
    const { data: branding } = await supabase
        .from('organizations')
        .select('branding_logo_url, branding_church_name, branding_slogan, branding_primary_color, branding_secondary_color')
        .eq('id', organization.id)
        .single()

    const initialBranding = {
        logo_url: branding?.branding_logo_url || null,
        church_name: branding?.branding_church_name || null,
        slogan: branding?.branding_slogan || null,
        primary_color: branding?.branding_primary_color || null,
        secondary_color: branding?.branding_secondary_color || null,
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your organization and account settings
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Organization Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Organization
                        </CardTitle>
                        <CardDescription>
                            Your organization details
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Organization Name</Label>
                            <Input value={organization.name} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Organization ID</Label>
                            <Input value={organization.slug || organization.id} disabled className="font-mono text-sm" />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <Badge className={organization.is_active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}>
                                {organization.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Max Users</span>
                            <span className="font-medium">{organization.max_users || 'Unlimited'}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Admin Account */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Admin Account
                        </CardTitle>
                        <CardDescription>
                            Your admin account details
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input value={profile?.full_name || 'Not set'} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input value={user?.email || ''} disabled />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-sm text-muted-foreground">Role</span>
                            <Badge>{ROLE_DISPLAY_NAMES[profile?.admin_role || 'org_admin'] || profile?.admin_role}</Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Contact Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5" />
                            Contact Information
                        </CardTitle>
                        <CardDescription>
                            Organization contact details
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Admin Email</Label>
                            <Input value={organization.admin_email || user?.email || ''} disabled />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            This email is used for important notifications about your organization.
                        </p>
                    </CardContent>
                </Card>

                {/* Account Dates */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Account History
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Organization Created</span>
                            <span className="font-medium">
                                {new Date(organization.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Account Created</span>
                            <span className="font-medium">
                                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Branding Settings */}
            <div className="pt-4 border-t">
                <h2 className="text-xl font-semibold mb-4">Branding & Customization</h2>
                <OrgSettings
                    organizationId={organization.id}
                    organizationName={organization.name}
                    initialBranding={initialBranding}
                />
            </div>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
                <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>
                        Irreversible actions that affect your organization
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Transfer Ownership</p>
                            <p className="text-sm text-muted-foreground">
                                Transfer admin rights to another team member
                            </p>
                        </div>
                        <Button variant="outline" disabled>
                            Transfer
                        </Button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Delete Organization</p>
                            <p className="text-sm text-muted-foreground">
                                Permanently delete this organization and all data
                            </p>
                        </div>
                        <Button variant="destructive" disabled>
                            Delete
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        These features are coming soon. Contact support for assistance.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
