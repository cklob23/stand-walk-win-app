'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookMarked, BookOpen, ChevronDown, HandHeart, Link2 } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { extractScriptureReferences } from '@/lib/bible-utils'
import { cn } from '@/lib/utils'

function hasText(value?: string | null): value is string {
  return !!value && value.trim().length > 0
}

function toParagraphs(value: string): string[] {
  return value
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function ScriptureReadButtons({ text }: { text: string }) {
  const scriptureRefs = extractScriptureReferences(text)
  if (scriptureRefs.length === 0) return null

  return (
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
  )
}

function GuidanceCard({
  kind,
  paragraphs,
  note,
  defaultOpen = false,
}: {
  kind: 'commentary' | 'prayer'
  paragraphs: string[]
  note?: string | null
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isPrayer = kind === 'prayer'
  const Icon = isPrayer ? HandHeart : BookOpen
  const preview = paragraphs[0] || ''

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          'rounded-lg border overflow-hidden',
          isPrayer
            ? 'border-pink-200/70 dark:border-pink-900/40 bg-gradient-to-b from-pink-50/70 dark:from-pink-950/20 to-card'
            : 'bg-muted/40 border-border'
        )}
      >
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                isPrayer
                  ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                  : 'bg-primary/10 text-primary'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1 text-xs font-semibold text-foreground uppercase tracking-wide">
              {isPrayer ? 'Prayer' : 'Commentary'}
            </span>
            <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Read'}</span>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>
        {!open && (
          <div className="px-3 pb-3 -mt-0.5">
            <p
              className={cn(
                'text-sm text-muted-foreground line-clamp-2',
                isPrayer && 'font-serif italic leading-relaxed'
              )}
            >
              {preview}
            </p>
          </div>
        )}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2.5">
            {hasText(note) && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Link2 className="h-3.5 w-3.5 mt-px shrink-0" />
                {note}
              </p>
            )}
            {paragraphs.map((paragraph) => (
              <p
                key={paragraph.slice(0, 48)}
                className={cn(
                  'text-sm text-foreground/90 leading-relaxed',
                  isPrayer && 'font-serif italic leading-7'
                )}
              >
                {paragraph}
              </p>
            ))}
            <ScriptureReadButtons text={paragraphs.join(' ')} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

interface QuestionGuidanceProps {
  commentary?: string | null
  prayer?: string | null
  prayerNote?: string | null
  defaultOpen?: boolean
}

export function QuestionGuidance({
  commentary,
  prayer,
  prayerNote,
  defaultOpen = false,
}: QuestionGuidanceProps) {
  const commentaryParagraphs = hasText(commentary) ? toParagraphs(commentary) : []
  const showPrayer = hasText(prayer)
  if (commentaryParagraphs.length === 0 && !showPrayer) return null

  return (
    <div className="space-y-2">
      {commentaryParagraphs.length > 0 && (
        <GuidanceCard kind="commentary" paragraphs={commentaryParagraphs} defaultOpen={defaultOpen} />
      )}
      {showPrayer && (
        <GuidanceCard
          kind="prayer"
          paragraphs={toParagraphs(prayer)}
          note={prayerNote}
          defaultOpen={defaultOpen}
        />
      )}
    </div>
  )
}
