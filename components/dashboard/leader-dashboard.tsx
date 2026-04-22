'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  BookOpen,
  CheckCircle2,
  Clock,
  ArrowRight,
  Calendar,
  TrendingUp,
  BookHeart,
  BookMarked,
  CalendarPlus
} from 'lucide-react'
import type { Profile, Pairing, WeeklyContent, Assignment, Message, Notification, ScheduledMeeting } from '@/lib/types'
import { Video, Phone, MapPin, Monitor } from 'lucide-react'
import { WeeklyTimeline } from './weekly-timeline'
import { AddToCalendarButton } from '@/components/add-to-calendar-button'
import { QuickChat } from './quick-chat'
import { format, parseISO } from 'date-fns'
import { scriptureToUrl } from '@/lib/bible-utils'
import { ScriptureText } from '@/components/bible/scripture-text'
import { DailyJournalPopup } from '@/components/journal/daily-journal-popup'
import { FeatureTour } from '@/components/onboarding/feature-tour'
import { leaderDashboardSteps } from '@/lib/tour-steps'

interface AssignmentReaction {
  id: string
  assignment_progress_id: string
  user_id: string
  emoji: string
  created_at: string
}

interface LeaderDashboardProps {
  profile: Profile
  pairing: Pairing
  partner: Profile | null
  weeklyContent: WeeklyContent[]
  assignments: Assignment[]
  assignmentProgress: { id?: string; assignment_id: string; status: string; notes: string | null; completed_at: string | null; leader_reply?: string | null; leader_reply_at?: string | null }[]
  assignmentReactions?: AssignmentReaction[]
  recentMessages: Message[]
  notifications: Notification[]
  currentWeek: number
  nextMeeting: ScheduledMeeting | null
  hasWeeklyMeeting: boolean
  completedMeetingsCount?: number
  sharedJournalEntries?: { id: string; entry_date: string; prayer_items: string; god_saying: string }[]
  hasJournalEntryToday: boolean
  expandedAssignmentId?: string | null
}

