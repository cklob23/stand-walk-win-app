'use client'

import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getGoogleCalendarUrl, downloadICSFile } from '@/lib/calendar'
import type { ScheduledMeeting } from '@/lib/types'

interface AddToCalendarButtonProps {
    meeting: ScheduledMeeting
    partnerName: string
    partnerPhone?: string | null
    size?: 'sm' | 'default'
}

export function AddToCalendarButton({ meeting, partnerName, partnerPhone, size = 'sm' }: AddToCalendarButtonProps) {
    const isSmall = size === 'sm'

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={isSmall ? 'h-7 text-xs bg-transparent' : 'text-xs bg-transparent'}
                >
                    <CalendarPlus className={isSmall ? 'h-3 w-3 mr-1' : 'h-3.5 w-3.5 mr-1.5'} />
                    Add to Calendar
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                    <a
                        href={getGoogleCalendarUrl(meeting, partnerName, partnerPhone)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Google Calendar
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => downloadICSFile(meeting, partnerName, partnerPhone)}
                >
                    Apple Calendar / Outlook (.ics)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
