'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollText, CheckCircle2, Loader2, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile, Pairing } from '@/lib/types'
import { notifyCovenantSigned, notifyCovenantComplete } from '@/lib/notifications'

interface CovenantViewProps {
  profile: Profile
  pairing: Pairing
  partner: Profile | null
}

const covenantPoints = [
  {
    title: 'Commitment to Growth',
    description: 'I commit to actively participating in this 6-week discipleship journey, completing assignments, and engaging with the material with an open heart.',
  },
  {
    title: 'Regular Communication',
    description: 'I will maintain regular communication with my discipleship partner, responding to messages within a reasonable timeframe and being honest about my progress.',
  },
  {
    title: 'Confidentiality',
    description: 'I will keep all personal conversations and shared reflections confidential, creating a safe space for vulnerable and honest dialogue.',
  },
  {
    title: 'Prayer & Support',
    description: 'I commit to praying for my discipleship partner regularly and offering encouragement throughout our journey together.',
  },
  {
    title: 'Accountability',
    description: 'I welcome accountability in my spiritual growth and will be honest about both struggles and victories.',
  },
  {
    title: 'Grace & Understanding',
    description: 'I will extend grace when challenges arise and approach our relationship with patience, understanding, and love.',
  },
]

export function CovenantView({ profile, pairing, partner }: CovenantViewProps) {
  const router = useRouter()
  const [agreements, setAgreements] = useState<boolean[]>(new Array(covenantPoints.length).fill(false))
  const [isLoading, setIsLoading] = useState(false)

  const supabase = createClient()

  const isLeader = profile.role === 'leader'
  const hasSigned = isLeader ? pairing.covenant_accepted_leader : pairing.covenant_accepted_learner
  const partnerHasSigned = isLeader ? pairing.covenant_accepted_learner : pairing.covenant_accepted_leader
  const allAgreed = agreements.every(Boolean)

  const handleAgreementChange = (index: number, checked: boolean) => {
    const newAgreements = [...agreements]
    newAgreements[index] = checked
    setAgreements(newAgreements)
  }

  const handleSign = async () => {
    if (!allAgreed) {
      toast.error('Please agree to all covenant points')
      return
    }

    setIsLoading(true)

    const updateField = isLeader ? 'covenant_accepted_leader' : 'covenant_accepted_learner'
    
    const { error } = await supabase
      .from('pairings')
      .update({ [updateField]: true })
      .eq('id', pairing.id)

    if (error) {
      toast.error('Failed to sign covenant')
      setIsLoading(false)
      return
    }

    // Send notifications
    if (partner) {
      if (partnerHasSigned) {
        // Both have now signed - notify both that covenant is complete
        await notifyCovenantComplete(
          partner.id,
          profile.full_name || 'Your partner',
          pairing.id
        )
        await notifyCovenantComplete(
          profile.id,
          partner.full_name || 'Your partner',
          pairing.id
        )
      } else {
        // Notify partner that we signed
        await notifyCovenantSigned(
          partner.id,
          profile.full_name || 'Your partner',
          pairing.id
        )
      }
    }

    toast.success('Covenant signed successfully!')
    setIsLoading(false)
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <ScrollText className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Discipleship Covenant</h1>
        <p className="text-muted-foreground mt-2">
          A sacred agreement between you and {partner?.full_name || 'your partner'}
        </p>
      </div>

      {/* Signature Status */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                hasSigned ? 'bg-success text-success-foreground' : 'bg-muted'
              }`}>
                {hasSigned ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <PenLine className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Your Signature</p>
                <p className="text-xs text-muted-foreground">
                  {hasSigned ? 'Signed' : 'Pending'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                partnerHasSigned ? 'bg-success text-success-foreground' : 'bg-muted'
              }`}>
                {partnerHasSigned ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <PenLine className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {partner?.full_name || 'Partner'}&apos;s Signature
                </p>
                <p className="text-xs text-muted-foreground">
                  {partnerHasSigned ? 'Signed' : 'Pending'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Covenant Points */}
      <Card>
        <CardHeader>
          <CardTitle>Our Commitments</CardTitle>
          <CardDescription>
            {hasSigned 
              ? 'You have agreed to the following commitments'
              : 'Read and agree to each commitment to sign the covenant'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {covenantPoints.map((point, index) => (
            <div 
              key={index}
              className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="shrink-0 pt-0.5">
                {hasSigned ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-success-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                ) : (
                  <Checkbox
                    id={`agreement-${index}`}
                    checked={agreements[index]}
                    onCheckedChange={(checked) => handleAgreementChange(index, checked as boolean)}
                    className="h-6 w-6"
                  />
                )}
              </div>
              <label 
                htmlFor={`agreement-${index}`}
                className="flex-1 cursor-pointer"
              >
                <h3 className="font-medium text-foreground">{point.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{point.description}</p>
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sign Button */}
      {!hasSigned && (
        <div className="mt-6 text-center">
          <Button 
            size="lg" 
            onClick={handleSign}
            disabled={!allAgreed || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing...
              </>
            ) : (
              <>
                <PenLine className="mr-2 h-4 w-4" />
                Sign Covenant
              </>
            )}
          </Button>
          {!allAgreed && (
            <p className="text-sm text-muted-foreground mt-2">
              Please agree to all commitments to sign
            </p>
          )}
        </div>
      )}

      {hasSigned && partnerHasSigned && (
        <div className="mt-6 text-center">
          <Badge variant="default" className="bg-success text-success-foreground px-4 py-2">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Covenant Complete
          </Badge>
          <p className="text-sm text-muted-foreground mt-2">
            Both parties have signed the covenant. Your discipleship journey is blessed!
          </p>
        </div>
      )}
    </div>
  )
}
