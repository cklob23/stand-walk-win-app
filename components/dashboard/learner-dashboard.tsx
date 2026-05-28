'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Calendar,
  BookOpen,
  ArrowRight,
  MessageSquare,
  CheckCircle2,
  Circle,
  PenLine,
  Zap,
  MessageCircle,
  Heart,
  AlertTriangle,
  BookMarked,
  GraduationCap
} from 'lucide-react'
import type { Profile, Pairing, WeeklyContent, Assignment, Message, Notification, ScheduledMeeting } from '@/lib/types'
import { groupAssignments } from '@/lib/assignment-grouping'
import { Video, Phone, MapPin, Monitor } from 'lucide-react'
import { WeeklyTimeline } from './weekly-timeline'
import { QuickChat } from './quick-chat'
import { AddToCalendarButton } from '@/components/add-to-calendar-button'
import { DailyJournalPopup } from '@/components/journal/daily-journal-popup'
import { scriptureToUrl } from '@/lib/bible-utils'
import { ScriptureText } from '@/components/bible/scripture-text'
import { FeatureTour } from '@/components/onboarding/feature-tour'
import { learnerDashboardSteps } from '@/lib/tour-steps'
import { GraduationModal } from '@/components/graduation/graduation-modal'
import { WeekCelebrationPopup } from '@/components/celebration/week-celebration-popup'

interface LearnerDashboardProps {
  profile: Profile
  pairing: Pairing
  partner: Profile | null
  weeklyContent: WeeklyContent[]
  assignments: Assignment[]
  assignmentProgress: { id?: string; assignment_id: string; status: string; notes: string | null; completed_at: string | null; leader_reply?: string | null; leader_reply_at?: string | null }[]
  recentMessages: Message[]
  notifications: Notification[]
  currentWeek: number
  nextMeeting: ScheduledMeeting | null
  hasWeeklyMeeting: boolean
  completedMeetingsCount?: number
  hasJournalEntryToday: boolean
  // Celebration data from server
  celebrationWeek?: number | null
  celebrationWeekTitle?: string | null
}

