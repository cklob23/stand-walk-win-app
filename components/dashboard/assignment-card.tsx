'use client'

import { useState } from 'react'
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
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import type { Assignment } from '@/lib/types'
import { cn } from '@/lib/utils'
import { notifyAssignmentCompleted, advanceToNextWeek } from '@/lib/notifications'

interface AssignmentCardProps {
  assignment: Assignment
  progress?: {
    id?: string
    assignment_id: string
    status: string
    notes: string | null
    completed_at: string | null
  }
  pairingId: string
  userId: string
  userRole?: 'leader' | 'learner'
  leaderId?: string
  learnerName?: string
  currentWeek?: number
  totalWeekAssignments?: number
  completedWeekAssignments?: number
}

const typeIcons = {
  reading: BookOpen,
  reflection: PenLine,
  action: Zap,
  discussion: MessageCircle,
  prayer: Heart,
}

const typeColors = {
  reading: 'bg-blue-100 text-blue-700',
  reflection: 'bg-amber-100 text-amber-700',
  action: 'bg-green-100 text-green-700',
  discussion: 'bg-purple-100 text-purple-700',
  prayer: 'bg-pink-100 text-pink-700',
}

export function AssignmentCard({ 
  assignment, 
  progress, 
  pairingId, 
  userId, 
  userRole,
  leaderId,
  learnerName,
  currentWeek,
  totalWeekAssignments,
  completedWeekAssignments
}: AssignmentCardProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [response, setResponse] = useState(progress?.notes || '')
  const [isLoading, setIsLoading] = useState(false)

  const supabase = createClient()
  
  const status = progress?.status || 'not_started'
  const isCompleted = status === 'completed'
  const Icon = typeIcons[assignment.assignment_type] || Circle

  const handleSaveProgress = async (newStatus: 'in_progress' | 'completed') => {
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
    
    // Send notification to leader when learner completes an assignment
    if (newStatus === 'completed' && userRole === 'learner' && leaderId && learnerName) {
      await notifyAssignmentCompleted(
        leaderId,
        learnerName,
        pairingId,
        assignment.title,
        assignment.week_number
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
        
        if (weeklyContent) {
          await advanceToNextWeek(
            pairingId,
            currentWeek,
            learnerName,
            leaderId,
            userId,
            weeklyContent
          )
          toast.success('Congratulations! Week ' + currentWeek + ' complete. Next week unlocked!')
        }
      }
    }
    
    setIsLoading(false)
    router.refresh()
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn(
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

            {/* Response Input */}
            {(assignment.assignment_type === 'reflection' || 
              assignment.assignment_type === 'discussion') && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Your Response
                </label>
                <Textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Write your thoughts here..."
                  rows={4}
                  disabled={isCompleted}
                  className={cn(isCompleted && "opacity-60")}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!isCompleted && (
                <>
                  {status !== 'in_progress' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSaveProgress('in_progress')}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Clock className="h-4 w-4 mr-2" />
                      )}
                      Start
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleSaveProgress('completed')}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Mark Complete
                  </Button>
                </>
              )}
              {isCompleted && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Completed
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
