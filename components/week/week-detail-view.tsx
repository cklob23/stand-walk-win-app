'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookMarked,
  CheckCircle2,
  PenLine,
  Loader2,
  Share2
} from 'lucide-react'
import { toast } from 'sonner'
import type { Profile, Pairing, WeeklyContent, Assignment, Reflection } from '@/lib/types'
import { AssignmentCard } from '@/components/dashboard/assignment-card'
import { groupAssignments, getAllIdsForGroup } from '@/lib/assignment-grouping'
import { formatDistanceToNow } from 'date-fns'
import { scriptureToUrl } from '@/lib/bible-utils'
import { ScriptureText } from '@/components/bible/scripture-text'
import { FeatureTour } from '@/components/onboarding/feature-tour'
import { weekDetailSteps } from '@/lib/tour-steps'
import { WeekCelebrationPopup } from '@/components/celebration/week-celebration-popup'

interface AssignmentReaction {
  id: string
  assignment_progress_id: string
  user_id: string
  emoji: string
  created_at: string
}

interface WeekDetailViewProps {
  profile: Profile
  pairing: Pairing
  partner: Profile | null
  weekContent: WeeklyContent
  assignments: Assignment[]
  assignmentProgress: { id: string; assignment_id: string; status: string; notes: string | null; completed_at: string | null; user_id?: string; leader_reply?: string | null; leader_reply_at?: string | null }[]
  learnerProgress: { id: string; assignment_id: string; status: string; notes: string | null; completed_at: string | null; user_id?: string; leader_reply?: string | null; leader_reply_at?: string | null }[]
  assignmentReactions?: AssignmentReaction[]
  reflections: (Reflection & { user: { id: string; full_name: string | null; avatar_url: string | null } | null })[]
  hasWeeklyMeeting?: boolean
  bibleTranslation?: string
  bibleTextSize?: string
  expandedAssignmentId?: string
  // Journey and org context for graduation
  journeyName?: string
  journeySubtitle?: string
  organizationId?: string | null
  organizationName?: string | null
  // Celebration data
  celebrationWeek?: number | null
  celebrationWeekTitle?: string | null
}

