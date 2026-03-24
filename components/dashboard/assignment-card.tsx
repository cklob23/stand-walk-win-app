'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  MessageCircle,
  Heart,
  Zap,
  PenLine,
  ChevronDown,
  Loader2,
  Calendar,
  ArrowRight,
  BookMarked,
  Play,
  Pause,
  RotateCcw,
  HandHeart,
  Send,
  CalendarHeart,
  Cross,
  SmilePlus,
  Reply,
  X,
  Edit2,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import type { Assignment } from '@/lib/types'
import { cn } from '@/lib/utils'
import { notifyAssignmentCompleted, advanceToNextWeek } from '@/lib/notifications'
import { extractScriptureReferences, extractBookReferences } from '@/lib/bible-utils'
import { toggleAssignmentReaction, replyToAssignment, deleteAssignmentReply } from '@/lib/assignment-actions'
import { WeekCelebrationModal } from '@/components/celebration/week-celebration-modal'
import { GraduationModal } from '@/components/graduation/graduation-modal'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'


interface AssignmentReaction {
  id: string
  assignment_progress_id: string
  user_id: string
  emoji: string
  created_at: string
}

interface AssignmentCardProps {
  assignment: Assignment
  progress?: {
    id?: string
    assignment_id: string
    status: string
    notes: string | null
    completed_at: string | null
    leader_reply?: string | null
    leader_reply_at?: string | null
  }
  learnerProgress?: {
    id?: string
    assignment_id: string
    status: string
    notes: string | null
    completed_at: string | null
    leader_reply?: string | null
    leader_reply_at?: string | null
  }
  learnerProgressReactions?: AssignmentReaction[]
  progressReactions?: AssignmentReaction[]
  pairingId: string
  userId: string
  userRole?: 'leader' | 'learner'
  leaderId?: string
  learnerName?: string
  leaderName?: string
  currentWeek?: number
  totalWeekAssignments?: number
  completedWeekAssignments?: number
  hasWeeklyMeeting?: boolean
  weekTitle?: string
  defaultOpen?: boolean
  // Graduation modal props
  userName?: string
  journeyName?: string
  journeySubtitle?: string
  canBeLeader?: boolean
  subscriptionTier?: { max_learners: number } | null
  // Organization context for graduation modal
  organizationId?: string | null
  organizationName?: string | null
}

const typeIcons: Record<string, typeof BookOpen> = {
  reading: BookOpen,
  reflection: PenLine,
  action: Zap,
  discussion: MessageCircle,
  prayer: Heart,
  meeting: Calendar,
}

const typeColors: Record<string, string> = {
  reading: 'bg-blue-100 text-blue-700',
  reflection: 'bg-amber-100 text-amber-700',
  action: 'bg-green-100 text-green-700',
  discussion: 'bg-purple-100 text-purple-700',
  prayer: 'bg-pink-100 text-pink-700',
  meeting: 'bg-primary/10 text-primary',
}

/**
 * Extract a duration in seconds from text like "10 minutes", "5 min", "1 hour", "30 seconds".
 * Returns null if no duration found.
 */
function extractDurationSeconds(text: string): number | null {
  if (!text) return null
  // Match patterns like "10 minutes", "5 min", "1 hour", "30 seconds"
  const match = text.match(/(\d+)\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)/i)
  if (!match) return null
  const value = parseInt(match[1], 10)
  const unit = match[2].toLowerCase()
  if (unit.startsWith('hour') || unit.startsWith('hr')) return value * 3600
  if (unit.startsWith('min')) return value * 60
  if (unit.startsWith('sec')) return value
  return null
}

