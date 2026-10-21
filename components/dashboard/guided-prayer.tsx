'use client'

import Link from 'next/link'
import { BookMarked, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { extractScriptureReferences } from '@/lib/bible-utils'

function hasText(value?: string | null): value is string {
  return !!value && value.trim().length > 0
}

interface GuidedPrayerProps {
  prayer?: string | null
  confirmed: boolean
  onConfirmedChange: (confirmed: boolean) => void
  isLeader?: boolean
  isCompleted?: boolean
}

export function GuidedPrayer({
  prayer,
  confirmed,
  onConfirmedChange,
  isLeader = false,
  isCompleted = false,
}: GuidedPrayerProps) {
  if (!hasText(prayer)) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-3 space-y-1">
        <p className="text-sm font-medium text-foreground">Guided prayer coming soon</p>
        <p className="text-xs text-muted-foreground">
          Paul is still writing this week&apos;s prayer. You can mark this assignment complete as usual.
        </p>
      </div>
    )
  }

  const scriptureRefs = extractScriptureReferences(prayer)
  const showConfirm = !isLeader && !isCompleted

  return (
    <div className="rounded-xl border border-pink-200/60 dark:border-pink-800/40 bg-gradient-to-b from-pink-50/80 dark:from-pink-950/20 to-card p-4 sm:p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-900/30">
          <Heart className="h-4 w-4 text-pink-600 dark:text-pink-400" />
        </div>
        <div className="space-y-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground">Pray this prayer</h4>
          <p className="text-xs text-muted-foreground">
            Read this prayer slowly and pray it out loud.
          </p>
        </div>
      </div>

      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{prayer}</p>

      {scriptureRefs.length > 0 && (
        <div className="flex flex-wrap gap-2">
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
        </div>
      )}

      {showConfirm && (
        <div className="flex items-start gap-2 pt-1">
          <Checkbox
            id="prayed-this-prayer"
            checked={confirmed}
            onCheckedChange={(value) => onConfirmedChange(value === true)}
          />
          <Label htmlFor="prayed-this-prayer" className="text-sm font-medium leading-snug cursor-pointer">
            I prayed this prayer
          </Label>
        </div>
      )}
    </div>
  )
}
