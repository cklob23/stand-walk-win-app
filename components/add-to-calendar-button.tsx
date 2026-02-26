'use client'

import { useState } from 'react'
import { CalendarPlus, Apple, Download, Info, X, Monitor, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { getGoogleCalendarUrl, downloadICSFile, forceDownloadICSFile } from '@/lib/calendar'
import type { ScheduledMeeting } from '@/lib/types'

interface AddToCalendarButtonProps {
    meeting: ScheduledMeeting
    partnerName: string
    partnerPhone?: string | null
    weekTopic?: string | null
    weekNumber?: number | null
    size?: 'sm' | 'default'
}

export function AddToCalendarButton({ meeting, partnerName, partnerPhone, weekTopic, weekNumber, size = 'sm' }: AddToCalendarButtonProps) {
    const isSmall = size === 'sm'
    const options = { partnerPhone, weekTopic, weekNumber }
    const [showIcsHelp, setShowIcsHelp] = useState(false)

    const handleOutlookDownload = () => {
        forceDownloadICSFile(meeting, partnerName, options)
        // Show the help dialog after a brief moment so the download starts first
        setTimeout(() => setShowIcsHelp(true), 500)
    }

    return (
        <>
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
                <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem asChild>
                        <a
                            href={getGoogleCalendarUrl(meeting, partnerName, options)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2"
                        >
                            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                                <path d="M18.316 5.684H24L18.316 0v5.684z" fill="#EA4335" />
                                <path d="M18.316 5.684V0H5.684A1.895 1.895 0 003.79 1.895v20.21A1.895 1.895 0 005.684 24h12.632a1.895 1.895 0 001.895-1.895V5.684h-1.895z" fill="#4285F4" />
                                <path d="M5.684 24a1.895 1.895 0 01-1.895-1.895V22.2A1.895 1.895 0 005.684 24h12.632a1.895 1.895 0 001.895-1.895v-.095a1.895 1.895 0 01-1.895 1.895H5.684z" fill="#1967D2" />
                                <path d="M18.316 5.684h5.684v.095h-5.684V5.684z" fill="#1967D2" />
                                <path d="M7.579 16.421h1.263v-4.737l-1.421.947v-1.105l1.421-.947h1.263v5.842h1.263v1.053H7.58v-1.053zm6.316 1.158a2.474 2.474 0 01-1.737-.632l.737-.842a1.58 1.58 0 001.053.421c.579 0 .947-.368.947-.895 0-.526-.368-.894-.947-.894a1.42 1.42 0 00-.895.316l-.632-.421.21-3.053h3.474v1.053H14l-.105 1.368a1.89 1.89 0 01.79-.158c1.158 0 1.947.737 1.947 1.895s-.842 1.842-2.737 1.842z" fill="#FBBC04" />
                            </svg>
                            Google Calendar
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={async () => {
                            await downloadICSFile(meeting, partnerName, options)
                        }}
                        className="flex items-center gap-2"
                    >
                        <Apple className="h-4 w-4 shrink-0" />
                        Apple Calendar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={handleOutlookDownload}
                        className="flex items-center gap-2"
                    >
                        <Download className="h-4 w-4 shrink-0" />
                        Outlook / Download .ics
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* ICS Help Dialog */}
            <Dialog open={showIcsHelp} onOpenChange={setShowIcsHelp}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <Info className="h-5 w-5 text-primary" />
                            Add to Your Calendar
                        </DialogTitle>
                        <DialogDescription>
                            {"Your meeting file has been downloaded. Here's how to add it to your calendar."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* Windows / Outlook */}
                        <div className="rounded-lg border bg-muted/30 p-4">
                            <div className="flex items-start gap-3">
                                <Monitor className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                                <div>
                                    <p className="font-medium text-sm">Windows / Outlook</p>
                                    <ol className="mt-1.5 text-sm text-muted-foreground list-decimal list-inside space-y-1">
                                        <li>Find the downloaded <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.ics</span> file in your Downloads folder</li>
                                        <li>Double-click the file to open it in Outlook</li>
                                        <li>{'Click "Save & Close" to add it to your calendar'}</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        {/* Mac */}
                        <div className="rounded-lg border bg-muted/30 p-4">
                            <div className="flex items-start gap-3">
                                <Apple className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                                <div>
                                    <p className="font-medium text-sm">Mac</p>
                                    <ol className="mt-1.5 text-sm text-muted-foreground list-decimal list-inside space-y-1">
                                        <li>Find the downloaded <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.ics</span> file in your Downloads folder</li>
                                        <li>Double-click to open it in Calendar</li>
                                        <li>{'Click "Add" in the dialog that appears'}</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        {/* Tip */}
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                            <p className="text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground">Tip:</span>{' '}
                                If you use Apple Calendar on Mac, try the <span className="font-medium">Apple Calendar</span> option instead for a smoother experience that adds the event directly.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            size="sm"
                            onClick={() => setShowIcsHelp(false)}
                        >
                            Got it
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
