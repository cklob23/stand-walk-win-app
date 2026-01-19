'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Copy, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile } from '@/lib/types'

interface NoPairingStateProps {
  profile: Profile
  pairingCode?: string | null
}

export function NoPairingState({ profile, pairingCode }: NoPairingStateProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const supabase = createClient()

  const copyCode = async () => {
    if (pairingCode) {
      await navigator.clipboard.writeText(pairingCode)
      setCopied(true)
      toast.success('Code copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const generatePairingCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const handleCreatePairing = async () => {
    setIsCreating(true)
    
    const code = generatePairingCode()
    
    const { error } = await supabase
      .from('pairings')
      .insert({
        leader_id: profile.id,
        pairing_code: code,
        status: 'pending',
      })

    if (error) {
      toast.error('Failed to create pairing code')
      setIsCreating(false)
      return
    }

    toast.success('Pairing code created!')
    router.refresh()
  }

  const handleJoinPairing = async () => {
    if (!joinCode.trim()) {
      toast.error('Please enter a pairing code')
      return
    }

    setIsLoading(true)

    // Find the pairing
    const { data: pairing, error: findError } = await supabase
      .from('pairings')
      .select('*')
      .eq('pairing_code', joinCode.toUpperCase())
      .eq('status', 'pending')
      .is('learner_id', null)
      .single()

    if (findError || !pairing) {
      toast.error('Invalid or already used pairing code')
      setIsLoading(false)
      return
    }

    // Join the pairing
    const { error: joinError } = await supabase
      .from('pairings')
      .update({
        learner_id: profile.id,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', pairing.id)

    if (joinError) {
      toast.error('Failed to join pairing')
      setIsLoading(false)
      return
    }

    toast.success('Successfully connected!')
    router.refresh()
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {profile.role === 'leader' ? (
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Users className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle>Waiting for Learner</CardTitle>
              <CardDescription>
                {pairingCode 
                  ? 'Share your pairing code with your Learner to begin the journey together.'
                  : 'Create a pairing code to invite your Learner.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pairingCode ? (
                <>
                  <div className="space-y-2">
                    <Label>Your Pairing Code</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 h-12 flex items-center justify-center rounded-lg border bg-muted font-mono text-2xl tracking-[0.5em]">
                        {pairingCode}
                      </div>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-12 w-12 shrink-0 bg-transparent"
                        onClick={copyCode}
                      >
                        {copied ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : (
                          <Copy className="h-5 w-5" />
                        )}
                        <span className="sr-only">Copy code</span>
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Your Learner will enter this code to connect with you.
                  </p>
                </>
              ) : (
                <Button 
                  onClick={handleCreatePairing} 
                  disabled={isCreating} 
                  className="w-full"
                  size="lg"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Pairing Code'
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Users className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle>Connect with Your Leader</CardTitle>
              <CardDescription>
                Enter the pairing code your Leader shared with you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="joinCode">Pairing Code</Label>
                <Input
                  id="joinCode"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character code"
                  maxLength={6}
                  className="h-12 text-center text-lg font-mono tracking-widest"
                />
              </div>
              <Button 
                onClick={handleJoinPairing} 
                disabled={isLoading || joinCode.length < 6}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Join Discipleship'
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
