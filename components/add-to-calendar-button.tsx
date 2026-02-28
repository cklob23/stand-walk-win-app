'use client'

import { useState } from 'react'
import { CalendarPlus, Info, Monitor, Apple } from 'lucide-react'
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
                            <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48">
                                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
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
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                        </svg>
                        Apple Calendar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={handleOutlookDownload}
                        className="flex items-center gap-2"
                    >
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                            <path d="M24 7.387v10.478c0 .23-.08.424-.238.583a.793.793 0 01-.583.238h-9.167V6.565h9.167c.23 0 .424.08.583.238.159.159.238.353.238.583z" fill="#0364B8" />
                            <path d="M16.833 6.565v12.121L.75 21.583a.696.696 0 01-.542-.196A.696.696 0 010 20.833V4.417c0-.209.069-.389.208-.542a.696.696 0 01.542-.196l16.083 2.886z" fill="#0078D4" />
                            <path d="M8.417 9.833c-1.028 0-1.875.344-2.542 1.031-.667.688-1 1.563-1 2.625 0 1.042.33 1.903.99 2.584.66.68 1.5 1.02 2.52 1.02 1.04 0 1.892-.34 2.557-1.02.664-.68.997-1.547.997-2.6 0-1.073-.33-1.952-.99-2.636-.66-.683-1.504-1.025-2.531-1.025zm-.052 1.354c.605 0 1.083.236 1.432.708.35.472.524 1.06.524 1.763 0 .722-.177 1.316-.531 1.78-.354.466-.828.698-1.422.698-.608 0-1.089-.229-1.443-.688-.354-.458-.531-1.051-.531-1.778 0-.736.175-1.33.525-1.784.35-.453.837-.68 1.446-.68z" fill="white" />
                            <path d="M14.012 11.304h2.82v1.167h-2.82V11.304zm0 2.334h2.82v1.167h-2.82V13.638zm0-4.667h2.82v1.167h-2.82V8.971z" fill="#0364B8" />
                        </svg>
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
