'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import {
    BookOpen,
    Award,
    Calendar,
    ChevronRight,
    User,
    CheckCircle,
    MessageSquare,
    FileText,
    Edit3,
    BookMarked,
    Archive
} from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface Journey {
    id: string
    name: string
    description: string
    duration_weeks: number
}

interface Profile {
    id: string
    full_name: string | null
    avatar_url: string | null
}

interface CompletedPairing {
    id: string
    status: string
    current_week: number
    started_at: string
    completed_at: string | null
    journey_id: string
    leader_id: string
    learner_id: string
    access_code_id: string | null
    journey: Journey | Journey[] | null
    leader: Profile | Profile[] | null
    learner: Profile | Profile[] | null
}

interface Assignment {
    id: string
    title: string
    description: string
    assignment_type: string
    week_number: number
}

interface AssignmentProgressItem {
    id: string
    pairing_id: string
    assignment_id: string
    status: string
    notes: string | null
    completed_at: string | null
    leader_reply: string | null
    leader_reply_at: string | null
    assignment: Assignment | null
}

interface CompletedJourneysContentProps {
    completedPairings: CompletedPairing[]
    assignmentProgress: Record<string, AssignmentProgressItem[]>
    userId: string
    userRole: string
}

// Helper to extract first element from Supabase join arrays
function extractFirst<T>(data: T | T[] | null): T | null {
    if (!data) return null
    return Array.isArray(data) ? data[0] || null : data
}

