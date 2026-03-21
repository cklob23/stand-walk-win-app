'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteUserAndAssociations } from '@/app/actions/admin-user-actions'
import { useRouter } from 'next/navigation'

interface DeleteUserButtonProps {
    userId: string
    userName: string
    userEmail: string
    currentAdminId: string
}

export function DeleteUserButton({ userId, userName, userEmail, currentAdminId }: DeleteUserButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const router = useRouter()

    const isCurrentUser = userId === currentAdminId

    const handleDelete = async () => {
        setIsDeleting(true)
        setError(null)

        const result = await deleteUserAndAssociations(userId)

        if (result.error) {
            setError(result.error)
            setIsDeleting(false)
        } else {
            setIsOpen(false)
            router.refresh()
        }
    }

    if (isCurrentUser) {
        return null // Don't show delete button for current user
    }

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to permanently delete this user and all their data?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3">
                    <div className="bg-muted p-3 rounded-md">
                        <p className="font-medium">{userName || 'Unknown User'}</p>
                        <p className="text-sm text-muted-foreground">{userEmail}</p>
                    </div>
                    <p className="text-destructive font-medium text-sm">
                        This action cannot be undone. The following will be deleted:
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                        <li>User profile and authentication</li>
                        <li>All pairings (as leader or learner)</li>
                        <li>Messages and reactions</li>
                        <li>Journal entries and attachments</li>
                        <li>Assignment progress and reflections</li>
                        <li>Bible highlights and shared items</li>
                        <li>Notifications and push subscriptions</li>
                        <li>Organization memberships</li>
                        <li>Access codes will be reset to available</li>
                    </ul>
                    {error && (
                        <p className="text-destructive text-sm p-2 bg-destructive/10 rounded">
                            {error}
                        </p>
                    )}
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
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
                                Delete User
                            </>
                        )}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