export function WeekDetailView({
  profile,
  pairing,
  partner,
  weekContent,
  assignments,
  assignmentProgress,
  learnerProgress,
  assignmentReactions = [],
  reflections,
  hasWeeklyMeeting = false,
  bibleTranslation = 'ESV',
  bibleTextSize = 'base',
  expandedAssignmentId,
  journeyName,
  journeySubtitle,
  organizationId,
  organizationName,
  celebrationWeek,
  celebrationWeekTitle,
}: WeekDetailViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPairingId = searchParams.get('pairing')

  // Helper to build URLs with pairing param for leaders
  const buildUrl = (path: string) => {
    if (profile.role !== 'leader' || !currentPairingId) return path
    return `${path}?pairing=${currentPairingId}`
  }

  const scriptureTextClass = { sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl', '2xl': 'text-2xl' }[bibleTextSize] || 'text-base'
  const [reflectionText, setReflectionText] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  // Group assignment rows that share the same title (multi-question assignments)
  const groupedAssignments = groupAssignments(assignments)

  // Only count progress for assignments that belong to THIS week
  // For leaders, show learner's progress; for learners, show own progress
  const isLeader = profile.role === 'leader'
  const progressSource = isLeader && learnerProgress.length > 0 ? learnerProgress : assignmentProgress

  // A grouped assignment counts as completed if its primary row's progress is completed.
  const completedFromProgress = groupedAssignments.filter(g =>
    progressSource.some(p => p.assignment_id === g.id && p.status === 'completed')
  ).length

  // Also count meeting assignment if hasWeeklyMeeting is true but not in progress records
  const meetingAssignment = groupedAssignments.find(a => a.assignment_type === 'meeting')
  const meetingInProgress = meetingAssignment
    ? progressSource.some(p => p.assignment_id === meetingAssignment.id && p.status === 'completed')
    : false
  const meetingAutoCompleted = hasWeeklyMeeting && meetingAssignment && !meetingInProgress ? 1 : 0

  const completedCount = completedFromProgress + meetingAutoCompleted
  const progressPercentage = groupedAssignments.length > 0
    ? Math.round((completedCount / groupedAssignments.length) * 100)
    : 0

  const weekNumber = weekContent.week_number
  const hasPrevWeek = weekNumber > 1
  const hasNextWeek = weekNumber < 6 && weekNumber < pairing.current_week

  const handleSubmitReflection = async () => {
    if (!reflectionText.trim()) {
      toast.error('Please write a reflection')
      return
    }

    setIsSubmitting(true)

    const { error } = await supabase
      .from('reflections')
      .insert({
        pairing_id: pairing.id,
        user_id: profile.id,
        week_number: weekNumber,
        reflection_text: reflectionText.trim(),
        is_shared: isShared,
      })

    if (error) {
      toast.error('Failed to save reflection')
      setIsSubmitting(false)
      return
    }

    toast.success('Reflection saved!')
    setReflectionText('')
    setIsSubmitting(false)
    router.refresh()
  }

  const assignmentsWithProgress = groupedAssignments.map(group => ({
    ...group,
    progress: assignmentProgress.find(p => p.assignment_id === group.id),
    learnerProgress: learnerProgress.find(p => p.assignment_id === group.id),
  }))

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:py-6 overflow-x-hidden">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => router.push(buildUrl('/dashboard'))}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div>
            <Badge variant="secondary" className="mb-2">Week {weekNumber}</Badge>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{weekContent.title}</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">{weekContent.description}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasPrevWeek && (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl(`/dashboard/week/${weekNumber - 1}`)}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Week {weekNumber - 1}
                </Link>
              </Button>
            )}
            {hasNextWeek && (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl(`/dashboard/week/${weekNumber + 1}`)}>
                  Week {weekNumber + 1}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 min-w-0">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* Scripture */}
          {weekContent.scripture_reference && (
            <Card data-tour="week-scripture" className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Scripture Focus
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className={`font-serif italic text-foreground break-words leading-relaxed ${scriptureTextClass}`}>
                  <ScriptureText
                    reference={weekContent.scripture_reference!}
                    translation={bibleTranslation}
                  />
                </p>
                {scriptureToUrl(weekContent.scripture_reference!) && (
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent" asChild>
                    <Link href={scriptureToUrl(weekContent.scripture_reference!)!}>
                      <BookMarked className="h-4 w-4" />
                      Read in Bible
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Assignments */}
          <Card data-tour="week-assignments">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Assignments</CardTitle>
                <Badge variant="secondary">
                  {completedCount}/{groupedAssignments.length} Complete
                </Badge>
              </div>
              <CardDescription>
                Complete these assignments to progress in your journey
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignmentsWithProgress.map((assignment: any) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  progress={assignment.progress}
                  learnerProgress={assignment.learnerProgress}
                  learnerProgressReactions={assignment.learnerProgress?.id
                    ? assignmentReactions.filter(r => r.assignment_progress_id === assignment.learnerProgress?.id)
                    : []
                  }
                  progressReactions={assignment.progress?.id
                    ? assignmentReactions.filter(r => r.assignment_progress_id === assignment.progress?.id)
                    : []
                  }
                  pairingId={pairing.id}
                  userId={profile.id}
                  userRole={profile.role === 'leader' ? 'leader' : 'learner'}
                  leaderId={pairing.leader_id}
                  learnerName={profile.role === 'learner' ? (profile.full_name || 'Learner') : (partner?.full_name || 'Learner')}
                  leaderName={profile.role === 'learner' ? (partner?.full_name || 'your leader') : (profile.full_name || 'Leader')}
                  currentWeek={weekNumber}
                  totalWeekAssignments={groupedAssignments.length}
                  completedWeekAssignments={completedCount}
                  hasWeeklyMeeting={hasWeeklyMeeting}
                  weekTitle={weekContent.title}
                  defaultOpen={expandedAssignmentId ? getAllIdsForGroup(assignment).includes(expandedAssignmentId) : false}
                  userName={profile.role === 'learner' ? (profile.full_name || 'Learner') : (partner?.full_name || 'Learner')}
                  journeyName={journeyName}
                  journeySubtitle={journeySubtitle}
                  organizationId={organizationId}
                  organizationName={organizationName}
                />
              ))}
              {assignments.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No assignments for this week.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Write Reflection */}
          {profile.role === 'learner' && (
            <Card data-tour="week-reflection">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenLine className="h-5 w-5 text-primary" />
                  Weekly Reflection
                </CardTitle>
                <CardDescription>
                  Write your thoughts and takeaways from this week
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value)}
                  placeholder="What did you learn this week? How has it impacted your faith journey?"
                  rows={5}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isShared}
                      onChange={(e) => setIsShared(e.target.checked)}
                      className="rounded border-border"
                    />
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Share with Leader
                    </span>
                  </label>
                  <Button
                    onClick={handleSubmitReflection}
                    disabled={isSubmitting || !reflectionText.trim()}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Reflection'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Progress */}
          <Card data-tour="week-progress">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Week Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Completion</span>
                  <span className="text-sm font-medium">{progressPercentage}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
              {progressPercentage === 100 && (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">Week Complete!</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reflections */}
          {reflections.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Reflections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reflections
                  .filter(r => r.is_shared || r.user_id === profile.id)
                  .map((reflection) => {
                    const userInitials = reflection.user?.full_name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase() || '?'

                    return (
                      <div key={reflection.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            {reflection.user?.avatar_url && reflection.user.avatar_url.length > 0 ? <AvatarImage src={reflection.user.avatar_url} alt={reflection.user.full_name || ''} /> : null}
                            <AvatarFallback className="text-xs bg-primary/10 text-primary" delayMs={0}>
                              {userInitials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-foreground">
                            {reflection.user?.full_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(reflection.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground pl-8">
                          {reflection.reflection_text}
                        </p>
                      </div>
                    )
                  })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Onboarding Tour */}
      <FeatureTour tourId="week-detail" steps={weekDetailSteps} />

      {/* Week Celebration Popup */}
      {profile.role === 'learner' && (
        <WeekCelebrationPopup
          pairingId={pairing.id}
          celebrationWeek={celebrationWeek || null}
          celebrationWeekTitle={celebrationWeekTitle || null}
        />
      )}
    </div>
  )
}
