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
import { Loader2, UserPlus } from 'lucide-react'
import { createLeaderAccount, type UserFormOptions } from '@/app/actions/admin-user-actions'
import { useRouter } from 'next/navigation'

interface CreateLeaderDialogProps {
    options: UserFormOptions
}

export function CreateLeaderDialog({ options }: CreateLeaderDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [warning, setWarning] = useState<string | null>(null)
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [organizationId, setOrganizationId] = useState('none')
    const [tierId, setTierId] = useState('')
    const [journeyId, setJourneyId] = useState('')
    const [licenseCount, setLicenseCount] = useState('1')
    const router = useRouter()

    const resetForm = () => {
        setFullName('')
        setEmail('')
        setOrganizationId('none')
        setTierId('')
        setJourneyId('')
        setLicenseCount('1')
        setError(null)
        setWarning(null)
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setIsSaving(true)
        setError(null)
        setWarning(null)

        const result = await createLeaderAccount({
            fullName,
            email,
            organizationId: organizationId === 'none' ? null : organizationId,
            tierId,
            journeyId,
            licenseCount: parseInt(licenseCount, 10) || 1,
        })

        if (result.error) {
            setError(result.error)
            setIsSaving(false)
            return
        }

        if (result.warning) {
            const codesNote = result.codes?.length ? ` Access codes: ${result.codes.join(', ')}.` : ''
            setWarning(`${result.warning}${codesNote}`)
            setIsSaving(false)
            router.refresh()
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
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Leader
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create Leader</DialogTitle>
                    <DialogDescription>
                        Create a leader account, assign a plan and journey, then email them their access code(s).
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="leader-name">Full name</Label>
                        <Input
                            id="leader-name"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            placeholder="Jane Smith"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="leader-email">Email</Label>
                        <Input
                            id="leader-email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="leader@example.com"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="leader-org">Organization</Label>
                        <Select value={organizationId} onValueChange={setOrganizationId}>
                            <SelectTrigger id="leader-org" className="w-full">
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
                        <Label htmlFor="leader-tier">Plan</Label>
                        <Select value={tierId} onValueChange={setTierId} required>
                            <SelectTrigger id="leader-tier" className="w-full">
                                <SelectValue placeholder="Select a plan" />
                            </SelectTrigger>
                            <SelectContent>
                                {options.tiers.map((tier) => (
                                    <SelectItem key={tier.id} value={tier.id}>
                                        {tier.display_name || tier.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="leader-journey">Journey</Label>
                        <Select value={journeyId} onValueChange={setJourneyId} required>
                            <SelectTrigger id="leader-journey" className="w-full">
                                <SelectValue placeholder="Select a journey" />
                            </SelectTrigger>
                            <SelectContent>
                                {options.journeys.map((journey) => (
                                    <SelectItem key={journey.id} value={journey.id}>
                                        {journey.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="leader-codes">Access codes</Label>
                        <Select value={licenseCount} onValueChange={setLicenseCount}>
                            <SelectTrigger id="leader-codes" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">1 code</SelectItem>
                                <SelectItem value="2">2 codes</SelectItem>
                                <SelectItem value="3">3 codes</SelectItem>
                                <SelectItem value="5">5 codes</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            The first code is assigned to this leader. Extra codes stay available for other leaders on the same plan.
                        </p>
                    </div>
                    {error && (
                        <p className="text-destructive text-sm p-2 bg-destructive/10 rounded">{error}</p>
                    )}
                    {warning && (
                        <p className="text-amber-700 text-sm p-2 bg-amber-50 rounded">{warning}</p>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving || !tierId || !journeyId}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create and send invite'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
