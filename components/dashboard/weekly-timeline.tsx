'use client'

import Link from 'next/link'
import { CheckCircle2, Circle, Lock } from 'lucide-react'
import type { WeeklyContent, Assignment } from '@/lib/types'
import { cn } from '@/lib/utils'

interface WeeklyTimelineProps {
  weeklyContent: WeeklyContent[]
  currentWeek: number
  assignments: Assignment[]
  assignmentProgress: { assignment_id: string; status: string }[]
}

export function WeeklyTimeline({ 
  weeklyContent, 
  currentWeek, 
  assignments, 
  assignmentProgress 
}: WeeklyTimelineProps) {
  return (
    <div className="space-y-1">
      {weeklyContent.map((week, index) => {
        const weekAssignments = assignments.filter(a => a.week_number === week.week_number)
        const completedCount = assignmentProgress.filter(p => 
          weekAssignments.some(a => a.id === p.assignment_id) && 
          p.status === 'completed'
        ).length
        
        const isCompleted = completedCount === weekAssignments.length && weekAssignments.length > 0
        const isCurrent = week.week_number === currentWeek
        const isLocked = week.week_number > currentWeek
        const isAccessible = week.week_number <= currentWeek

        return (
          <div key={week.id} className="relative">
            {/* Connector Line */}
            {index < weeklyContent.length - 1 && (
              <div 
                className={cn(
                  "absolute left-[15px] top-[40px] w-0.5 h-[calc(100%-16px)]",
                  isCompleted ? "bg-primary" : "bg-border"
                )}
              />
            )}
            
            <Link
              href={isAccessible ? `/dashboard/week/${week.week_number}` : '#'}
              className={cn(
                "flex items-start gap-4 p-3 rounded-lg transition-colors",
                isAccessible && "hover:bg-muted/50 cursor-pointer",
                isCurrent && "bg-primary/5 border border-primary/20",
                isLocked && "opacity-60 cursor-not-allowed"
              )}
              onClick={(e) => {
                if (isLocked) e.preventDefault()
              }}
            >
              {/* Status Icon */}
              <div className="relative shrink-0 mt-0.5">
                {isCompleted ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                    <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
                  </div>
                ) : isLocked ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted border-2 border-border">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                ) : isCurrent ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 border-2 border-primary">
                    <Circle className="h-4 w-4 text-primary fill-primary" />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted border-2 border-border">
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Week {week.week_number}
                  </span>
                  {isCurrent && (
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <h3 className={cn(
                  "font-medium mt-0.5",
                  isLocked ? "text-muted-foreground" : "text-foreground"
                )}>
                  {week.title}
                </h3>
                {week.scripture_reference && !isLocked && (
                  <p className="text-sm text-muted-foreground mt-0.5 truncate font-serif italic">
                    {week.scripture_reference}
                  </p>
                )}
                {!isLocked && weekAssignments.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(completedCount / weekAssignments.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {completedCount}/{weekAssignments.length}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          </div>
        )
      })}
    </div>
  )
}
