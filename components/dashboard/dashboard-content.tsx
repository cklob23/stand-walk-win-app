'use client'

import { useSplitScreen } from '@/contexts/split-screen-context'
import { useEffect, useState, Suspense } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader2, BookOpen, PenLine, Calendar, MessageSquare, LayoutDashboard, ScrollText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

// Dynamically import page components for the right panel
const BibleReaderWrapper = dynamic(() => import('./split-panels/bible-panel'), {
    loading: () => <PanelLoader />,
})
const JournalPanelWrapper = dynamic(() => import('./split-panels/journal-panel'), {
    loading: () => <PanelLoader />,
})
const SchedulePanelWrapper = dynamic(() => import('./split-panels/schedule-panel'), {
    loading: () => <PanelLoader />,
})
const MessagesPanelWrapper = dynamic(() => import('./split-panels/messages-panel'), {
    loading: () => <PanelLoader />,
})
const DashboardPanelWrapper = dynamic(() => import('./split-panels/dashboard-panel'), {
    loading: () => <PanelLoader />,
})

function PanelLoader() {
    return (
        <div className="flex items-center justify-center h-full min-h-[300px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    )
}

function RightPanelContent({ panel }: { panel: string | null }) {
    switch (panel) {
        case 'bible':
            return <BibleReaderWrapper />
        case 'journal':
            return <JournalPanelWrapper />
        case 'schedule':
            return <SchedulePanelWrapper />
        case 'messages':
            return <MessagesPanelWrapper />
        case 'dashboard':
            return <DashboardPanelWrapper />
        default:
            return (
                <div className="flex items-center justify-center h-full text-muted-foreground p-8">
                    <p className="text-sm text-center">Select content from the dropdown above to view it side-by-side</p>
                </div>
            )
    }
}

interface DashboardContentProps {
    children: React.ReactNode
}

export function DashboardContent({ children }: DashboardContentProps) {
    const { isSplitScreen, leftPanel, rightPanel, setLeftPanel, setRightPanel, closeSplitScreen } = useSplitScreen()
    const pathname = usePathname()
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    // Sync left panel with current route
    useEffect(() => {
        if (isSplitScreen && isMounted) {
            let currentContent: typeof leftPanel = 'dashboard'
            if (pathname.includes('/bible')) currentContent = 'bible'
            else if (pathname.includes('/journal')) currentContent = 'journal'
            else if (pathname.includes('/schedule')) currentContent = 'schedule'
            else if (pathname.includes('/messages')) currentContent = 'messages'
            else if (pathname.includes('/covenant')) currentContent = 'covenant'

            if (currentContent !== leftPanel) {
                setLeftPanel(currentContent)
            }
        }
    }, [pathname, isSplitScreen, isMounted, leftPanel, setLeftPanel])

    // Don't render split layout until mounted (avoids hydration mismatch)
    if (!isMounted) {
        return <>{children}</>
    }

    // Not in split screen mode - render normally
    if (!isSplitScreen) {
        return <>{children}</>
    }

    // Panel options with icons
    const panelOptions = [
        { value: 'bible', label: 'Bible', icon: BookOpen },
        { value: 'journal', label: 'Journal', icon: PenLine },
        { value: 'schedule', label: 'Schedule', icon: Calendar },
        { value: 'messages', label: 'Messages', icon: MessageSquare },
        { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { value: 'covenant', label: 'Covenant', icon: ScrollText },
    ]

    const selectedOption = panelOptions.find(o => o.value === rightPanel)
    const SelectedIcon = selectedOption?.icon || BookOpen

    // Split screen mode - desktop only (hidden on mobile via CSS)
    return (
        <>
            {/* Mobile: Show normal content */}
            <div className="lg:hidden">
                {children}
            </div>

            {/* Desktop: Show split screen - fixed to viewport */}
            <div className="hidden lg:fixed lg:inset-0 lg:top-16 lg:grid lg:grid-cols-2 overflow-hidden bg-background z-10">
                {/* Left Panel - Current Route Content */}
                <div className="flex flex-col h-full border-r bg-background min-h-0">
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {children}
                    </div>
                </div>

                {/* Right Panel - Secondary Content */}
                <div className="flex flex-col h-full bg-background min-h-0">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
                        <Select
                            value={rightPanel || undefined}
                            onValueChange={(value) => setRightPanel(value as typeof rightPanel)}
                        >
                            <SelectTrigger className="h-8 w-[160px] text-sm">
                                <SelectedIcon className="h-4 w-4 shrink-0" />
                                <span className="truncate">{selectedOption?.label || 'Select content...'}</span>
                            </SelectTrigger>
                            <SelectContent>
                                {panelOptions.map((option) => {
                                    const Icon = option.icon
                                    return (
                                        <SelectItem key={option.value} value={option.value}>
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-4 w-4" />
                                                <span>{option.label}</span>
                                            </div>
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={closeSplitScreen}
                            title="Close split view"
                        >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close split view</span>
                        </Button>
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <Suspense fallback={<PanelLoader />}>
                            <RightPanelContent panel={rightPanel} />
                        </Suspense>
                    </div>
                </div>
            </div>
        </>
    )
}
