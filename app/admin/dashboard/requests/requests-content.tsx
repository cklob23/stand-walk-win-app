'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import {
    GraduationCap,
    BookOpen,
    Check,
    X,
    Clock,
    MessageSquare,
    ShoppingCart,
    Users,
    Inbox
} from 'lucide-react'
import { approveOrgMemberRequest, denyOrgMemberRequest } from '@/lib/org-request-actions'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface Request {
    id: string
    user_id: string
    request_type: 'become_leader' | 'new_journey'
    status: 'pending' | 'approved' | 'denied'
    notes: string | null
    admin_notes: string | null
    assigned_access_code_id: string | null
    created_at: string
    updated_at: string
    user: {
        id: string
        full_name: string | null
        email: string | null
        avatar_url: string | null
    } | null
}

interface AccessCode {
    id: string
    code: string
    tier_id: string
    journey_id: string | null
    tier: { name: string } | null
    journey: { name: string } | null
}

interface RequestsContentProps {
    requests: Request[]
    availableCodes: AccessCode[]
    allCodes: AccessCode[]
    organizationId: string
}

export function RequestsContent({ requests, availableCodes, allCodes, organizationId }: RequestsContentProps) {
    const router = useRouter()
    const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
    const [actionType, setActionType] = useState<'approve' | 'deny' | null>(null)
    const [selectedCodeId, setSelectedCodeId] = useState<string>('')
    const [adminResponse, setAdminResponse] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const pendingRequests = requests.filter(r => r.status === 'pending')
    const processedRequests = requests.filter(r => r.status !== 'pending')

    const handleApprove = async () => {
        if (!selectedRequest) return

        setIsSubmitting(true)
        const result = await approveOrgMemberRequest({
            requestId: selectedRequest.id,
            accessCodeId: selectedCodeId || undefined,
            notes: adminResponse || undefined,
        })
        setIsSubmitting(false)

        if (result.success) {
            toast.success('Request approved successfully!')
            setSelectedRequest(null)
            setActionType(null)
            setSelectedCodeId('')
            setAdminResponse('')
            router.refresh()
        } else {
            toast.error(result.error || 'Failed to approve request')
        }
    }

    const handleDeny = async () => {
        if (!selectedRequest) return

        setIsSubmitting(true)
        const result = await denyOrgMemberRequest(
            selectedRequest.id,
            adminResponse || undefined
        )
        setIsSubmitting(false)

        if (result.success) {
            toast.success('Request denied')
            setSelectedRequest(null)
            setActionType(null)
            setAdminResponse('')
            router.refresh()
        } else {
            toast.error(result.error || 'Failed to deny request')
        }
    }

    const getRequestTypeInfo = (type: string) => {
        if (type === 'become_leader') {
            return {
                icon: GraduationCap,
                label: 'Become a Leader',
                description: 'Wants to graduate to leader role and mentor others',
                color: 'text-primary',
                bgColor: 'bg-primary/10',
            }
        }
        return {
            icon: BookOpen,
            label: 'New Journey',
            description: 'Wants to start another journey as a learner',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>
            case 'approved':
                return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><Check className="h-3 w-3 mr-1" /> Approved</Badge>
            case 'denied':
                return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50"><X className="h-3 w-3 mr-1" /> Denied</Badge>
            default:
                return null
        }
    }

    // Filter codes based on request type
    const getAvailableCodesForRequest = (request: Request) => {
        // For become_leader, show codes with higher tier max_learners
        // For new_journey, show any available code
        return availableCodes
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Member Requests</h1>
                    <p className="text-muted-foreground">
                        Review and respond to requests from your organization members
                    </p>
                </div>
                {availableCodes.length === 0 && pendingRequests.length > 0 && (
                    <Button asChild>
                        <Link href="/pricing">
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Purchase Licenses
                        </Link>
                    </Button>
                )}
            </div>

            {/* Pending Requests */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Inbox className="h-5 w-5" />
                        Pending Requests
                        {pendingRequests.length > 0 && (
                            <Badge variant="secondary">{pendingRequests.length}</Badge>
                        )}
                    </CardTitle>
                    <CardDescription>
                        Requests awaiting your review
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {pendingRequests.length === 0 ? (
                        <Empty className="py-8">
                            <EmptyMedia variant="icon">
                                <Check className="h-5 w-5" />
                            </EmptyMedia>
                            <EmptyHeader>
                                <EmptyTitle>No pending requests</EmptyTitle>
                                <EmptyDescription>All member requests have been processed</EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : (
                        <div className="space-y-4">
                            {pendingRequests.map((request) => {
                                const typeInfo = getRequestTypeInfo(request.request_type)
                                const TypeIcon = typeInfo.icon
                                return (
                                    <div
                                        key={request.id}
                                        className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                                    >
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={request.user?.avatar_url || undefined} />
                                            <AvatarFallback>
                                                {(request.user?.full_name || request.user?.email || 'U')[0].toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium">
                                                    {request.user?.full_name || request.user?.email || 'Unknown User'}
                                                </span>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.bgColor} ${typeInfo.color}`}>
                                                    <TypeIcon className="h-3 w-3" />
                                                    {typeInfo.label}
                                                </span>
                                            </div>

                                            <p className="text-sm text-muted-foreground mb-2">
                                                {typeInfo.description}
                                            </p>

                                            {request.notes && (
                                                <div className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded-md">
                                                    <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                                    <p className="text-muted-foreground italic">"{request.notes}"</p>
                                                </div>
                                            )}

                                            <p className="text-xs text-muted-foreground mt-2">
                                                Requested {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                                            </p>
                                        </div>

                                        <div className="flex gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => {
                                                    setSelectedRequest(request)
                                                    setActionType('deny')
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedRequest(request)
                                                    setActionType('approve')
                                                }}
                                            >
                                                <Check className="h-4 w-4 mr-1" />
                                                Approve
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Processed Requests */}
            {processedRequests.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Request History
                        </CardTitle>
                        <CardDescription>
                            Previously processed requests
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {processedRequests.map((request) => {
                                const typeInfo = getRequestTypeInfo(request.request_type)
                                const TypeIcon = typeInfo.icon
                                const assignedCode = request.assigned_access_code_id
                                    ? allCodes.find(c => c.id === request.assigned_access_code_id)
                                    : null
                                return (
                                    <div
                                        key={request.id}
                                        className="flex items-start gap-4 p-4 rounded-lg border bg-muted/30"
                                    >
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={request.user?.avatar_url || undefined} />
                                            <AvatarFallback className="text-sm">
                                                {(request.user?.full_name || request.user?.email || 'U')[0].toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium">
                                                    {request.user?.full_name || request.user?.email || 'Unknown User'}
                                                </span>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.bgColor} ${typeInfo.color}`}>
                                                    <TypeIcon className="h-3 w-3" />
                                                    {typeInfo.label}
                                                </span>
                                            </div>

                                            <p className="text-sm text-muted-foreground mb-2">
                                                {typeInfo.description}
                                            </p>

                                            {/* Show what was assigned */}
                                            {request.status === 'approved' && assignedCode && (
                                                <div className="text-sm bg-green-50 text-green-700 p-2 rounded-md mb-2">
                                                    <span className="font-medium">Assigned:</span>{' '}
                                                    <span className="font-mono">{assignedCode.code}</span>
                                                    <span className="text-green-600 ml-1">
                                                        ({assignedCode.tier?.name}{assignedCode.journey?.name ? ` - ${assignedCode.journey.name}` : ''})
                                                    </span>
                                                </div>
                                            )}

                                            {/* Show admin response if any */}
                                            {request.admin_notes && (
                                                <div className="text-sm bg-muted p-2 rounded-md mb-2">
                                                    <span className="font-medium">Response:</span>{' '}
                                                    <span className="text-muted-foreground italic">"{request.admin_notes}"</span>
                                                </div>
                                            )}

                                            <p className="text-xs text-muted-foreground">
                                                Processed {formatDistanceToNow(new Date(request.updated_at), { addSuffix: true })}
                                            </p>
                                        </div>

                                        {getStatusBadge(request.status)}
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Approve Dialog */}
            <Dialog open={actionType === 'approve' && !!selectedRequest} onOpenChange={(open) => {
                if (!open) {
                    setSelectedRequest(null)
                    setActionType(null)
                    setSelectedCodeId('')
                    setAdminResponse('')
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Approve Request</DialogTitle>
                        <DialogDescription>
                            {selectedRequest?.request_type === 'become_leader'
                                ? 'Approve this member to become a leader. They will need a license to start mentoring learners.'
                                : 'Approve this member for a new journey. Assign them an available access code.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {selectedRequest && (
                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                <Avatar>
                                    <AvatarImage src={selectedRequest.user?.avatar_url || undefined} />
                                    <AvatarFallback>
                                        {(selectedRequest.user?.full_name || 'U')[0].toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">{selectedRequest.user?.full_name || selectedRequest.user?.email}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedRequest.request_type === 'become_leader' ? 'Requesting leader status' : 'Requesting new journey'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {selectedRequest?.request_type === 'become_leader' ? (
                            // For become_leader requests, access code is REQUIRED
                            availableCodes.length > 0 ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        Assign Access Code <span className="text-red-500">*</span>
                                    </label>
                                    <Select value={selectedCodeId} onValueChange={setSelectedCodeId}>
                                        <SelectTrigger className={!selectedCodeId ? 'border-red-300' : ''}>
                                            <SelectValue placeholder="Select an access code (required)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {getAvailableCodesForRequest(selectedRequest!).map((code) => (
                                                <SelectItem key={code.id} value={code.id}>
                                                    <span className="font-mono">{code.code}</span>
                                                    <span className="text-muted-foreground ml-2">
                                                        ({code.tier?.name}{code.journey?.name ? ` - ${code.journey.name}` : ''})
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        An access code is required to grant leader privileges
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                                    <div className="flex items-center gap-2 text-red-800">
                                        <ShoppingCart className="h-4 w-4" />
                                        <span className="font-medium">No access codes available</span>
                                    </div>
                                    <p className="text-sm text-red-700">
                                        An access code is required to approve leader requests. Please purchase a license to fulfill this request.
                                    </p>
                                    <Button asChild className="w-full" variant="outline">
                                        <Link href="/pricing">
                                            <ShoppingCart className="h-4 w-4 mr-2" />
                                            Purchase License
                                        </Link>
                                    </Button>
                                </div>
                            )
                        ) : (
                            // For new_journey requests, access code is optional
                            availableCodes.length > 0 ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Assign Access Code (Optional)</label>
                                    <Select value={selectedCodeId} onValueChange={setSelectedCodeId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select an access code to assign" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {getAvailableCodesForRequest(selectedRequest!).map((code) => (
                                                <SelectItem key={code.id} value={code.id}>
                                                    <span className="font-mono">{code.code}</span>
                                                    <span className="text-muted-foreground ml-2">
                                                        ({code.tier?.name}{code.journey?.name ? ` - ${code.journey.name}` : ''})
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        You can assign a code now or later from the Access Codes page
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                                    <div className="flex items-center gap-2 text-amber-800">
                                        <ShoppingCart className="h-4 w-4" />
                                        <span className="font-medium">No access codes available</span>
                                    </div>
                                    <p className="text-sm text-amber-700">
                                        You can still approve this request and assign a code later, or purchase more licenses.
                                    </p>
                                    <Button asChild className="w-full" variant="outline">
                                        <Link href="/pricing">
                                            <ShoppingCart className="h-4 w-4 mr-2" />
                                            Purchase License
                                        </Link>
                                    </Button>
                                </div>
                            )
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Response Message (Optional)</label>
                            <Textarea
                                placeholder="Add a message for the member..."
                                value={adminResponse}
                                onChange={(e) => setAdminResponse(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedRequest(null)
                                setActionType(null)
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApprove}
                            disabled={isSubmitting || (selectedRequest?.request_type === 'become_leader' && !selectedCodeId)}
                        >
                            {isSubmitting ? <Spinner className="h-4 w-4 mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Approve Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Deny Dialog */}
            <Dialog open={actionType === 'deny' && !!selectedRequest} onOpenChange={(open) => {
                if (!open) {
                    setSelectedRequest(null)
                    setActionType(null)
                    setAdminResponse('')
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Deny Request</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to deny this request? You can provide a reason for the member.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {selectedRequest && (
                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                <Avatar>
                                    <AvatarImage src={selectedRequest.user?.avatar_url || undefined} />
                                    <AvatarFallback>
                                        {(selectedRequest.user?.full_name || 'U')[0].toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">{selectedRequest.user?.full_name || selectedRequest.user?.email}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedRequest.request_type === 'become_leader' ? 'Requesting leader status' : 'Requesting new journey'}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Reason for Denial (Optional)</label>
                            <Textarea
                                placeholder="Explain why this request is being denied..."
                                value={adminResponse}
                                onChange={(e) => setAdminResponse(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedRequest(null)
                                setActionType(null)
                            }}
                        >
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeny} disabled={isSubmitting}>
                            {isSubmitting ? <Spinner className="h-4 w-4 mr-2" /> : <X className="h-4 w-4 mr-2" />}
                            Deny Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
