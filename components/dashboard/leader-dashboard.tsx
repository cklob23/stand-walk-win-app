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
  TrendingUp
} from 'lucide-react'
import type { Profile, Pairing, WeeklyContent, Assignment, Message, Notification } from '@/lib/types'
import { WeeklyTimeline } from './weekly-timeline'
import { QuickChat } from './quick-chat'

interface LeaderDashboardProps {
  profile: Profile
  pairing: Pairing
  partner: Profile | null
  weeklyContent: WeeklyContent[]
  assignments: Assignment[]
  assignmentProgress: { id?: string; assignment_id: string; status: string; notes: string | null; completed_at: string | null }[]
  recentMessages: Message[]
  notifications: Notification[]
  currentWeek: number
}

export function LeaderDashboard({
  profile,
  pairing,
  partner,
  weeklyContent,
  assignments,
  assignmentProgress,
  recentMessages,
  currentWeek,
}: LeaderDashboardProps) {
  const currentWeekContent = weeklyContent.find(w => w.week_number === currentWeek)
  
  // Calculate overall progress - only count assignments from unlocked weeks
  const unlockedAssignments = assignments.filter(a => a.week_number <= currentWeek)
  const unlockedAssignmentIds = new Set(unlockedAssignments.map(a => a.id))
  
  const totalAssignments = unlockedAssignments.length
  const completedAssignments = assignmentProgress.filter(p => 
    unlockedAssignmentIds.has(p.assignment_id) && p.status === 'completed'
  ).length
  const progressPercentage = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0

  // Calculate learner's progress for current week
  const currentWeekAssignments = assignments.filter(a => a.week_number === currentWeek)
  const learnerProgress = assignmentProgress.filter(p => 
    currentWeekAssignments.some(a => a.id === p.assignment_id) && 
    p.status === 'completed'
  ).length

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
          <Card className="overflow-hidden">
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
                    <p className="text-sm font-medium text-primary mb-1">Scripture Focus</p>
                    <p className="text-sm text-muted-foreground font-serif italic break-words">
                      {currentWeekContent.scripture_reference}
                    </p>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button asChild className="w-full sm:w-auto">
                    <Link href={`/dashboard/week/${currentWeek}`}>
                      View Week Content
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="w-full sm:w-auto bg-transparent">
                    <Link href="/dashboard/progress">
                      <TrendingUp className="mr-2 h-4 w-4" />
                      View Progress
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="overflow-hidden">
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
              />
            </CardContent>
          </Card>

          {/* Quick Chat */}
          <Card className="overflow-hidden">
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
          {/* Learner Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Learner</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={partner?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {partnerInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {partner?.full_name || 'Learner'}
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
                  <Link href="/dashboard/covenant">
                    View Covenant
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