export function LeaderDashboard({
  profile,
  pairing,
  partner,
  weeklyContent,
  assignments,
  assignmentProgress,
  assignmentReactions = [],
  recentMessages,
  currentWeek,
  nextMeeting,
  completedMeetingsCount = 0,
  sharedJournalEntries = [],
  hasJournalEntryToday,
  expandedAssignmentId,
}: LeaderDashboardProps) {
  const currentPairingId = pairing.id
  const currentWeekContent = weeklyContent.find(w => w.week_number === currentWeek)

  // Calculate overall progress - only count assignments from unlocked weeks
  const unlockedAssignments = assignments.filter(a => a.week_number <= currentWeek)
  const unlockedAssignmentIds = new Set(unlockedAssignments.map(a => a.id))

  // Count meeting assignments that should be auto-completed
  // Meeting assignments for week N are complete if N completed meetings exist
  // Since hasWeeklyMeeting indicates current week meeting is done, 
  // all meeting assignments up to currentWeek are complete
  const meetingAssignmentsUpToCurrent = unlockedAssignments.filter(a => a.assignment_type === 'meeting')
  const completedMeetingIdsFromProgress = new Set(
    assignmentProgress
      .filter(p => p.status === 'completed' && meetingAssignmentsUpToCurrent.some(m => m.id === p.assignment_id))
      .map(p => p.assignment_id)
  )
  // Count meeting assignments that are auto-completed but not in progress records
  // We use hasWeeklyMeeting (which checks if enough meetings exist for current week)
  // So all meeting assignments for weeks 1 through currentWeek should be complete if hasWeeklyMeeting is true
  const autoCompletedMeetings = meetingAssignmentsUpToCurrent.filter(
    m => !completedMeetingIdsFromProgress.has(m.id)
  ).length

  const totalAssignments = unlockedAssignments.length
  const completedFromProgress = assignmentProgress.filter(p =>
    unlockedAssignmentIds.has(p.assignment_id) && p.status === 'completed'
  ).length
  const completedAssignments = completedFromProgress + autoCompletedMeetings
  const progressPercentage = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0

  // Calculate learner's progress for current week
  const currentWeekAssignments = assignments.filter(a => a.week_number === currentWeek)
  const currentWeekMeeting = currentWeekAssignments.find(a => a.assignment_type === 'meeting')
  const currentWeekMeetingAutoCompleted = currentWeekMeeting &&
    !assignmentProgress.some(p => p.assignment_id === currentWeekMeeting.id && p.status === 'completed')
    ? 1 : 0
  const learnerProgressFromRecords = assignmentProgress.filter(p =>
    currentWeekAssignments.some(a => a.id === p.assignment_id) &&
    p.status === 'completed'
  ).length
  const learnerProgress = learnerProgressFromRecords + currentWeekMeetingAutoCompleted

  const partnerInitials = partner?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '?'

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:py-6">
      {/* Welcome Section */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          Welcome back, {profile.full_name?.split(' ')[0]}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          {"Here's"} how your Learner is progressing on their journey.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content - Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Week Card */}
          <Card data-tour="leader-overview" className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="flex items-start gap-2 text-base sm:text-lg">
                    <Calendar className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="break-words">Week {currentWeek}: {currentWeekContent?.title || 'Loading...'}</span>
                  </CardTitle>
                  <CardDescription className="mt-1 line-clamp-2">
                    {currentWeekContent?.description}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="shrink-0 w-fit">
                  {learnerProgress}/{currentWeekAssignments.length} Complete
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentWeekContent?.scripture_reference && (
                  <div className="p-3 sm:p-4 rounded-lg bg-primary/5 border border-primary/10">
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
                    <p className="text-sm text-muted-foreground font-serif italic break-words">
                      <ScriptureText
                        reference={currentWeekContent.scripture_reference}
                        translation={profile.bible_translation_preference || 'ESV'}
                      />
                    </p>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button asChild className="w-full sm:w-auto">
                    <Link href={`/dashboard/week/${currentWeek}${currentPairingId ? `?pairing=${currentPairingId}` : ''}`}>
                      View Week Content
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="w-full sm:w-auto bg-transparent">
                    <Link href={`/dashboard/progress${currentPairingId ? `?pairing=${currentPairingId}` : ''}`}>
                      <TrendingUp className="mr-2 h-4 w-4" />
                      View Progress
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card data-tour="leader-timeline" className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <BookOpen className="h-5 w-5 text-primary shrink-0" />
                <span>6-Week Journey</span>
              </CardTitle>
              <CardDescription className="text-sm">
                Track progress through the discipleship journey
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

          {/* Quick Chat */}
          <Card data-tour="leader-messages" className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <MessageSquare className="h-5 w-5 text-primary shrink-0" />
                <span>Quick Message</span>
              </CardTitle>
              <CardDescription className="text-sm">
                Send encouragement or schedule your next meeting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuickChat
                pairingId={pairing.id}
                odUserId={profile.id}
                odUserName={profile.full_name || 'You'}
                odUserAvatar={profile.avatar_url}
                partnerId={partner?.id || ''}
                recentMessages={recentMessages}
                partnerName={partner?.full_name || 'Learner'}
                partnerAvatar={partner?.avatar_url}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Right Side */}
        <div className="space-y-6">
          {/* Current Learner Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Current Learner</CardTitle>
            </CardHeader>
            <CardContent>
              {partner ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {partner.avatar_url && partner.avatar_url.length > 0 ? (
                      <AvatarImage src={partner.avatar_url} alt={partner.full_name || 'Learner'} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary" delayMs={0}>
                      {partnerInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{partner.full_name}</p>
                    <p className="text-xs text-muted-foreground">Week {pairing.current_week || 1}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No learner selected</p>
              )}
              {partner?.bio && (
                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                  {partner.bio}
                </p>
              )}
              <Button variant="outline" className="w-full mt-4 bg-transparent" asChild>
                <Link href={`/dashboard/messages${currentPairingId ? `?pairing=${currentPairingId}` : ''}`}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Send Message
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Next Meeting */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Next Meeting
              </CardTitle>
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
                    // Leader always sees learner's phone for calls (partner = learner)
                    const partnerPhone = partner?.phone
                    const partnerZoom = partner?.zoom_link
                    if (type === 'facetime' || type === 'phone') {
                      if (partnerPhone) {
                        const cleaned = partnerPhone.replace(/[^0-9+]/g, '')
                        const href = type === 'facetime' ? `facetime:${cleaned}` : `tel:${cleaned}`
                        return (
                          <a href={href} className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {type === 'facetime' ? 'FaceTime' : 'Call'} {partner?.full_name?.split(' ')[0] || 'Learner'}
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
                  <AddToCalendarButton meeting={nextMeeting} partnerName={partner?.full_name || 'Learner'} partnerPhone={partner?.phone} weekTopic={currentWeekContent?.title} weekNumber={currentWeek} />
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground mb-2">No upcoming meetings</p>
                  <Button variant="outline" size="sm" asChild className="bg-transparent">
                    <Link href={`/dashboard/schedule${currentPairingId ? `?pairing=${currentPairingId}` : ''}`}>
                      <Calendar className="mr-2 h-3 w-3" />
                      Set Availability
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overall Progress */}
          <Card data-tour="leader-assignments">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Overall Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Assignments Completed</span>
                  <span className="text-sm font-medium">{progressPercentage}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-1 text-success mb-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xl font-bold">{completedAssignments}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-1 text-warning mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xl font-bold">{totalAssignments - completedAssignments}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shared Journal Entries */}
          {sharedJournalEntries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookHeart className="h-4 w-4 text-primary" />
                    Shared Journal
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                    <Link href="/dashboard/journal">View All</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {sharedJournalEntries.slice(0, 3).map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {format(parseISO(entry.entry_date), 'MMM d, yyyy')}
                    </p>
                    {entry.prayer_items && (
                      <p className="text-sm text-foreground line-clamp-2">{entry.prayer_items}</p>
                    )}
                    {entry.god_saying && (
                      <p className="text-sm text-foreground italic font-serif line-clamp-2">{entry.god_saying}</p>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 bg-transparent" asChild>
                      <Link
                        href={`/dashboard/schedule?notes=${encodeURIComponent(`Discuss journal entry from ${format(parseISO(entry.entry_date), 'MMM d')}: ${entry.prayer_items?.slice(0, 80) || entry.god_saying?.slice(0, 80) || 'Prayer journal'}`)}`}
                      >
                        <CalendarPlus className="h-3 w-3" />
                        Schedule Meeting
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Covenant Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Covenant Agreement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Your Signature</span>
                  {pairing.covenant_accepted_leader ? (
                    <Badge variant="default" className="bg-success text-success-foreground">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Signed
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Learner Signature</span>
                  {pairing.covenant_accepted_learner ? (
                    <Badge variant="default" className="bg-success text-success-foreground">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Signed
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
              </div>
              {(!pairing.covenant_accepted_leader || !pairing.covenant_accepted_learner) && (
                <Button variant="outline" className="w-full mt-4 bg-transparent" asChild>
                  <Link href={`/dashboard/covenant${currentPairingId ? `?pairing=${currentPairingId}` : ''}`}>
                    View Covenant
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Daily Journal Popup */}
      <DailyJournalPopup
        pairingId={pairing.id}
        hasEntryToday={hasJournalEntryToday}
        leaderName={partner?.full_name || 'your partner'}
      />

      {/* Onboarding Tour */}
      <FeatureTour tourId="leader-dashboard" steps={leaderDashboardSteps} />
    </div>
  )
}
