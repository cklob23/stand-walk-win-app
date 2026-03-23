'use client'

import { useState, useRef } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface EmailChangeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    currentEmail: string
    userId: string
    onEmailChanged?: (newEmail: string) => void
}

export function EmailChangeDialog({
    open,
    onOpenChange,
    currentEmail,
    userId,
    onEmailChanged
}: EmailChangeDialogProps) {
    const [step, setStep] = useState<'email' | 'otp' | 'success'>('email')
    const [newEmail, setNewEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)
    const [isResending, setIsResending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [otpValues, setOtpValues] = useState(['', '', '', '', '', ''])
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    const resetState = () => {
        setStep('email')
        setNewEmail('')
        setError(null)
        setOtpValues(['', '', '', '', '', ''])
        setIsLoading(false)
        setIsVerifying(false)
        setIsResending(false)
    }

    const handleSendOtp = async () => {
        if (!newEmail.trim()) {
            setError('Please enter an email address')
            return
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(newEmail)) {
            setError('Please enter a valid email address')
            return
        }

        if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
            setError('New email must be different from current email')
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/profile/send-email-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newEmail: newEmail.trim(), userId }),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || 'Failed to send verification code')
                return
            }

            setStep('otp')
            toast.success('Verification code sent to your new email')
        } catch {
            setError('An error occurred. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return // Only allow digits

        const newOtpValues = [...otpValues]
        newOtpValues[index] = value.slice(-1) // Only keep last digit
        setOtpValues(newOtpValues)

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        const newOtpValues = [...otpValues]
        for (let i = 0; i < pastedData.length; i++) {
            newOtpValues[i] = pastedData[i]
        }
        setOtpValues(newOtpValues)
        // Focus last filled input or first empty one
        const lastFilledIndex = Math.min(pastedData.length - 1, 5)
        inputRefs.current[lastFilledIndex]?.focus()
    }

    const handleVerifyOtp = async () => {
        const otp = otpValues.join('')
        if (otp.length !== 6) {
            setError('Please enter the complete 6-digit code')
            return
        }

        setIsVerifying(true)
        setError(null)

        try {
            const response = await fetch('/api/profile/verify-email-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newEmail: newEmail.trim(), userId, otp }),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || 'Invalid verification code')
                return
            }

            setStep('success')
            toast.success('Email updated successfully!')

            // Call callback and close after a short delay
            setTimeout(() => {
                onEmailChanged?.(newEmail.trim())
                onOpenChange(false)
                resetState()
            }, 2000)
        } catch {
            setError('An error occurred. Please try again.')
        } finally {
            setIsVerifying(false)
        }
    }

    const handleResendOtp = async () => {
        setIsResending(true)
        setError(null)

        try {
            const response = await fetch('/api/profile/send-email-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newEmail: newEmail.trim(), userId }),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || 'Failed to resend code')
                return
            }

            toast.success('New verification code sent')
            setOtpValues(['', '', '', '', '', ''])
        } catch {
            setError('An error occurred. Please try again.')
        } finally {
            setIsResending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            onOpenChange(isOpen)
            if (!isOpen) resetState()
        }}>
            <DialogContent className="sm:max-w-md">
                {step === 'email' && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5 text-primary" />
                                Change Email Address
                            </DialogTitle>
                            <DialogDescription>
                                Enter your new email address. You'll need to verify it with a code sent to the new email.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="currentEmail">Current Email</Label>
                                <Input
                                    id="currentEmail"
                                    value={currentEmail}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newEmail">New Email</Label>
                                <Input
                                    id="newEmail"
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => {
                                        setNewEmail(e.target.value)
                                        setError(null)
                                    }}
                                    placeholder="Enter your new email address"
                                    disabled={isLoading}
                                />
                            </div>
                            {error && (
                                <p className="text-sm text-destructive">{error}</p>
                            )}
                            <Button
                                onClick={handleSendOtp}
                                disabled={isLoading || !newEmail.trim()}
                                className="w-full"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending Code...
                                    </>
                                ) : (
                                    'Send Verification Code'
                                )}
                            </Button>
                        </div>
                    </>
                )}

                {step === 'otp' && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5 text-primary" />
                                Verify Your Email
                            </DialogTitle>
                            <DialogDescription>
                                Enter the 6-digit code sent to <strong>{newEmail}</strong>
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="flex justify-center gap-2">
                                {otpValues.map((value, index) => (
                                    <Input
                                        key={index}
                                        ref={(el) => { inputRefs.current[index] = el }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={value}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        onPaste={index === 0 ? handleOtpPaste : undefined}
                                        className="h-12 w-12 text-center text-xl font-semibold"
                                        disabled={isVerifying}
                                    />
                                ))}
                            </div>
                            {error && (
                                <p className="text-sm text-destructive text-center">{error}</p>
                            )}
                            <Button
                                onClick={handleVerifyOtp}
                                disabled={isVerifying || otpValues.join('').length !== 6}
                                className="w-full"
                            >
                                {isVerifying ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    'Verify & Update Email'
                                )}
                            </Button>
                            <div className="flex items-center justify-between text-sm">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setStep('email')
                                        setOtpValues(['', '', '', '', '', ''])
                                        setError(null)
                                    }}
                                    disabled={isVerifying}
                                >
                                    <ArrowLeft className="mr-1 h-4 w-4" />
                                    Change email
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleResendOtp}
                                    disabled={isResending || isVerifying}
                                >
                                    {isResending ? (
                                        <>
                                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        'Resend code'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </>
                )}

                {step === 'success' && (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <div className="rounded-full bg-primary/10 p-3">
                            <CheckCircle2 className="h-8 w-8 text-primary" />
                        </div>
                        <div className="text-center">
                            <h3 className="font-semibold text-lg">Email Updated!</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Your email has been changed to {newEmail}
                            </p>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
