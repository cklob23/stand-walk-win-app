'use client'

import { useRouter } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function MessagesPanel() {
    const router = useRouter()

    const handleOpenMessages = () => {
        router.push('/dashboard/messages')
    }

    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Messages</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                Chat with your discipleship partner.
            </p>
            <Button onClick={handleOpenMessages} variant="outline">
                Open Messages in Left Panel
            </Button>
        </div>
    )
}