export function LearnerDashboard({
  profile,
  pairing,
  partner,
  weeklyContent,
  assignments,
  assignmentProgress,
  recentMessages,
  currentWeek,
  nextMeeting,
  hasWeeklyMeeting,
  completedMeetingsCount = 0,
  hasJournalEntryToday,
  celebrationWeek,
  celebrationWeekTitle,
}: LearnerDashboardProps) {
  const [showGraduationModal, setShowGraduationModal] = useState(false)
  const [hasShownGraduation, setHasShownGraduation] = useState(false)

  const currentWeekContent = weeklyContent.find(w => w.week_number === currentWeek)

  // Group multi-question assignments so each logical assignment counts once
  const groupedAll = groupAssignments(assignments)

  // Get current week assignments (grouped) with progress
  const currentWeekAssignments = groupedAll
    .filter(a => a.week_number === currentWeek)
    .map(assignment => ({
      ...assignment,
      progress: assignmentProgress.find(p => p.assignment_id === assignment.id),
    }))

  // Calculate overall progress - only count assignments from unlocked weeks
  const unlockedAssignments = groupedAll.filter(a => a.week_number <= currentWeek)
  const unlockedAssignmentIds = new Set(unlockedAssignments.map(a => a.id))

  const totalAssignments = unlockedAssignments.length
  const completedAssignments = assignmentProgress.filter(p =>
    unlockedAssignmentIds.has(p.assignment_id) && p.status === 'completed'
  ).length
  const progressPercentage = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0

  // Calculate full journey completion (all 6 weeks)
  const TOTAL_WEEKS = 6
  const allAssignmentsTotal = groupedAll.length
  const allPrimaryIds = new Set(groupedAll.map(a => a.id))
  const allAssignmentsCompleted = assignmentProgress.filter(
    p => allPrimaryIds.has(p.assignment_id) && p.status === 'completed'
  ).length
  const journeyCompletionPercentage = allAssignmentsTotal > 0
    ? Math.round((allAssignmentsCompleted / allAssignmentsTotal) * 100)
    : 0
  const isJourneyComplete = journeyCompletionPercentage === 100 && currentWeek >= TOTAL_WEEKS && !profile.graduated_at

  // Show graduation modal when journey is 100% complete
  useEffect(() => {
    if (isJourneyComplete && !hasShownGraduation) {
      // Small delay to let the UI update first
      const timer = setTimeout(() => {
        setShowGraduationModal(true)
        setHasShownGraduation(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isJourneyComplete, hasShownGraduation])

  const partnerInitials = partner?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '?'

  // Get next incomplete assignment
  const nextAssignment = currentWeekAssignments.find(a =>
    !a.progress || a.progress.status !== 'completed'
  )

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 sm:py-6 overflow-hidden">
      {/* Welcome Section */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
          Welcome back, {profile.full_name?.split(' ')[0]}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Continue your growth journey with your Leader.
        </p>
      </div>

      {/* Graduation Banner - shows when journey is 100% complete */}
      {isJourneyComplete && (
        <Card className="mb-6 border-primary bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Journey Complete!</p>
                  <p className="text-sm text-muted-foreground">
                    Congratulations! You've completed all assignments.
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowGraduationModal(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                See Options
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3 w-full">
        {/* Main Content - Left Side */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* Current Week Card */}
          <Card data-tour="learner-week-card" className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden w-full">
            <CardHeader className="pb-3">
              <div className="min-w-0 w-full">
                <CardTitle className="flex items-start gap-2 text-base sm:text-lg">
                  <Calendar className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="line-clamp-2">Week {currentWeek}: {currentWeekContent?.title || 'Loading...'}</span>
                </CardTitle>
                <CardDescription className="mt-1 line-clamp-2">
                  {currentWeekContent?.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4 w-full">
                {currentWeekContent?.scripture_reference && (
                  <div className="p-3 rounded-lg bg-card border w-full">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-primary">Scripture Focus</p>
                      {scriptureToUrl(currentWeekContent.scripture_reference) && (
                        <Link
                          href={scriptureToUrl(currentWeekContent.scripture_reference)!}
                          className="flex items-center gap-1 text-xs text-primary hover:underline font-medium shrink-0"
                        >
                          <BookMarked className="h-3 w-3" />
                          Read
                        </Link>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground font-serif italic line-clamp-4">
                      <ScriptureText
                        reference={currentWeekContent.scripture_reference}
                        translation={profile.bible_translation_preference || 'ESV'}
                      />
                    </p>
                  </div>
                )}

                {/* Progress for this week */}
                <div>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">This Week&apos;s Progress</span>
                    <span className="text-sm font-medium whitespace-nowrap">
                      {currentWeekAssignments.filter(a => a.progress?.status === 'completed').length}/
                      {currentWeekAssignments.length}
                    </span>
                  </div>
                  <Progress
                    value={
                      currentWeekAssignments.length > 0
                        ? (currentWeekAssignments.filter(a => a.progress?.status === 'completed').length / currentWeekAssignments.length) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>

                <Button asChild className="w-full sm:w-auto">
                  <Link href={`/dashboard/week/${currentWeek}`}>
                    {nextAssignment ? 'Continue Learning' : 'View Week Content'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current Assignments Overview */}
          <Card data-tour="learner-assignments" className="overflow-hidden w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Sparkles className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">This Week&apos;s Assignments</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Complete these to progress in your journey
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 w-full">
                {currentWeekAssignments.map((assignment) => {
                  const isCompleted = assignment.progress?.status === 'completed'
                  const typeColors: Record<string, string> = {
                    reading: 'bg-blue-100 text-blue-700',
                    reflection: 'bg-amber-100 text-amber-700',
                    action: 'bg-green-100 text-green-700',
                    discussion: 'bg-purple-100 text-purple-700',
                    prayer: 'bg-pink-100 text-pink-700',
                    meeting: 'bg-primary/10 text-primary',
                  }
                  const typeIcons: Record<string, typeof BookOpen> = {
                    reading: BookOpen,
                    reflection: PenLine,
                    action: Zap,
                    discussion: MessageCircle,
                    prayer: Heart,
                    meeting: Calendar,
                  }
                  const Icon = typeIcons[assignment.assignment_type] || Circle
                  const colorClass = isCompleted
                    ? 'bg-success/20 text-success'
                    : (typeColors[assignment.assignment_type] || 'bg-muted text-muted-foreground')

                  return (
                    <Link
                      key={assignment.id}
                      href={`/dashboard/week/${currentWeek}?assignment=${assignment.id}`}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-colors group cursor-pointer"
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${isCompleted ? 'text-muted-foreground line-through' : 'text-foreground group-hover:text-primary'
                            }`}>
                            {assignment.title}
                          </p>
                          {isCompleted && (
                            <Badge variant="secondary" className="shrink-0 text-xs bg-success/10 text-success border-0">
                              Done
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground capitalize mb-1">
                          {assignment.assignment_type.replace('_', ' ')}
                        </p>
                        {assignment.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {assignment.description}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  )
                })}
                {currentWeekAssignments.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No assignments for this week yet.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card data-tour="learner-timeline" className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <BookOpen className="h-5 w-5 text-primary shrink-0" />
                <span>Your Journey</span>
              </CardTitle>
              <CardDescription className="text-sm">
                Track your progress through the 6-week discipleship journey
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WeeklyTimeline
                weeklyContent={weeklyContent}
                currentWeek={currentWeek}
                assignments={assignments}
                assignmentProgress={assignmentProgress}
                completedMeetingsCount={completedMeetingsCount}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Right Side */}
        <div className="space-y-6 min-w-0">
          {/* Leader Card */}
          <Card data-tour="learner-partner">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Leader</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  {partner?.avatar_url && partner.avatar_url.length > 0 ? <AvatarImage src={partner.avatar_url} alt={partner.full_name || 'Partner'} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-lg" delayMs={0}>
                    {partnerInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {partner?.full_name || 'Leader'}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {partner?.email}
                  </p>
                </div>
              </div>
              {partner?.bio && (
                <p className="mt-4 text-sm text-muted-foreground line-clamp-3">
                  {partner.bio}
                </p>
              )}
              <Button variant="outline" className="w-full mt-4 bg-transparent" asChild>
                <Link href="/dashboard/messages">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Send Message
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Overall Progress */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Overall Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Journey Completion</span>
                  <span className="text-sm font-medium">{progressPercentage}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-muted-foreground">{completedAssignments} Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{totalAssignments - completedAssignments} Remaining</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Covenant Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Covenant Agreement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Your Signature</span>
                  {pairing.covenant_accepted_learner ? (
                    <Badge variant="default" className="bg-success text-success-foreground">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Signed
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Leader Signature</span>
                  {pairing.covenant_accepted_leader ? (
                    <Badge variant="default" className="bg-success text-success-foreground">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Signed
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
              </div>
              {!pairing.covenant_accepted_learner && (
                <Button className="w-full mt-4" asChild>
                  <Link href="/dashboard/covenant">
                    Sign Covenant
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Next Meeting */}
          <Card className={!hasWeeklyMeeting ? 'border-amber-500/40' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Weekly Meeting
              </CardTitle>
              {!hasWeeklyMeeting && (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Required: Complete a meeting this week</span>
                </div>
              )}
              {hasWeeklyMeeting && (
                <div className="flex items-center gap-1.5 text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Meeting completed this week</span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {nextMeeting ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {new Date(nextMeeting.meeting_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const [h, m] = nextMeeting.start_time.slice(0, 5).split(':').map(Number)
                      const ampm = h >= 12 ? 'PM' : 'AM'
                      return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
                    })()}
                    {' - '}
                    {(() => {
                      const [h, m] = nextMeeting.end_time.slice(0, 5).split(':').map(Number)
                      const ampm = h >= 12 ? 'PM' : 'AM'
                      return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`
                    })()}
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    {nextMeeting.meeting_type === 'facetime' && <><Video className="h-3 w-3 mr-1" />FaceTime</>}
                    {nextMeeting.meeting_type === 'zoom' && <><Monitor className="h-3 w-3 mr-1" />Zoom</>}
                    {nextMeeting.meeting_type === 'phone' && <><Phone className="h-3 w-3 mr-1" />Phone</>}
                    {nextMeeting.meeting_type === 'in_person' && <><MapPin className="h-3 w-3 mr-1" />In Person</>}
                  </Badge>
                  {(() => {
                    const type = nextMeeting.meeting_type
                    const link = nextMeeting.meeting_link
                    // Learner always sees leader's phone for calls (partner = leader)
                    const partnerPhone = partner?.phone
                    const partnerZoom = partner?.zoom_link
                    if (type === 'facetime' || type === 'phone') {
                      if (partnerPhone) {
                        const cleaned = partnerPhone.replace(/[^0-9+]/g, '')
                        const href = type === 'facetime' ? `facetime:${cleaned}` : `tel:${cleaned}`
                        return (
                          <a href={href} className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {type === 'facetime' ? 'FaceTime' : 'Call'} {partner?.full_name?.split(' ')[0] || 'Leader'}
                          </a>
                        )
                      }
                    }
                    if (type === 'zoom') {
                      const zoomUrl = link || partnerZoom
                      if (zoomUrl) {
                        return (
                          <a href={zoomUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            Join Zoom
                          </a>
                        )
                      }
                    }
                    if (link) {
                      return (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block">
                          Join Meeting
                        </a>
                      )
                    }
                    return null
                  })()}
                  <AddToCalendarButton meeting={nextMeeting} partnerName={partner?.full_name || 'Leader'} partnerPhone={partner?.phone} weekTopic={currentWeekContent?.title} weekNumber={currentWeek} />
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground mb-2">No upcoming meetings</p>
                  <Button variant={hasWeeklyMeeting ? 'outline' : 'default'} size="sm" asChild className={hasWeeklyMeeting ? 'bg-transparent' : ''}>
                    <Link href="/dashboard/schedule">
                      <Calendar className="mr-2 h-3 w-3" />
                      Schedule a Meeting
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Chat */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Quick Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuickChat
                pairingId={pairing.id}
                odUserId={profile.id}
                odUserName={profile.full_name || 'You'}
                odUserAvatar={profile.avatar_url}
                partnerId={partner?.id || ''}
                recentMessages={recentMessages}
                partnerName={partner?.full_name || 'Leader'}
                partnerAvatar={partner?.avatar_url}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Week Celebration Popup - shows when a week is completed */}
      <WeekCelebrationPopup
        pairingId={pairing.id}
        celebrationWeek={celebrationWeek || null}
        celebrationWeekTitle={celebrationWeekTitle || null}
      />

      {/* Daily Journal Popup */}
      <DailyJournalPopup
        pairingId={pairing.id}
        hasEntryToday={hasJournalEntryToday}
        leaderName={partner?.full_name || 'your leader'}
      />

      {/* Onboarding Tour */}
      <FeatureTour tourId="learner-dashboard" steps={learnerDashboardSteps} />

      {/* Graduation Modal */}
      <GraduationModal
        isOpen={showGraduationModal}
        onClose={() => setShowGraduationModal(false)}
        userId={profile.id}
        userName={profile.full_name?.split(' ')[0] || 'Graduate'}
        pairingId={pairing.id}
        journeyId={pairing.journey_id || undefined}
        journeyName={pairing.journey?.name || 'Stand Walk Run'}
        journeySubtitle={pairing.journey?.description || undefined}
        canBeLeader={profile.can_be_leader !== false}
        subscriptionTier={profile.subscription_tier}
        organizationId={profile.organization_id}
        organizationName={profile.organization?.name}
      />
    </div>
  )
}
