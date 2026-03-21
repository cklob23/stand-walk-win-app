'use client'

import { useState } from 'react'
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
import { Copy, Check, Search, Mail, Download } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AccessCode {
    id: string
    code: string
    status: 'available' | 'used' | 'expired'
    created_at: string
    used_at: string | null
    used_by_profile?: {
        id: string
        full_name: string | null
        email: string | null
    } | null
    journey?: {
        id: string
        name: string
    } | null
    tier?: {
        id: string
        name: string
        display_name: string
    } | null
}

interface AdminAccessCodesProps {
    accessCodes: AccessCode[]
    organizationName: string
}

export function AdminAccessCodes({ accessCodes, organizationName }: AdminAccessCodesProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [copiedCode, setCopiedCode] = useState<string | null>(null)
    const { toast } = useToast()

    const filteredCodes = accessCodes.filter(code =>
        code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.used_by_profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.used_by_profile?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Count by actual claimed status, not stored status field
    const availableCodes = accessCodes.filter(c => !c.used_by_profile)
    const usedCodes = accessCodes.filter(c => !!c.used_by_profile)

    const copyToClipboard = async (code: string) => {
        await navigator.clipboard.writeText(code)
        setCopiedCode(code)
        toast({
            title: 'Code copied',
            description: `Access code ${code} copied to clipboard`,
        })
        setTimeout(() => setCopiedCode(null), 2000)
    }

    const copyAllAvailable = async () => {
        const codes = availableCodes.map(c => c.code).join('\n')
        await navigator.clipboard.writeText(codes)
        toast({
            title: 'All codes copied',
            description: `${availableCodes.length} available codes copied to clipboard`,
        })
    }

    const downloadCodes = () => {
        const csvContent = [
            ['Code', 'Plan', 'Status', 'Journey', 'Used By', 'Used At'].join(','),
            ...accessCodes.map(code => [
                code.code,
                code.tier?.display_name || code.tier?.name || 'N/A',
                code.status,
                code.journey?.name || 'N/A',
                code.used_by_profile?.full_name || code.used_by_profile?.email || '',
                code.used_at ? new Date(code.used_at).toLocaleDateString() : '',
            ].join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${organizationName.toLowerCase().replace(/\s+/g, '-')}-access-codes.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const getStatusBadge = (status: string, hasClaimedBy: boolean) => {
        // If there's a claimed_by user, show as Claimed regardless of stored status
        if (hasClaimedBy) {
            return <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">Claimed</Badge>
        }
        switch (status) {
            case 'available':
                return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Available</Badge>
            case 'used':
                return <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">Claimed</Badge>
            case 'expired':
                return <Badge variant="destructive">Expired</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Codes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{accessCodes.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{availableCodes.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Used</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{usedCodes.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Available Codes Quick Copy */}
            {availableCodes.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Available Codes</CardTitle>
                        <CardDescription>
                            Click to copy individual codes or copy all at once
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {availableCodes.slice(0, 10).map(code => (
                                <Button
                                    key={code.id}
                                    variant="outline"
                                    size="sm"
                                    className="font-mono"
                                    onClick={() => copyToClipboard(code.code)}
                                >
                                    {copiedCode === code.code ? (
                                        <Check className="mr-1 h-3 w-3 text-green-600" />
                                    ) : (
                                        <Copy className="mr-1 h-3 w-3" />
                                    )}
                                    {code.code}
                                </Button>
                            ))}
                            {availableCodes.length > 10 && (
                                <span className="text-sm text-muted-foreground self-center">
                                    +{availableCodes.length - 10} more
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button onClick={copyAllAvailable} variant="secondary" className="flex-shrink-0">
                                <Copy className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">Copy All Available ({availableCodes.length})</span>
                                <span className="sm:hidden">Copy All ({availableCodes.length})</span>
                            </Button>
                            <Button onClick={downloadCodes} variant="outline" className="flex-shrink-0">
                                <Download className="mr-2 h-4 w-4" />
                                Export CSV
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* All Codes Table */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle>All Access Codes</CardTitle>
                            <CardDescription>
                                Complete list of all access codes for your organization
                            </CardDescription>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search codes or members..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                    <div className="rounded-md border overflow-x-auto">
                        <Table className="min-w-[700px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Code</TableHead>
                                    <TableHead className="whitespace-nowrap">Plan</TableHead>
                                    <TableHead className="whitespace-nowrap">Status</TableHead>
                                    <TableHead className="whitespace-nowrap">Journey</TableHead>
                                    <TableHead className="whitespace-nowrap">Used By</TableHead>
                                    <TableHead className="whitespace-nowrap">Date</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCodes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                            {searchTerm ? 'No codes found matching your search' : 'No access codes found'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredCodes.map(code => (
                                        <TableRow key={code.id}>
                                            <TableCell className="font-mono font-medium">{code.code}</TableCell>
                                            <TableCell>
                                                {code.tier ? (
                                                    <Badge variant="outline" className="font-normal">
                                                        {code.tier.display_name || code.tier.name}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(code.status, !!code.used_by_profile)}</TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {code.journey?.name || 'Default Journey'}
                                            </TableCell>
                                            <TableCell>
                                                {code.used_by_profile ? (
                                                    <div className="text-sm">
                                                        <p className="font-medium">{code.used_by_profile.full_name}</p>
                                                        <p className="text-muted-foreground text-xs">{code.used_by_profile.email}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {code.used_at
                                                    ? new Date(code.used_at).toLocaleDateString()
                                                    : new Date(code.created_at).toLocaleDateString()
                                                }
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {!code.used_by_profile && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => copyToClipboard(code.code)}
                                                    >
                                                        {copiedCode === code.code ? (
                                                            <Check className="h-4 w-4 text-green-600" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
