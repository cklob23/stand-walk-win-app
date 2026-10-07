'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Loader2, Pencil } from 'lucide-react'
import { updateOrganizationRecord, type OrgFormOptions } from '@/app/actions/admin-org-actions'
import { useRouter } from 'next/navigation'

interface EditOrganizationDialogProps {
    organization: {
        id: string
        name: string
        admin_email?: string | null
        description?: string | null
        max_users?: number | null
        subscription_tier_id?: string | null
        is_active?: boolean | null
    }
    options: OrgFormOptions
    triggerLabel?: string
}

export function EditOrganizationDialog({
    organization,
    options,
    triggerLabel,
}: EditOrganizationDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [name, setName] = useState(organization.name)
    const [adminEmail, setAdminEmail] = useState(organization.admin_email || '')
    const [description, setDescription] = useState(organization.description || '')
    const [maxUsers, setMaxUsers] = useState(String(organization.max_users || 10))
    const [tierId, setTierId] = useState(organization.subscription_tier_id || 'none')
    const [isActive, setIsActive] = useState(organization.is_active === false ? 'inactive' : 'active')
    const router = useRouter()

    const syncFromOrganization = () => {
        setName(organization.name)
        setAdminEmail(organization.admin_email || '')
        setDescription(organization.description || '')
        setMaxUsers(String(organization.max_users || 10))
        setTierId(organization.subscription_tier_id || 'none')
        setIsActive(organization.is_active === false ? 'inactive' : 'active')
        setError(null)
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setIsSaving(true)
        setError(null)

        const result = await updateOrganizationRecord({
            organizationId: organization.id,
            name,
            adminEmail: adminEmail.trim() || null,
            description: description.trim() || null,
            maxUsers: parseInt(maxUsers, 10) || 10,
            subscriptionTierId: tierId === 'none' ? null : tierId,
            isActive: isActive === 'active',
        })

        if (result.error) {
            setError(result.error)
            setIsSaving(false)
            return
        }

        setIsOpen(false)
        setIsSaving(false)
        router.refresh()
    }

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open)
                if (open) {
                    syncFromOrganization()
                } else {
                    setIsSaving(false)
                    setError(null)
                }
            }}
        >
            <DialogTrigger asChild>
                {triggerLabel ? (
                    <Button variant="outline" size="sm">
                        <Pencil className="mr-2 h-4 w-4" />
                        {triggerLabel}
                    </Button>
                ) : (
                    <Button variant="ghost" size="sm" title="Edit organization">
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit Organization</DialogTitle>
                    <DialogDescription>
                        Update this organization. Deactivating hides it from normal use without deleting members.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor={`edit-org-name-${organization.id}`}>Organization name</Label>
                        <Input
                            id={`edit-org-name-${organization.id}`}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`edit-org-email-${organization.id}`}>Admin email</Label>
                        <Input
                            id={`edit-org-email-${organization.id}`}
                            type="email"
                            value={adminEmail}
                            onChange={(event) => setAdminEmail(event.target.value)}
                            placeholder="admin@example.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`edit-org-description-${organization.id}`}>Description</Label>
                        <Textarea
                            id={`edit-org-description-${organization.id}`}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            rows={2}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`edit-org-max-${organization.id}`}>Max members</Label>
                        <Input
                            id={`edit-org-max-${organization.id}`}
                            type="number"
                            min={1}
                            value={maxUsers}
                            onChange={(event) => setMaxUsers(event.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`edit-org-tier-${organization.id}`}>Default plan</Label>
                        <Select value={tierId} onValueChange={setTierId}>
                            <SelectTrigger id={`edit-org-tier-${organization.id}`} className="w-full">
                                <SelectValue placeholder="No default plan" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No default plan</SelectItem>
                                {options.tiers.map((tier) => (
                                    <SelectItem key={tier.id} value={tier.id}>
                                        {tier.display_name || tier.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`edit-org-status-${organization.id}`}>Status</Label>
                        <Select value={isActive} onValueChange={setIsActive}>
                            <SelectTrigger id={`edit-org-status-${organization.id}`} className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {error && (
                        <p className="text-destructive text-sm p-2 bg-destructive/10 rounded">{error}</p>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save changes'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
