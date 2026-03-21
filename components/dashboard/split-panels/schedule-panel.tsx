'use client'

import { useRouter } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SchedulePanel() {
    const router = useRouter()

    const handleOpenSchedule = () => {
        router.push('/dashboard/schedule')
    }

    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <Calendar className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Schedule</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                View your meeting schedule and availability.
            </p>
            <Button onClick={handleOpenSchedule} variant="outline">
                Open Schedule in Left Panel
            </Button>
        </div>
    )
}
