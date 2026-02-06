'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { joinPairing } from '@/lib/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Copy, CheckCircle, Loader2, RefreshCw, Mail } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile } from '@/lib/types'

interface NoPairingStateProps {
  profile: Profile
  pairingCode?: string | null
  pairingId?: string | null
}

export function NoPairingState({ profile, pairingCode, pairingId }: NoPairingStateProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [currentCode, setCurrentCode] = useState(pairingCode || null)

  const supabase = createClient()

  const copyCode = async () => {
    if (currentCode) {
      await navigator.clipboard.writeText(currentCode)
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
        invite_code: code,
        status: 'pending',
      })

    if (error) {
      toast.error('Failed to create pairing code')
      setIsCreating(false)
      return
    }

    setCurrentCode(code)
    setIsCreating(false)
    toast.success('Pairing code created!')
    router.refresh()
  }

  const handleRegenerateCode = async () => {
    if (!pairingId) return
    
    setIsRegenerating(true)
    
    const newCode = generatePairingCode()
    
    const { error } = await supabase
      .from('pairings')
      .update({ invite_code: newCode })
      .eq('id', pairingId)

    if (error) {
      toast.error('Failed to regenerate code')
      setIsRegenerating(false)
      return
    }

    setCurrentCode(newCode)
    setIsRegenerating(false)
    toast.success('New pairing code generated!')
  }

  const handleShareViaEmail = () => {
    if (!currentCode) return
    const subject = encodeURIComponent('Join me on Stand Walk Run')
    const body = encodeURIComponent(
      `I'd like to invite you to join me on a discipleship journey through Stand Walk Run!\n\n` +
      `Use this pairing code to connect with me:\n\n` +
      `${currentCode}\n\n` +
      `Here's how to get started:\n` +
      `1. Go to the Stand Walk Run app and create an account\n` +
      `2. Select "Learner" as your role\n` +
      `3. Enter the pairing code above to connect with me\n\n` +
      `Looking forward to walking this journey together!`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const handleJoinPairing = async () => {
    if (!joinCode.trim()) {
      toast.error('Please enter a pairing code')
      return
    }

    setIsLoading(true)

    const result = await joinPairing(joinCode)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    toast.success('Successfully connected with your Leader!')
    // Hard refresh to ensure the server re-queries the updated pairing
    window.location.href = '/dashboard'
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
                {currentCode 
                  ? 'Share your pairing code with your Learner to begin the journey together.'
                  : 'Create a pairing code to invite your Learner.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {currentCode ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-center block text-muted-foreground text-xs uppercase tracking-wider">Your Pairing Code</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 h-14 flex items-center justify-center rounded-lg border-2 border-primary/20 bg-muted font-mono text-2xl sm:text-3xl tracking-[0.4em] font-bold text-primary">
                        {currentCode}
                      </div>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-14 w-14 shrink-0 bg-transparent"
                        onClick={copyCode}
                      >
                        {copied ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
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

                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleShareViaEmail}
                      className="w-full"
                      size="lg"
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Share via Email
                    </Button>

                    <Button 
                      variant="outline"
                      onClick={handleRegenerateCode}
                      disabled={isRegenerating}
                      className="w-full bg-transparent"
                    >
                      {isRegenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Regenerate Code
                        </>
                      )}
                    </Button>
                  </div>
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
