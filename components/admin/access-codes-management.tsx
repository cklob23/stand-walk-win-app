'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Ticket, Copy, Check, Search, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface AccessCode {
    id: string
    code: string
    status: 'available' | 'used' | 'expired'
    tier_id: string
    journey_id: string
    created_at: string
    used_at: string | null
    used_by: string | null
    user_profile?: {
        full_name: string | null
        email: string | null
    } | null
}

interface AccessCodesManagementProps {
    organizationId: string
    organizationName: string
}

export function AccessCodesManagement({ organizationId, organizationName }: AccessCodesManagementProps) {
    const [accessCodes, setAccessCodes] = useState<AccessCode[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [copiedCode, setCopiedCode] = useState<string | null>(null)

    useEffect(() => {
        loadAccessCodes()
    }, [organizationId])

    const loadAccessCodes = async () => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/admin/access-codes?orgId=${organizationId}`)
            const data = await response.json()
            if (data.accessCodes) {
                setAccessCodes(data.accessCodes)
            }
        } catch (error) {
            console.error('Failed to load access codes:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const copyToClipboard = async (code: string) => {
        await navigator.clipboard.writeText(code)
        setCopiedCode(code)
        setTimeout(() => setCopiedCode(null), 2000)
    }

    const filteredCodes = accessCodes.filter(code =>
        code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.user_profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.user_profile?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const activeCount = accessCodes.filter(c => c.status === 'available').length
    const usedCount = accessCodes.filter(c => c.status === 'used').length

    const tierNames: Record<string, string> = {
        basic: 'Basic',
        standard: 'Standard',
        premium: 'Premium',
    }

    const journeyNames: Record<string, string> = {
        foundations: 'Foundations',
        'spiritual-disciplines': 'Spiritual Disciplines',
        leadership: 'Leadership',
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'available':
                return <Badge className="bg-green-500/10 text-green-600">Available</Badge>
            case 'used':
                return <Badge variant="secondary">Used</Badge>
            case 'expired':
                return <Badge variant="destructive">Expired</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Ticket className="h-5 w-5" />
                            Access Codes
                        </CardTitle>
                        <CardDescription>
                            Manage access codes for {organizationName}
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={loadAccessCodes} disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                        <p className="text-2xl font-bold">{accessCodes.length}</p>
                        <p className="text-xs text-muted-foreground">Total Codes</p>
                    </div>
                    <div className="rounded-lg bg-green-500/10 p-3 text-center">
                        <p className="text-2xl font-bold text-green-600">{activeCount}</p>
                        <p className="text-xs text-muted-foreground">Available</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-center">
                        <p className="text-2xl font-bold">{usedCount}</p>
                        <p className="text-xs text-muted-foreground">Used</p>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by code or user..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredCodes.length === 0 ? (
                    <div className="text-center py-8">
                        <Ticket className="h-12 w-12 mx-auto text-muted-foreground/50" />
                        <p className="mt-2 text-muted-foreground">No access codes found</p>
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Journey</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Used By</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCodes.map((code) => (
                                    <TableRow key={code.id}>
                                        <TableCell>
                                            <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                                                {code.code}
                                            </code>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {tierNames[code.tier_id] || code.tier_id}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {journeyNames[code.journey_id] || code.journey_id}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(code.status)}</TableCell>
                                        <TableCell>
                                            {code.user_profile ? (
                                                <div>
                                                    <p className="text-sm font-medium">{code.user_profile.full_name}</p>
                                                    <p className="text-xs text-muted-foreground">{code.user_profile.email}</p>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {formatDistanceToNow(new Date(code.created_at), { addSuffix: true })}
                                        </TableCell>
                                        <TableCell>
                                            {code.status === 'available' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => copyToClipboard(code.code)}
                                                >
                                                    {copiedCode === code.code ? (
                                                        <Check className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
