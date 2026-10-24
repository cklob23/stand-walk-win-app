'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { AdminHeader } from '@/components/admin/admin-header'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Ticket, Users, TrendingUp, Building2, Copy, ExternalLink, Bell } from 'lucide-react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

const mockUser = {
    id: 'preview-admin',
    email: 'caleb@standwalkrun.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
} as User

export default function AdminShellPreviewPage() {
    const { setTheme } = useTheme()

    useEffect(() => {
        setTheme('light')
    }, [setTheme])

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            <AdminHeader
                user={mockUser}
                profile={{ full_name: 'Caleb Klobe', role: 'leader' }}
                organization={{ id: 'preview-org', name: '101 Church' }}
                isMasterAdmin={false}
            />
            <div className="flex">
                <AdminSidebar isMasterAdmin={false} journeyRole="leader" />
                <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-2xl font-bold">Welcome, Caleb Klobe</h1>
                            <p className="text-muted-foreground">Manage your organization and members</p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Members</CardTitle>
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">1</div>
                                    <p className="text-xs text-muted-foreground">Active members</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Available Codes</CardTitle>
                                    <Ticket className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">0</div>
                                    <p className="text-xs text-muted-foreground">Ready to distribute</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Used Codes</CardTitle>
                                    <Ticket className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">1</div>
                                    <p className="text-xs text-muted-foreground">Of 1 total</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">Plan</CardTitle>
                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">Basic</div>
                                    <p className="text-xs text-muted-foreground">1 license</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Quick Actions</CardTitle>
                                    <CardDescription>Common tasks for managing your organization</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Button asChild className="w-full justify-start" variant="outline">
                                        <Link href="/admin/dashboard/access-codes">
                                            <Ticket className="mr-2 h-4 w-4" />
                                            View & Copy Access Codes
                                        </Link>
                                    </Button>
                                    <Button asChild className="w-full justify-start" variant="outline">
                                        <Link href="/admin/dashboard/members">
                                            <Users className="mr-2 h-4 w-4" />
                                            Manage Members
                                        </Link>
                                    </Button>
                                    <Button asChild className="w-full justify-start" variant="outline">
                                        <Link href="/admin/dashboard/requests">
                                            <Bell className="mr-2 h-4 w-4" />
                                            Member Requests
                                        </Link>
                                    </Button>
                                    <Button asChild className="w-full justify-start" variant="outline">
                                        <Link href="/admin/dashboard/settings">
                                            <Building2 className="mr-2 h-4 w-4" />
                                            Organization Settings
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Share Access Codes</CardTitle>
                                    <CardDescription>Invite members to join your organization</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Share your access codes with team members so they can sign up for the journey.
                                        Each code can only be used once.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button asChild>
                                            <Link href="/admin/dashboard/access-codes">
                                                <Copy className="mr-2 h-4 w-4" />
                                                Get Codes
                                            </Link>
                                        </Button>
                                        <Button variant="outline" asChild>
                                            <Link href="/auth/signup" target="_blank">
                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                Signup Page
                                            </Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
