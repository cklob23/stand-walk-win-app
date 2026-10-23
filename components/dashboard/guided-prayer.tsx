'use client'

import { CheckCircle2, HandHeart, Sparkles } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { LocalDateTime } from '@/components/ui/local-datetime'
import { cn } from '@/lib/utils'
import { hasGuidedPrayerText, showGuidedPrayerComingSoon } from '@/lib/guided-prayer'

export { hasGuidedPrayerText, showGuidedPrayerComingSoon }

export function GuidedPrayerCard({ prayer }: { prayer: string }) {
  return (
    <div
      id="guided-prayer"
      className="rounded-xl border border-pink-200/70 dark:border-pink-900/40 bg-gradient-to-b from-pink-50/80 dark:from-pink-950/20 to-card p-4 sm:p-6 space-y-3"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
          <HandHeart className="h-4 w-4" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Pray this prayer</p>
      </div>
      <p className="font-serif text-[15px] sm:text-base leading-8 text-foreground">{prayer}</p>
    </div>
  )
}

export function GuidedPrayerConfirm({
  checked,
  onChange,
  completedAt,
  isCompleted,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  completedAt?: string | null
  isCompleted: boolean
}) {
  if (isCompleted) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Prayed {completedAt ? <LocalDateTime value={completedAt} pattern="MMM d" /> : null}
        </span>
        <a href="#guided-prayer" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
          Pray again
        </a>
      </div>
    )
  }

  return (
    <label
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card px-3 py-3 cursor-pointer',
        'has-[:checked]:border-primary/40 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary/5'
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        id="prayed-check"
        className="h-5 w-5"
      />
      <span className="text-sm font-medium text-foreground">I prayed this prayer</span>
    </label>
  )
}

export function GuidedPrayerComingSoon() {
  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-4 flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-muted-foreground">Guided prayer coming soon</p>
        <p className="text-xs text-muted-foreground">
          A prayer for this assignment will appear here. You can still complete it today.
        </p>
      </div>
    </div>
  )
}

interface GuidedPrayerProps {
  prayer?: string | null
  assignmentType: string
  confirmed: boolean
  onConfirmedChange: (confirmed: boolean) => void
  isLeader?: boolean
  isCompleted?: boolean
  completedAt?: string | null
}

export function GuidedPrayer({
  prayer,
  assignmentType,
  confirmed,
  onConfirmedChange,
  isLeader = false,
  isCompleted = false,
  completedAt,
}: GuidedPrayerProps) {
  if (hasGuidedPrayerText(prayer) && prayer) {
    return (
      <div className="space-y-3">
        <GuidedPrayerCard prayer={prayer} />
        {!isLeader && (
          <GuidedPrayerConfirm
            checked={confirmed}
            onChange={onConfirmedChange}
            isCompleted={isCompleted}
            completedAt={completedAt}
          />
        )}
      </div>
    )
  }

  if (showGuidedPrayerComingSoon(assignmentType, prayer)) {
    return <GuidedPrayerComingSoon />
  }

  return null
}
