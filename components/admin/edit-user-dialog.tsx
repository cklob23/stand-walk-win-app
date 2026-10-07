'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { updateUserRecord, type UserFormOptions } from '@/app/actions/admin-user-actions'
import { useRouter } from 'next/navigation'

interface EditUserDialogProps {
    user: {
        id: string
        full_name: string | null
        email: string | null
        role: string | null
        admin_role: string | null
        organization_id: string | null
        subscription_tier_id: string | null
    }
    options: UserFormOptions
    currentAdminId: string
}

export function EditUserDialog({ user, options, currentAdminId }: EditUserDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fullName, setFullName] = useState(user.full_name || '')
    const [email, setEmail] = useState(user.email || '')
    const [role, setRole] = useState(user.role || 'none')
    const [adminRole, setAdminRole] = useState(user.admin_role || 'none')
    const [organizationId, setOrganizationId] = useState(user.organization_id || 'none')
    const [tierId, setTierId] = useState(user.subscription_tier_id || 'none')
    const router = useRouter()
    const isCurrentUser = user.id === currentAdminId

    const syncFromUser = () => {
        setFullName(user.full_name || '')
        setEmail(user.email || '')
        setRole(user.role || 'none')
        setAdminRole(user.admin_role || 'none')
        setOrganizationId(user.organization_id || 'none')
        setTierId(user.subscription_tier_id || 'none')
        setError(null)
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setIsSaving(true)
        setError(null)

        if (adminRole === 'org_admin' && organizationId === 'none') {
            setError('Organization is required for an org admin')
            return
        }

        const result = await updateUserRecord({
            userId: user.id,
            fullName,
            email,
            role: role === 'none' ? null : (role as 'leader' | 'learner'),
            adminRole: adminRole === 'none' ? null : (adminRole as 'master_admin' | 'org_admin'),
            organizationId: organizationId === 'none' ? null : organizationId,
            subscriptionTierId: tierId === 'none' ? null : tierId,
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
                    syncFromUser()
                } else {
                    setIsSaving(false)
                    setError(null)
                }
            }}
        >
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" title="Edit user">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                    <DialogDescription>
                        Update this user or leader record. Changes apply immediately.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor={`edit-name-${user.id}`}>Full name</Label>
                        <Input
                            id={`edit-name-${user.id}`}
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`edit-email-${user.id}`}>Email</Label>
                        <Input
                            id={`edit-email-${user.id}`}
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`edit-role-${user.id}`}>Journey role</Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger id={`edit-role-${user.id}`} className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="leader">Leader</SelectItem>
                                <SelectItem value="learner">Learner</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`edit-admin-role-${user.id}`}>Admin role</Label>
                        <Select value={adminRole} onValueChange={setAdminRole} disabled={isCurrentUser}>
                            <SelectTrigger id={`edit-admin-role-${user.id}`} className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="org_admin">Org Admin</SelectItem>
                                <SelectItem value="master_admin">Master Admin</SelectItem>
                            </SelectContent>
                        </Select>
                        {isCurrentUser && (
                            <p className="text-xs text-muted-foreground">
                                You cannot change your own admin role.
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`edit-org-${user.id}`}>Organization</Label>
                        <Select value={organizationId} onValueChange={setOrganizationId}>
                            <SelectTrigger id={`edit-org-${user.id}`} className="w-full">
                                <SelectValue placeholder="No organization" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No organization</SelectItem>
                                {options.organizations.map((org) => (
                                    <SelectItem key={org.id} value={org.id}>
                                        {org.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`edit-tier-${user.id}`}>Plan</Label>
                        <Select value={tierId} onValueChange={setTierId}>
                            <SelectTrigger id={`edit-tier-${user.id}`} className="w-full">
                                <SelectValue placeholder="No plan" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No plan</SelectItem>
                                {options.tiers.map((tier) => (
                                    <SelectItem key={tier.id} value={tier.id}>
                                        {tier.display_name || tier.name}
                                    </SelectItem>
                                ))}
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
