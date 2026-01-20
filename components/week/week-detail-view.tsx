'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  CheckCircle2,
  PenLine,
  Loader2,
  Share2
} from 'lucide-react'
import { toast } from 'sonner'
import type { Profile, Pairing, WeeklyContent, Assignment, Reflection } from '@/lib/types'
import { AssignmentCard } from '@/components/dashboard/assignment-card'
import { formatDistanceToNow } from 'date-fns'

interface WeekDetailViewProps {
  profile: Profile
  pairing: Pairing
  partner: Profile | null
  weekContent: WeeklyContent
  assignments: Assignment[]
  assignmentProgress: { id: string; assignment_id: string; status: string; notes: string | null; completed_at: string | null }[]
  reflections: (Reflection & { user: { id: string; full_name: string | null; avatar_url: string | null } | null })[]
}

export function WeekDetailView({
  profile,
  pairing,
  partner,
  weekContent,
  assignments,
  assignmentProgress,
  reflections,
}: WeekDetailViewProps) {
  const router = useRouter()
  const [reflectionText, setReflectionText] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  const completedCount = assignmentProgress.filter(p => p.status === 'completed').length
  const progressPercentage = assignments.length > 0 
    ? Math.round((completedCount / assignments.length) * 100) 
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

  const assignmentsWithProgress = assignments.map(assignment => ({
    ...assignment,
    progress: assignmentProgress.find(p => p.assignment_id === assignment.id),
  }))

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <Badge variant="secondary" className="mb-2">Week {weekNumber}</Badge>
            <h1 className="text-2xl font-bold text-foreground">{weekContent.title}</h1>
            <p className="text-muted-foreground mt-1">{weekContent.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {hasPrevWeek && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/week/${weekNumber - 1}`}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Week {weekNumber - 1}
                </Link>
              </Button>
            )}
            {hasNextWeek && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/week/${weekNumber + 1}`}>
                  Week {weekNumber + 1}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Scripture */}
          {weekContent.scripture_reference && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Scripture Focus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-serif italic text-lg text-foreground">
                  {weekContent.scripture_reference}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Assignments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Assignments</CardTitle>
                <Badge variant="secondary">
                  {completedCount}/{assignments.length} Complete
                </Badge>
              </div>
              <CardDescription>
                Complete these assignments to progress in your journey
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignmentsWithProgress.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  progress={assignment.progress}
                  pairingId={pairing.id}
                  userId={profile.id}
                  userRole={profile.role || undefined}
                  leaderId={pairing.leader_id}
                  learnerName={profile.role === 'learner' ? (profile.full_name || 'Learner') : (partner?.full_name || 'Learner')}
                  currentWeek={weekNumber}
                  totalWeekAssignments={assignments.length}
                  completedWeekAssignments={completedCount}
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
            <Card>
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
          <Card>
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
                            <AvatarImage src={reflection.user?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
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
    </div>
  )
}
