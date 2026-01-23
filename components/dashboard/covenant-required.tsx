'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  ScrollText, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  Handshake,
  Heart
} from 'lucide-react'
import type { Profile, Pairing } from '@/lib/types'

interface CovenantRequiredProps {
  profile: Profile
  pairing: Pairing
  partner: Profile | null
}

export function CovenantRequired({ profile, pairing, partner }: CovenantRequiredProps) {
  const isLeader = profile.role === 'leader'
  const hasSigned = isLeader ? pairing.covenant_accepted_leader : pairing.covenant_accepted_learner
  const partnerHasSigned = isLeader ? pairing.covenant_accepted_learner : pairing.covenant_accepted_leader

  const partnerInitials = partner?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '?'

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Handshake className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Sign the Covenant to Begin
        </h1>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Before starting your discipleship journey, both you and your {isLeader ? 'Learner' : 'Leader'} must sign the covenant agreement.
        </p>
      </div>

      {/* Partner Info */}
      {partner && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={partner.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {partnerInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {partner.full_name || (isLeader ? 'Your Learner' : 'Your Leader')}
                </p>
                <p className="text-sm text-muted-foreground capitalize">
                  {partner.role}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Covenant Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            Covenant Status
          </CardTitle>
          <CardDescription>
            Both parties must sign before the journey can begin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Your Status */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                hasSigned ? 'bg-success text-success-foreground' : 'bg-warning/20 text-warning'
              }`}>
                {hasSigned ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Clock className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">Your Signature</p>
                <p className="text-sm text-muted-foreground">
                  {hasSigned ? 'You have signed the covenant' : 'Waiting for your signature'}
                </p>
              </div>
            </div>
            {hasSigned ? (
              <Badge variant="default" className="bg-success text-success-foreground">
                Signed
              </Badge>
            ) : (
              <Badge variant="secondary">Pending</Badge>
            )}
          </div>

          {/* Partner Status */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                partnerHasSigned ? 'bg-success text-success-foreground' : 'bg-muted'
              }`}>
                {partnerHasSigned ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Clock className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {partner?.full_name || (isLeader ? 'Learner' : 'Leader')}&apos;s Signature
                </p>
                <p className="text-sm text-muted-foreground">
                  {partnerHasSigned 
                    ? `${partner?.full_name || 'They'} signed the covenant`
                    : `Waiting for ${partner?.full_name || 'them'} to sign`
                  }
                </p>
              </div>
            </div>
            {partnerHasSigned ? (
              <Badge variant="default" className="bg-success text-success-foreground">
                Signed
              </Badge>
            ) : (
              <Badge variant="secondary">Pending</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Why Covenant */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Heart className="h-6 w-6 text-primary shrink-0" />
            <div>
              <h3 className="font-medium text-foreground mb-2">Why Sign a Covenant?</h3>
              <p className="text-sm text-muted-foreground">
                The discipleship covenant establishes mutual commitment, confidentiality, and accountability 
                between you and your partner. It creates a sacred space for growth and ensures both parties 
                are ready to invest in this transformative 6-week journey together.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Button */}
      <div className="text-center">
        {!hasSigned ? (
          <Button size="lg" asChild>
            <Link href="/dashboard/covenant">
              Sign the Covenant
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You have signed the covenant. Waiting for {partner?.full_name || 'your partner'} to sign.
            </p>
            <Button variant="outline" asChild>
              <Link href="/dashboard/covenant">
                View Covenant
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
