'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, BookHeart } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function JournalPanel() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    // For the journal, we'll redirect to the actual journal page
    // since it has complex server-side data fetching
    const handleOpenJournal = () => {
        router.push('/dashboard/journal')
    }

    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <BookHeart className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Prayer Journal</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                View your prayer journal alongside the Bible for deeper reflection.
            </p>
            <Button onClick={handleOpenJournal} variant="outline">
                Open Journal in Left Panel
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
                Tip: Navigate to Journal, then select Bible here
            </p>
        </div>
    )
}