export function AssignmentCard({
  assignment,
  progress,
  learnerProgress,
  learnerProgressReactions,
  progressReactions,
  pairingId,
  userId,
  userRole,
  leaderId,
  learnerName,
  leaderName,
  currentWeek,
  totalWeekAssignments,
  completedWeekAssignments,
  hasWeeklyMeeting,
  weekTitle,
  defaultOpen = false,
  userName,
  journeyName,
  journeySubtitle,
  canBeLeader = true,
  subscriptionTier,
  organizationId,
  organizationName,
}: AssignmentCardProps) {
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Scroll into view when opened from notification link
  useEffect(() => {
    if (defaultOpen && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [defaultOpen])

  // Initialize response from localStorage draft or saved progress
  const draftKey = `assignment-draft-${assignment.id}`
  const [response, setResponse] = useState(() => {
    // Check localStorage for draft first (only on client)
    if (typeof window !== 'undefined') {
      const draft = localStorage.getItem(draftKey)
      if (draft) return draft
    }
    return progress?.notes || ''
  })
  const [isLoading, setIsLoading] = useState(false)

  // Reactions and reply state (for leaders)
  const [reactions, setReactions] = useState<AssignmentReaction[]>(learnerProgressReactions || [])
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyText, setReplyText] = useState(learnerProgress?.leader_reply || '')
  const [isSendingReply, setIsSendingReply] = useState(false)
  const [isReacting, setIsReacting] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // Celebration modal state
  const [showWeekCelebration, setShowWeekCelebration] = useState(false)
  const [showGraduationModal, setShowGraduationModal] = useState(false)
  const [celebrationWeek, setCelebrationWeek] = useState<number>(0)
  const [celebrationWeekTitle, setCelebrationWeekTitle] = useState<string>('')

  const supabase = createClient()

  // Save response to localStorage as user types (debounced effect)
  useEffect(() => {
    if (response && response !== progress?.notes) {
      localStorage.setItem(draftKey, response)
    } else if (!response || response === progress?.notes) {
      localStorage.removeItem(draftKey)
    }
  }, [response, draftKey, progress?.notes])

  // Prayer timer state
  const isPrayerType = assignment.assignment_type === 'prayer'
  const prayerDuration = isPrayerType ? extractDurationSeconds(assignment.description || '') : null
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(prayerDuration || 0)
  const [timerStarted, setTimerStarted] = useState(false)
  const [timerComplete, setTimerComplete] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Timer countdown effect
  useEffect(() => {
    if (timerRunning && timerSecondsLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimerSecondsLeft(prev => {
          if (prev <= 1) {
            clearTimer()
            setTimerRunning(false)
            setTimerComplete(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearTimer()
  }, [timerRunning, clearTimer])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  const startTimer = () => {
    if (!timerStarted) {
      setTimerSecondsLeft(prayerDuration || 0)
      setTimerStarted(true)
    }
    setTimerRunning(true)
  }

  const pauseTimer = () => {
    setTimerRunning(false)
    clearTimer()
  }

  const resetTimer = () => {
    clearTimer()
    setTimerRunning(false)
    setTimerStarted(false)
    setTimerComplete(false)
    setTimerSecondsLeft(prayerDuration || 0)
  }

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isLeader = userRole === 'leader'
  const isMeetingType = assignment.assignment_type === 'meeting'

  // Salvation Story detection + decision state
  const isSalvationStory = assignment.title === 'Your Salvation Story'
  const [salvationChoice, setSalvationChoice] = useState<'yes' | 'no' | null>(() => {
    // Parse from saved notes prefix
    const notes = progress?.notes || ''
    if (notes.startsWith('[ACCEPTED_CHRIST:yes]')) return 'yes'
    if (notes.startsWith('[ACCEPTED_CHRIST:no]')) return 'no'
    return null
  })

  // Strip the prefix tag from notes for display/editing
  const stripSalvationPrefix = (text: string) =>
    text.replace(/^\[ACCEPTED_CHRIST:(yes|no)\]\s*/, '')

  // When salvation choice changes, update the response text prefix and persist immediately
  const handleSalvationChoice = async (choice: 'yes' | 'no') => {
    setSalvationChoice(choice)
    // Preserve any existing response text (strip old prefix first)
    const cleanResponse = stripSalvationPrefix(response)
    const updatedNotes = `[ACCEPTED_CHRIST:${choice}] ${cleanResponse}`.trim()
    setResponse(updatedNotes)

    // Save to DB immediately so the choice persists across page navigations
    await supabase
      .from('assignment_progress')
      .upsert({
        pairing_id: pairingId,
        assignment_id: assignment.id,
        user_id: userId,
        status: progress?.status === 'completed' ? 'completed' : 'in_progress',
        notes: updatedNotes,
        completed_at: progress?.completed_at || null,
      }, {
        onConflict: 'pairing_id,assignment_id,user_id',
        ignoreDuplicates: false
      })
    router.refresh()
  }

  // For leaders, show learner's status; for learners, show own status
  const displayProgress = isLeader ? learnerProgress : progress

  // Meeting assignments auto-complete based on hasWeeklyMeeting
  const meetingAutoCompleted = isMeetingType && hasWeeklyMeeting
  const status = meetingAutoCompleted ? 'completed' : (displayProgress?.status || 'not_started')
  const isCompleted = status === 'completed'
  const Icon = typeIcons[assignment.assignment_type] || Circle

  // Auto-complete meeting assignment in DB when a meeting is marked done this week
  useEffect(() => {
    if (!isMeetingType || !meetingAutoCompleted || isLeader) return
    if (displayProgress?.status === 'completed') return // already marked

    const autoComplete = async () => {
      const progressData = {
        pairing_id: pairingId,
        assignment_id: assignment.id,
        user_id: userId,
        status: 'completed',
        notes: 'Meeting completed',
        completed_at: new Date().toISOString(),
      }
      await supabase
        .from('assignment_progress')
        .upsert(progressData, {
          onConflict: 'pairing_id,assignment_id,user_id',
          ignoreDuplicates: false
        })
      router.refresh()
    }
    autoComplete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingAutoCompleted, isMeetingType])

  // Check if this assignment type requires a written response
  // All assignment types except meeting and prayer require a response
  const isReflectionOrDiscussion = assignment.assignment_type === 'reflection' || assignment.assignment_type === 'discussion'
  const isReadingOrAction = assignment.assignment_type === 'reading' || assignment.assignment_type === 'action'
  const requiresResponse = isReflectionOrDiscussion || isReadingOrAction

  // Available emojis for reactions
  const availableEmojis = ['❤️', '🙏', '👏', '💪', '🔥', '✨']

  // Handle toggling a reaction on learner's response
  const handleReaction = async (emoji: string) => {
    if (!learnerProgress?.id || isReacting) return
    setIsReacting(true)
    try {
      const result = await toggleAssignmentReaction(learnerProgress.id, emoji, pairingId)
      if (result.success) {
        // Toggle locally
        setReactions(prev => {
          const existing = prev.find(r => r.user_id === userId && r.emoji === emoji)
          if (existing) {
            return prev.filter(r => r.id !== existing.id)
          } else {
            return [...prev, {
              id: `temp-${Date.now()}`,
              assignment_progress_id: learnerProgress.id!,
              user_id: userId,
              emoji,
              created_at: new Date().toISOString()
            }]
          }
        })
        setShowEmojiPicker(false)
      } else {
        toast.error(result.error || 'Failed to add reaction')
      }
    } catch {
      toast.error('Failed to add reaction')
    } finally {
      setIsReacting(false)
    }
  }

  // Handle sending a reply to learner's response
  const handleSendReply = async () => {
    if (!learnerProgress?.id || !replyText.trim() || isSendingReply) return
    setIsSendingReply(true)
    try {
      const result = await replyToAssignment(learnerProgress.id, replyText.trim(), pairingId)
      if (result.success) {
        toast.success('Reply sent!')
        setShowReplyForm(false)
      } else {
        toast.error(result.error || 'Failed to send reply')
      }
    } catch {
      toast.error('Failed to send reply')
    } finally {
      setIsSendingReply(false)
    }
  }

  // Handle deleting a reply
  const handleDeleteReply = async () => {
    if (!learnerProgress?.id || isSendingReply) return
    setIsSendingReply(true)
    try {
      const result = await deleteAssignmentReply(learnerProgress.id)
      if (result.success) {
        setReplyText('')
        toast.success('Reply removed')
      } else {
        toast.error(result.error || 'Failed to remove reply')
      }
    } catch {
      toast.error('Failed to remove reply')
    } finally {
      setIsSendingReply(false)
    }
  }

  const handleSaveProgress = async (newStatus: 'in_progress' | 'completed') => {
    // Validate that reflection/discussion assignments have a response before completing
    // Salvation story with "no" choice can complete without full response
    const salvationNoChoice = isSalvationStory && salvationChoice === 'no'
    const hasResponse = salvationNoChoice ? true : !!stripSalvationPrefix(response).trim()
    if (newStatus === 'completed' && requiresResponse && !hasResponse) {
      toast.error('Please write a response before marking as complete.')
      return
    }
    // Salvation story requires making a choice first
    if (newStatus === 'completed' && isSalvationStory && salvationChoice === null) {
      toast.error('Please answer the question first.')
      return
    }

    setIsLoading(true)

    const progressData = {
      pairing_id: pairingId,
      assignment_id: assignment.id,
      user_id: userId,
      status: newStatus,
      notes: response || null,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    }

    // Use upsert to handle both insert and update
    const { error } = await supabase
      .from('assignment_progress')
      .upsert(progressData, {
        onConflict: 'pairing_id,assignment_id,user_id',
        ignoreDuplicates: false
      })

    if (error) {
      toast.error('Failed to save progress')
      setIsLoading(false)
      return
    }

    toast.success(newStatus === 'completed' ? 'Assignment completed!' : 'Progress saved!')

    // Clear draft from localStorage on completion
    if (newStatus === 'completed') {
      localStorage.removeItem(draftKey)
    }

    // Send notification to leader when learner completes an assignment
    if (newStatus === 'completed' && userRole === 'learner' && leaderId && learnerName) {
      await notifyAssignmentCompleted(
        leaderId,
        learnerName,
        pairingId,
        assignment.title,
        assignment.week_number,
        assignment.id
      )

      // Check if this was the last assignment for the week
      // completedWeekAssignments doesn't include this one yet, so we add 1
      const newCompletedCount = (completedWeekAssignments || 0) + 1
      if (totalWeekAssignments && newCompletedCount >= totalWeekAssignments && currentWeek) {
        // All assignments for this week are complete - advance to next week
        const { data: weeklyContent } = await supabase
          .from('weekly_content')
          .select('week_number, title')
          .order('week_number')

        if (weeklyContent && weeklyContent.length > 0) {
          const result = await advanceToNextWeek(
            pairingId,
            currentWeek,
            learnerName || 'Learner',
            leaderId || '',
            weeklyContent
          )

          if (result.success) {
            // Set celebration data
            setCelebrationWeek(result.completedWeek || currentWeek)
            setCelebrationWeekTitle(result.completedWeekTitle || weekTitle || '')

            // Don't refresh yet - wait for modal to close
            setIsLoading(false)

            if (result.journeyComplete) {
              // Show graduation modal for journey completion
              setShowGraduationModal(true)
            } else {
              // Show week celebration modal
              setShowWeekCelebration(true)
            }
            return // Don't refresh - modal onClose will handle it
          }
        }
      }
    }

    setIsLoading(false)
    router.refresh()
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        ref={cardRef}
        className={cn(
          "rounded-lg border transition-colors w-full overflow-hidden",
          isCompleted ? "bg-success/5 border-success/20" : "bg-card hover:border-primary/30"
        )}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 sm:p-4 text-left flex items-center gap-3 sm:gap-4">
            {/* Status Icon */}
            <div className={cn(
              "flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full",
              isCompleted
                ? "bg-success text-success-foreground"
                : status === 'in_progress'
                  ? "bg-warning/20 text-warning"
                  : "bg-muted text-muted-foreground"
            )}>
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : status === 'in_progress' ? (
                <Clock className="h-5 w-5" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <Badge
                  variant="secondary"
                  className={cn("text-xs capitalize shrink-0", typeColors[assignment.assignment_type])}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {assignment.assignment_type}
                </Badge>
              </div>
              <h4 className="font-medium text-foreground text-sm truncate">{assignment.title}</h4>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {assignment.description}
              </p>
            </div>

            {/* Expand Icon */}
            <ChevronDown className={cn(
              "h-5 w-5 text-muted-foreground transition-transform shrink-0",
              isOpen && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 sm:space-y-4">
            <div className="h-px bg-border" />

            <p className="text-sm text-muted-foreground">
              {assignment.description}
            </p>

            {/* Scripture reference buttons - verse refs, book refs, or fallback for reading type */}
            {(() => {
              const desc = assignment.description || ''
              const scriptureRefs = extractScriptureReferences(desc)
              // Collect book IDs already matched by verse-level refs to avoid duplicates
              const matchedBookIds = new Set<string>()
              for (const ref of scriptureRefs) {
                const bookIdMatch = ref.url.match(/book=(\d+)/)
                if (bookIdMatch) matchedBookIds.add(bookIdMatch[1])
              }
              const bookRefs = extractBookReferences(desc, matchedBookIds)
              const isReadingType = assignment.assignment_type === 'reading'
              const hasAnyRefs = scriptureRefs.length > 0 || bookRefs.length > 0

              if (!hasAnyRefs && !isReadingType) return null

              return (
                <div className="flex flex-wrap gap-2">
                  {/* Verse-level references: "Read John 3:1-21" */}
                  {scriptureRefs.map((ref) => (
                    <Button
                      key={ref.reference}
                      variant="outline"
                      size="sm"
                      className="gap-2 h-8 text-xs bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                      asChild
                    >
                      <Link href={ref.url}>
                        <BookMarked className="h-3.5 w-3.5" />
                        Read {ref.reference}
                      </Link>
                    </Button>
                  ))}
                  {/* Book-only references: "Read John" (chapter 1) */}
                  {bookRefs.map((ref) => (
                    <Button
                      key={ref.bookId}
                      variant="outline"
                      size="sm"
                      className="gap-2 h-8 text-xs bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                      asChild
                    >
                      <Link href={ref.url}>
                        <BookOpen className="h-3.5 w-3.5" />
                        Read {ref.bookName}
                      </Link>
                    </Button>
                  ))}
                  {/* Fallback for reading assignments with no detected references */}
                  {!hasAnyRefs && isReadingType && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 h-8 text-xs bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                      asChild
                    >
                      <Link href="/dashboard/bible">
                        <BookOpen className="h-3.5 w-3.5" />
                        Open Bible
                      </Link>
                    </Button>
                  )}
                </div>
              )
            })()}

            {/* Prayer Timer */}
            {isPrayerType && prayerDuration && !isLeader && (
              <div className="rounded-xl border bg-gradient-to-b from-pink-50/80 dark:from-pink-950/20 to-card p-4 sm:p-5 space-y-4">
                {/* Timer Display */}
                <div className="flex flex-col items-center gap-3">
                  {/* Circular Progress Ring */}
                  <div className="relative flex items-center justify-center">
                    <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                      {/* Background circle */}
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        className="text-muted/30"
                      />
                      {/* Progress circle */}
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        className={cn(
                          "transition-all duration-1000 ease-linear",
                          timerComplete ? "text-success" : "text-pink-500"
                        )}
                        strokeDasharray={`${2 * Math.PI * 52}`}
                        strokeDashoffset={`${2 * Math.PI * 52 * (1 - (timerStarted ? (prayerDuration - timerSecondsLeft) / prayerDuration : 0))}`}
                      />
                    </svg>
                    {/* Time text in center */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={cn(
                        "text-3xl font-semibold tabular-nums tracking-tight",
                        timerComplete ? "text-success" : "text-foreground"
                      )}>
                        {formatTime(timerSecondsLeft)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                        {timerComplete ? 'Complete' : timerRunning ? 'Praying...' : timerStarted ? 'Paused' : 'Ready'}
                      </span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2">
                    {!timerComplete ? (
                      <>
                        <Button
                          size="sm"
                          variant={timerRunning ? 'outline' : 'default'}
                          className={cn(
                            "gap-2 h-9 px-4",
                            !timerRunning && "bg-pink-600 hover:bg-pink-700 text-white"
                          )}
                          onClick={timerRunning ? pauseTimer : startTimer}
                        >
                          {timerRunning ? (
                            <>
                              <Pause className="h-4 w-4" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              {timerStarted ? 'Resume' : 'Start Prayer'}
                            </>
                          )}
                        </Button>
                        {timerStarted && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 h-9 text-muted-foreground"
                            onClick={resetTimer}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reset
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 h-9 text-muted-foreground"
                          onClick={resetTimer}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Pray Again
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Meeting type: special content */}
            {isMeetingType && !isLeader && (
              <div className="space-y-3">
                {isCompleted ? (
                  <div className="flex items-center gap-2 text-sm text-success rounded-lg border border-success/20 bg-success/5 px-3 py-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="font-medium">Meeting completed this week</span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2.5">
                    <p className="text-sm text-foreground font-medium">
                      Schedule and complete a meeting with your leader to finish this assignment. Your leader must mark the meeting as done.
                    </p>
                    <Button size="sm" asChild>
                      <Link href="/dashboard/schedule">
                        <Calendar className="h-4 w-4 mr-2" />
                        Go to Schedule
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
            {isMeetingType && isLeader && (
              <div className="space-y-3">
                {hasWeeklyMeeting ? (
                  <div className="flex items-center gap-2 text-sm text-success rounded-lg border border-success/20 bg-success/5 px-3 py-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="font-medium">Meeting completed with {learnerName || 'Learner'} this week</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border px-3 py-2.5">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>Waiting for a meeting with {learnerName || 'Learner'} to be completed. Mark your meeting as done after it happens.</span>
                  </div>
                )}
              </div>
            )}

            {/* Leader view: show learner's response (read-only) */}
            {isLeader && learnerProgress && (
              <div className="space-y-3">
                {/* Learner status */}
                <div className="flex items-center gap-2">
                  {learnerProgress.status === 'completed' ? (
                    <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {learnerName || 'Learner'} completed
                      {learnerProgress.completed_at && (
                        <span className="ml-1 opacity-75">
                          {new Date(learnerProgress.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </Badge>
                  ) : learnerProgress.status === 'in_progress' ? (
                    <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                      <Clock className="h-3 w-3 mr-1" />
                      {learnerName || 'Learner'} in progress
                    </Badge>
                  ) : null}
                </div>

                {/* Learner's written response */}
                {learnerProgress.notes && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                    {/* Salvation story: show their choice as a badge */}
                    {isSalvationStory && learnerProgress.notes.includes('[ACCEPTED_CHRIST:') && (
                      <div className="mb-2">
                        {learnerProgress.notes.includes('[ACCEPTED_CHRIST:yes]') ? (
                          <Badge variant="secondary" className="bg-success/10 text-success border-success/20 text-xs gap-1">
                            <HandHeart className="h-3 w-3" />
                            Has accepted Christ
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/40 text-xs gap-1">
                            <Heart className="h-3 w-3" />
                            Has not yet accepted Christ -- follow up recommended
                          </Badge>
                        )}
                      </div>
                    )}
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {learnerName ? `${learnerName}'s` : "Learner's"} Response
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {isSalvationStory ? stripSalvationPrefix(learnerProgress.notes) || 'No written response.' : learnerProgress.notes}
                    </p>

                    {/* Reactions display */}
                    {reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t">
                        {Object.entries(
                          reactions.reduce((acc, r) => {
                            acc[r.emoji] = (acc[r.emoji] || 0) + 1
                            return acc
                          }, {} as Record<string, number>)
                        ).map(([emoji, count]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(emoji)}
                            disabled={isReacting}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors",
                              reactions.some(r => r.user_id === userId && r.emoji === emoji)
                                ? "bg-primary/10 border-primary/30 text-primary"
                                : "bg-muted/50 border-border hover:bg-muted"
                            )}
                          >
                            <span>{emoji}</span>
                            {count > 1 && <span className="text-xs">{count}</span>}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Reaction and Reply buttons for leader */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                      <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            disabled={isReacting}
                          >
                            {isReacting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <SmilePlus className="h-3.5 w-3.5" />
                            )}
                            React
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="start">
                          <div className="flex gap-1">
                            {availableEmojis.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(emoji)}
                                className={cn(
                                  "text-xl p-1.5 rounded hover:bg-muted transition-colors",
                                  reactions.some(r => r.user_id === userId && r.emoji === emoji) && "bg-primary/10"
                                )}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {!learnerProgress.leader_reply && !showReplyForm && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowReplyForm(true)}
                        >
                          <Reply className="h-3.5 w-3.5" />
                          Reply
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Leader's existing reply */}
                {learnerProgress.leader_reply && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-primary uppercase tracking-wide">Your Reply</p>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setReplyText(learnerProgress.leader_reply || '')
                            setShowReplyForm(true)
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={handleDeleteReply}
                          disabled={isSendingReply}
                        >
                          {isSendingReply ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{learnerProgress.leader_reply}</p>
                    {learnerProgress.leader_reply_at && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(learnerProgress.leader_reply_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                )}

                {/* Reply form */}
                {showReplyForm && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Write a reply to ${learnerName || 'your learner'}...`}
                      className="min-h-[60px] text-sm resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowReplyForm(false)
                          setReplyText(learnerProgress.leader_reply || '')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSendReply}
                        disabled={!replyText.trim() || isSendingReply}
                        className="gap-1"
                      >
                        {isSendingReply ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {learnerProgress.leader_reply ? 'Update' : 'Send'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* No response yet */}
                {!learnerProgress.notes && learnerProgress.status === 'completed' && (
                  <p className="text-xs text-muted-foreground italic">
                    Completed without a written response.
                  </p>
                )}
              </div>
            )}

            {/* Leader view: learner hasn't started */}
            {isLeader && !learnerProgress && (
              <p className="text-xs text-muted-foreground italic">
                {learnerName || 'Learner'} has not started this assignment yet.
              </p>
            )}

            {/* Salvation Story Decision Flow (Learners only) */}
            {isSalvationStory && !isLeader && !isCompleted && (
              <div className="space-y-3">
                {/* Initial choice - not yet answered */}
                {salvationChoice === null && (
                  <div className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 to-card p-4 sm:p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Cross className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">Have you accepted Jesus Christ as your Lord and Savior?</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {'There\'s no wrong answer here -- this is a safe space. Your response helps us walk alongside you in the best way possible.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <Button
                        className="flex-1 h-11 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => handleSalvationChoice('yes')}
                      >
                        <HandHeart className="h-4 w-4" />
                        Yes, I have
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-11 gap-2 border-border hover:bg-muted"
                        onClick={() => handleSalvationChoice('no')}
                      >
                        Not yet
                      </Button>
                    </div>
                  </div>
                )}

                {/* YES path - accepted Christ */}
                {salvationChoice === 'yes' && (
                  <div className="rounded-xl border border-success/20 bg-success/5 p-4 sm:p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15">
                        <HandHeart className="h-4 w-4 text-success" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">{'That\'s wonderful!'}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {'Your decision to follow Christ is the most important one you\'ll ever make. Take a moment to reflect on your journey -- when did you first come to know Jesus? What led you to that moment? Write your story below.'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => setSalvationChoice(null)}
                    >
                      Change answer
                    </Button>
                  </div>
                )}

                {/* NO path - not yet accepted */}
                {salvationChoice === 'no' && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-gradient-to-b from-amber-50/80 dark:from-amber-950/20 to-card p-4 sm:p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                        <Heart className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-semibold text-foreground">{'We\'re so glad you\'re here'}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {'That\'s completely okay -- this is exactly why you\'re here, and we\'re thankful you\'re on this journey. '}
                          {leaderName ? `${leaderName} would` : 'Your leader would'} love to sit down with you and talk about what it means to have a personal relationship with Jesus.
                          {' This could be one of the most meaningful conversations of your life.'}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        className="flex-1 h-10 gap-2"
                        asChild
                      >
                        <Link href={`/dashboard/messages?draft=${encodeURIComponent(`Hey ${leaderName || 'there'}, I'm going through the Stand Walk Run program and I'd love to talk with you more about faith and what it means to have a relationship with Jesus. Would you be free to meet up sometime soon?`)}`}>
                          <Send className="h-4 w-4" />
                          Message {leaderName || 'Your Leader'}
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-10 gap-2"
                        asChild
                      >
                        <Link href="/dashboard/schedule">
                          <CalendarHeart className="h-4 w-4" />
                          Schedule a Meeting
                        </Link>
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => setSalvationChoice(null)}
                    >
                      Change answer
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Learner view: Response Input (not for meeting type) */}
            {!isLeader && !isMeetingType && (assignment.assignment_type === 'reflection' ||
              assignment.assignment_type === 'discussion') && (
                <div className="space-y-2">
                  {/* For salvation story, only show textarea after a choice is made */}
                  {(!isSalvationStory || salvationChoice !== null || isCompleted) && (
                    <>
                      <label className="text-sm font-medium text-foreground">
                        {isSalvationStory && salvationChoice === 'yes'
                          ? 'Your Salvation Story'
                          : isSalvationStory && salvationChoice === 'no'
                            ? 'Your Thoughts & Questions'
                            : 'Your Response'}
                      </label>
                      <Textarea
                        value={isSalvationStory ? stripSalvationPrefix(response) : response}
                        onChange={(e) => {
                          if (isSalvationStory && salvationChoice) {
                            setResponse(`[ACCEPTED_CHRIST:${salvationChoice}] ${e.target.value}`)
                          } else {
                            setResponse(e.target.value)
                          }
                        }}
                        placeholder={
                          isSalvationStory && salvationChoice === 'yes'
                            ? 'Share when and how you came to know Christ...'
                            : isSalvationStory && salvationChoice === 'no'
                              ? 'Share any questions or thoughts you have about faith...'
                              : 'Write your response here...'
                        }
                        rows={4}
                      />
                    </>
                  )}
                </div>
              )}

            {/* Learner view: Response input for reading/action types (always shown) */}
            {!isLeader && !isMeetingType && !isPrayerType &&
              assignment.assignment_type !== 'reflection' &&
              assignment.assignment_type !== 'discussion' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Your Response</label>
                  <Textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Write your response here..."
                    rows={3}
                  />
                </div>
              )}

            {/* Action Buttons (only for learners, not meeting type) */}
            <div className="flex flex-wrap items-center gap-2">
              {!isLeader && !isCompleted && !isMeetingType && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleSaveProgress('completed')}
                    disabled={isLoading || (requiresResponse && !isSalvationStory && !stripSalvationPrefix(response).trim()) || (isSalvationStory && salvationChoice === null)}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Mark Complete
                  </Button>
                  {isSalvationStory && salvationChoice === null && (
                    <p className="text-xs text-muted-foreground self-center">Answer the question first</p>
                  )}
                  {requiresResponse && !isSalvationStory && !stripSalvationPrefix(response).trim() && (
                    <p className="text-xs text-muted-foreground self-center">Write a response first</p>
                  )}
                </>
              )}
              {!isLeader && isCompleted && !isMeetingType && (
                <div className="flex items-center gap-2">
                  {/* Show Save button if response was edited after completion */}
                  {response !== (progress?.notes || '') && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        setIsLoading(true)
                        const { error } = await supabase
                          .from('assignment_progress')
                          .update({ notes: response || null })
                          .eq('pairing_id', pairingId)
                          .eq('assignment_id', assignment.id)
                          .eq('user_id', userId)
                        setIsLoading(false)
                        if (error) {
                          toast.error('Failed to save response')
                        } else {
                          localStorage.removeItem(draftKey)
                          toast.success('Response saved!')
                          router.refresh()
                        }
                      }}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                  )}
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed
                  </div>
                </div>
              )}
            </div>

            {/* Leader's reactions and reply display for learners */}
            {!isLeader && isCompleted && (progressReactions?.length || progress?.leader_reply) && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <p className="text-xs font-medium text-primary uppercase tracking-wide">
                  {leaderName ? `${leaderName}'s Feedback` : 'Leader Feedback'}
                </p>

                {/* Reactions from leader */}
                {progressReactions && progressReactions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(
                      progressReactions.reduce((acc, r) => {
                        acc[r.emoji] = (acc[r.emoji] || 0) + 1
                        return acc
                      }, {} as Record<string, number>)
                    ).map(([emoji, count]) => (
                      <span
                        key={emoji}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-background border"
                      >
                        <span>{emoji}</span>
                        {count > 1 && <span className="text-xs">{count}</span>}
                      </span>
                    ))}
                  </div>
                )}

                {/* Reply from leader */}
                {progress?.leader_reply && (
                  <div className="space-y-1">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{progress.leader_reply}</p>
                    {progress.leader_reply_at && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(progress.leader_reply_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>

      {/* Week Celebration Modal */}
      <WeekCelebrationModal
        isOpen={showWeekCelebration}
        onClose={() => setShowWeekCelebration(false)}
        weekNumber={celebrationWeek}
        weekTitle={celebrationWeekTitle}
        onContinue={() => {
          router.refresh()
        }}
      />

      {/* Graduation Modal (Journey Complete) */}
      <GraduationModal
        isOpen={showGraduationModal}
        onClose={() => {
          setShowGraduationModal(false)
          router.refresh()
        }}
        userId={userId}
        userName={userName || learnerName || 'Learner'}
        pairingId={pairingId}
        journeyName={journeyName}
        journeySubtitle={journeySubtitle}
        canBeLeader={canBeLeader}
        subscriptionTier={subscriptionTier}
        organizationId={organizationId}
        organizationName={organizationName}
      />
    </Collapsible>
  )
}
