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
import { Building2, Loader2 } from 'lucide-react'
import { createOrganizationRecord, type OrgFormOptions } from '@/app/actions/admin-org-actions'
import { useRouter } from 'next/navigation'

interface CreateOrganizationDialogProps {
    options: OrgFormOptions
}

export function CreateOrganizationDialog({ options }: CreateOrganizationDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [name, setName] = useState('')
    const [adminEmail, setAdminEmail] = useState('')
    const [description, setDescription] = useState('')
    const [maxUsers, setMaxUsers] = useState('10')
    const [tierId, setTierId] = useState('none')
    const router = useRouter()

    const resetForm = () => {
        setName('')
        setAdminEmail('')
        setDescription('')
        setMaxUsers('10')
        setTierId('none')
        setError(null)
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setIsSaving(true)
        setError(null)

        const result = await createOrganizationRecord({
            name,
            adminEmail: adminEmail.trim() || null,
            description: description.trim() || null,
            maxUsers: parseInt(maxUsers, 10) || 10,
            subscriptionTierId: tierId === 'none' ? null : tierId,
        })

        if (result.error) {
            setError(result.error)
            setIsSaving(false)
            return
        }

        setIsOpen(false)
        resetForm()
        setIsSaving(false)
        router.refresh()
    }

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open)
                if (!open) {
                    resetForm()
                    setIsSaving(false)
                }
            }}
        >
            <DialogTrigger asChild>
                <Button>
                    <Building2 className="mr-2 h-4 w-4" />
                    Create Organization
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create Organization</DialogTitle>
                    <DialogDescription>
                        Add a church or group. You can assign leaders to it from All Users after it is created.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="org-name">Organization name</Label>
                        <Input
                            id="org-name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="First Baptist Church"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="org-admin-email">Admin email</Label>
                        <Input
                            id="org-admin-email"
                            type="email"
                            value={adminEmail}
                            onChange={(event) => setAdminEmail(event.target.value)}
                            placeholder="admin@example.com"
                        />
                        <p className="text-xs text-muted-foreground">
                            Optional. If this email later signs in to the admin portal, they will be linked as the organization admin.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="org-description">Description</Label>
                        <Textarea
                            id="org-description"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="Optional notes about this organization"
                            rows={2}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="org-max-users">Max members</Label>
                        <Input
                            id="org-max-users"
                            type="number"
                            min={1}
                            value={maxUsers}
                            onChange={(event) => setMaxUsers(event.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="org-tier">Default plan</Label>
                        <Select value={tierId} onValueChange={setTierId}>
                            <SelectTrigger id="org-tier" className="w-full">
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
                                    Creating...
                                </>
                            ) : (
                                'Create organization'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
