'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, Loader2, UserMinus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface OrgMember {
    id: string
    full_name: string | null
    email: string
}

interface OrgDangerZoneProps {
    organizationId: string
    organizationName: string
    currentAdminId: string
    members: OrgMember[]
}

export function OrgDangerZone({
    organizationId,
    organizationName,
    currentAdminId,
    members
}: OrgDangerZoneProps) {
    const router = useRouter()

    // Transfer ownership state
    const [showTransferDialog, setShowTransferDialog] = useState(false)
    const [selectedMemberId, setSelectedMemberId] = useState<string>('')
    const [isTransferring, setIsTransferring] = useState(false)

    // Delete organization state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [deleteConfirmation, setDeleteConfirmation] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    const expectedDeletePhrase = `sudo delete ${organizationName}`
    const isDeleteConfirmed = deleteConfirmation === expectedDeletePhrase

    // Filter out the current admin from the transfer list
    const eligibleMembers = members.filter(m => m.id !== currentAdminId)

    const handleTransferOwnership = async () => {
        if (!selectedMemberId) {
            toast.error('Please select a member to transfer ownership to')
            return
        }

        setIsTransferring(true)
        try {
            const res = await fetch('/api/admin/transfer-ownership', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organizationId,
                    newAdminId: selectedMemberId,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to transfer ownership')
            }

            toast.success('Ownership transferred successfully')
            setShowTransferDialog(false)

            // Redirect to login since they're no longer an admin
            router.push('/admin/login')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to transfer ownership')
        } finally {
            setIsTransferring(false)
        }
    }

    const handleDeleteOrganization = async () => {
        if (!isDeleteConfirmed) {
            toast.error('Please type the confirmation phrase exactly')
            return
        }

        setIsDeleting(true)
        try {
            const res = await fetch('/api/admin/delete-organization', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organizationId,
                    confirmationPhrase: deleteConfirmation,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to delete organization')
            }

            toast.success('Organization deleted successfully')
            setShowDeleteDialog(false)

            // Redirect to home since the org no longer exists
            router.push('/')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete organization')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <>
            <Card className="border-destructive/50">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Danger Zone
                    </CardTitle>
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
                        <Button
                            variant="outline"
                            onClick={() => setShowTransferDialog(true)}
                            disabled={eligibleMembers.length === 0}
                        >
                            <UserMinus className="mr-2 h-4 w-4" />
                            Transfer
                        </Button>
                    </div>
                    {eligibleMembers.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                            No eligible members to transfer ownership to. Add members to your organization first.
                        </p>
                    )}

                    <div className="h-px bg-border" />

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Delete Organization</p>
                            <p className="text-sm text-muted-foreground">
                                Permanently delete this organization and all data
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            onClick={() => setShowDeleteDialog(true)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Transfer Ownership Dialog */}
            <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Transfer Organization Ownership</DialogTitle>
                        <DialogDescription>
                            This will transfer your admin rights to another member. You will lose access to the admin dashboard.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Select New Admin</Label>
                            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a member..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {eligibleMembers.map((member) => (
                                        <SelectItem key={member.id} value={member.id}>
                                            {member.full_name || member.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700">
                            <p className="font-medium">Warning</p>
                            <p>This action cannot be undone. The selected member will become the organization admin, and you will be removed as admin.</p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleTransferOwnership}
                            disabled={!selectedMemberId || isTransferring}
                        >
                            {isTransferring ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Transferring...
                                </>
                            ) : (
                                'Confirm Transfer'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Organization Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive">Delete Organization</DialogTitle>
                        <DialogDescription>
                            This action is permanent and cannot be undone. All organization data, members, and settings will be permanently deleted.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                            <p className="font-medium">This will delete:</p>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                                <li>All organization settings and branding</li>
                                <li>All access codes</li>
                                <li>All member associations with this organization</li>
                                <li>All pairings and progress data for members</li>
                            </ul>
                        </div>

                        <div className="space-y-2">
                            <Label>
                                Type <span className="font-mono font-bold text-destructive">{expectedDeletePhrase}</span> to confirm
                            </Label>
                            <Input
                                value={deleteConfirmation}
                                onChange={(e) => setDeleteConfirmation(e.target.value)}
                                placeholder="Type confirmation phrase..."
                                className="font-mono"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setShowDeleteDialog(false)
                            setDeleteConfirmation('')
                        }}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteOrganization}
                            disabled={!isDeleteConfirmed || isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Organization'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