export function CompletedJourneysContent({
    completedPairings,
    assignmentProgress,
    userId,
    userRole,
}: CompletedJourneysContentProps) {
    const [selectedPairing, setSelectedPairing] = useState<CompletedPairing | null>(null)

    const getAssignmentTypeIcon = (type: string) => {
        switch (type) {
            case 'reading':
                return <BookMarked className="h-4 w-4 text-blue-600" />
            case 'reflection':
                return <Edit3 className="h-4 w-4 text-purple-600" />
            case 'discussion':
                return <MessageSquare className="h-4 w-4 text-green-600" />
            default:
                return <FileText className="h-4 w-4 text-muted-foreground" />
        }
    }

    const getAssignmentTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            reading: 'bg-blue-50 text-blue-700 border-blue-200',
            reflection: 'bg-purple-50 text-purple-700 border-purple-200',
            discussion: 'bg-green-50 text-green-700 border-green-200',
        }
        return colors[type] || 'bg-muted text-muted-foreground'
    }

    if (completedPairings.length === 0) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Archive className="h-6 w-6" />
                        Journey History
                    </h1>
                    <p className="text-muted-foreground">
                        View your completed discipleship journeys and archived assignments
                    </p>
                </div>

                <Card>
                    <CardContent className="py-12">
                        <Empty className="py-6">
                            <EmptyMedia variant="icon">
                                <BookOpen className="h-5 w-5" />
                            </EmptyMedia>
                            <EmptyHeader>
                                <EmptyTitle>No completed journeys yet</EmptyTitle>
                                <EmptyDescription>When you finish a journey, it will appear here for you to look back on.</EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                        <div className="flex justify-center mt-6">
                            <Button asChild>
                                <Link href="/dashboard">
                                    Go to Dashboard
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Archive className="h-6 w-6" />
                    Journey History
                </h1>
                <p className="text-muted-foreground">
                    You have completed {completedPairings.length} journey{completedPairings.length !== 1 ? 's' : ''}
                </p>
            </div>

            <div className="grid gap-4">
                {completedPairings.map((pairing) => {
                    const journey = extractFirst(pairing.journey)
                    const leader = extractFirst(pairing.leader)
                    const learner = extractFirst(pairing.learner)
                    const isLearner = pairing.learner_id === userId
                    const partner = isLearner ? leader : learner
                    const partnerRole = isLearner ? 'Leader' : 'Learner'
                    const progress = assignmentProgress[pairing.id] || []
                    const completedCount = progress.filter(p => p.status === 'completed').length

                    return (
                        <Card key={pairing.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <Award className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">
                                                {journey?.name || 'Unknown Journey'}
                                            </CardTitle>
                                            <CardDescription className="flex items-center gap-2 mt-1">
                                                <Calendar className="h-3.5 w-3.5" />
                                                Completed {pairing.completed_at
                                                    ? format(new Date(pairing.completed_at), 'MMMM d, yyyy')
                                                    : 'Unknown date'}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Completed
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={partner?.avatar_url || undefined} />
                                            <AvatarFallback className="text-xs">
                                                {(partner?.full_name || 'U')[0].toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-medium">{partner?.full_name || 'Unknown'}</p>
                                            <p className="text-xs text-muted-foreground">Your {partnerRole}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium">{completedCount} Assignments</p>
                                        <p className="text-xs text-muted-foreground">
                                            {journey?.duration_weeks || 6} Weeks
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => setSelectedPairing(pairing)}
                                    >
                                        <BookOpen className="h-4 w-4 mr-2" />
                                        View Assignments
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Assignment Details Dialog */}
            <Dialog open={!!selectedPairing} onOpenChange={(open) => !open && setSelectedPairing(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Award className="h-5 w-5 text-primary" />
                            {extractFirst(selectedPairing?.journey)?.name || 'Journey'} - Your Work
                        </DialogTitle>
                        <DialogDescription>
                            Review your completed assignments and reflections from this journey
                        </DialogDescription>
                    </DialogHeader>

                    {selectedPairing && (
                        <div className="space-y-4 mt-4">
                            {/* Journey Summary */}
                            <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-muted-foreground">Started</p>
                                        <p className="font-medium">
                                            {format(new Date(selectedPairing.started_at), 'MMM d, yyyy')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Completed</p>
                                        <p className="font-medium">
                                            {selectedPairing.completed_at
                                                ? format(new Date(selectedPairing.completed_at), 'MMM d, yyyy')
                                                : 'Unknown'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Assignments by Week */}
                            <Accordion type="single" collapsible className="w-full">
                                {Array.from({ length: extractFirst(selectedPairing.journey)?.duration_weeks || 6 }, (_, i) => i + 1).map((weekNum) => {
                                    const weekProgress = (assignmentProgress[selectedPairing.id] || [])
                                        .filter(p => p.assignment?.week_number === weekNum)

                                    if (weekProgress.length === 0) return null

                                    return (
                                        <AccordionItem key={weekNum} value={`week-${weekNum}`}>
                                            <AccordionTrigger className="hover:no-underline">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">Week {weekNum}</span>
                                                    <Badge variant="secondary" className="text-xs">
                                                        {weekProgress.length} assignment{weekProgress.length !== 1 ? 's' : ''}
                                                    </Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-3 pt-2">
                                                    {weekProgress.map((item) => (
                                                        <div key={item.id} className="p-3 rounded-lg border bg-card">
                                                            <div className="flex items-start gap-3">
                                                                {getAssignmentTypeIcon(item.assignment?.assignment_type || '')}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="font-medium text-sm">
                                                                            {item.assignment?.title || 'Unknown Assignment'}
                                                                        </span>
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={`text-xs ${getAssignmentTypeBadge(item.assignment?.assignment_type || '')}`}
                                                                        >
                                                                            {item.assignment?.assignment_type || 'Task'}
                                                                        </Badge>
                                                                    </div>

                                                                    {item.notes && (
                                                                        <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                                                                            <p className="text-xs text-muted-foreground mb-1">Your Response:</p>
                                                                            <p className="whitespace-pre-wrap">{item.notes}</p>
                                                                        </div>
                                                                    )}

                                                                    {item.leader_reply && (
                                                                        <div className="mt-2 p-2 bg-primary/5 rounded text-sm border-l-2 border-primary">
                                                                            <p className="text-xs text-muted-foreground mb-1">Leader Feedback:</p>
                                                                            <p className="whitespace-pre-wrap">{item.leader_reply}</p>
                                                                        </div>
                                                                    )}

                                                                    {item.completed_at && (
                                                                        <p className="text-xs text-muted-foreground mt-2">
                                                                            Completed {format(new Date(item.completed_at), 'MMM d, yyyy')}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )
                                })}
                            </Accordion>

                            {(assignmentProgress[selectedPairing.id] || []).length === 0 && (
                                <Empty className="py-6">
                                    <EmptyMedia variant="icon">
                                        <FileText className="h-5 w-5" />
                                    </EmptyMedia>
                                    <EmptyHeader>
                                        <EmptyTitle>No assignments found</EmptyTitle>
                                        <EmptyDescription>Assignment data for this journey is not available.</EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
