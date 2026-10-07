'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteOrganizationRecord } from '@/app/actions/admin-org-actions'
import { useRouter } from 'next/navigation'

interface DeleteOrganizationButtonProps {
    organizationId: string
    organizationName: string
    assignedUserCount: number
    claimedCodeCount: number
    triggerLabel?: string
}

export function DeleteOrganizationButton({
    organizationId,
    organizationName,
    assignedUserCount,
    claimedCodeCount,
    triggerLabel,
}: DeleteOrganizationButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()

    const isBlocked = assignedUserCount > 0 || claimedCodeCount > 0

    const handleDelete = async () => {
        if (isBlocked) return

        setIsDeleting(true)
        setError(null)

        const result = await deleteOrganizationRecord(organizationId)

        if (result.error) {
            setError(result.error)
            setIsDeleting(false)
            return
        }

        setIsOpen(false)
        router.push('/admin/dashboard/organizations')
        router.refresh()
    }

    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open)
            if (!open) {
                setError(null)
                setIsDeleting(false)
            }
        }}>
            <AlertDialogTrigger asChild>
                {triggerLabel ? (
                    <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        {triggerLabel}
                    </Button>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete organization"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                    <AlertDialogDescription>
                        {isBlocked
                            ? 'This organization still has users or claimed access codes, so it cannot be deleted yet.'
                            : 'Are you sure you want to permanently delete this organization?'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3">
                    <div className="bg-muted p-3 rounded-md">
                        <p className="font-medium">{organizationName}</p>
                        <p className="text-sm text-muted-foreground">
                            {assignedUserCount} assigned user{assignedUserCount === 1 ? '' : 's'}
                            {' · '}
                            {claimedCodeCount} claimed access code{claimedCodeCount === 1 ? '' : 's'}
                        </p>
                    </div>
                    {isBlocked ? (
                        <p className="text-sm text-muted-foreground">
                            Reassign or remove those users from All Users first. You can also deactivate the organization instead of deleting it.
                        </p>
                    ) : (
                        <>
                            <p className="text-destructive font-medium text-sm">
                                This action cannot be undone. The following will be removed:
                            </p>
                            <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                                <li>Organization record and settings</li>
                                <li>Unused access codes for this organization</li>
                                <li>Pending member requests</li>
                                <li>Subscription records will stay, but will be unlinked from the organization</li>
                            </ul>
                        </>
                    )}
                    {error && (
                        <p className="text-destructive text-sm p-2 bg-destructive/10 rounded">
                            {error}
                        </p>
                    )}
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    {!isBlocked && (
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Organization
                                </>
                            )}
                        </Button>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
