'use client'

import Link from 'next/link'
import { BookMarked, BookOpen, ChevronDown, Heart } from 'lucide-react'
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
  title,
  text,
  icon: Icon,
  defaultOpen = false,
}: {
  title: string
  text: string
  icon: typeof BookOpen
  defaultOpen?: boolean
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-lg border bg-muted/20">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground"
        >
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">{title}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 border-t px-3 pb-3 pt-2">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{text}</p>
          <ScriptureReadButtons text={text} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface QuestionGuidanceProps {
  commentary?: string | null
  prayer?: string | null
  defaultOpen?: boolean
}

export function QuestionGuidance({
  commentary,
  prayer,
  defaultOpen = false,
}: QuestionGuidanceProps) {
  const showCommentary = hasText(commentary)
  const showPrayer = hasText(prayer)
  if (!showCommentary && !showPrayer) return null

  return (
    <div className={cn('space-y-2')}>
      {showCommentary && (
        <GuidanceCard
          title="Commentary"
          text={commentary}
          icon={BookOpen}
          defaultOpen={defaultOpen}
        />
      )}
      {showPrayer && (
        <GuidanceCard
          title="Prayer"
          text={prayer}
          icon={Heart}
          defaultOpen={defaultOpen}
        />
      )}
    </div>
  )
}
