'use client'

import { useSplitScreen } from '@/contexts/split-screen-context'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { X, GripVertical, BookMarked, PenLine, Calendar, MessageSquare, LayoutDashboard, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type PanelContent = 'bible' | 'journal' | 'schedule' | 'messages' | 'dashboard' | 'covenant'

const panelOptions: { value: PanelContent; label: string; icon: typeof BookMarked; href: string }[] = [
    { value: 'bible', label: 'Bible', icon: BookMarked, href: '/dashboard/bible' },
    { value: 'journal', label: 'Journal', icon: PenLine, href: '/dashboard/journal' },
    { value: 'schedule', label: 'Schedule', icon: Calendar, href: '/dashboard/schedule' },
    { value: 'messages', label: 'Messages', icon: MessageSquare, href: '/dashboard/messages' },
    { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { value: 'covenant', label: 'Covenant', icon: ScrollText, href: '/dashboard/covenant' },
]

function getContentFromPath(pathname: string): PanelContent {
    if (pathname.includes('/bible')) return 'bible'
    if (pathname.includes('/journal')) return 'journal'
    if (pathname.includes('/schedule')) return 'schedule'
    if (pathname.includes('/messages')) return 'messages'
    if (pathname.includes('/covenant')) return 'covenant'
    return 'dashboard'
}

interface SplitPanelProps {
    side: 'left' | 'right'
    content: PanelContent | null
    onContentChange: (content: PanelContent) => void
    children?: React.ReactNode
    onClose?: () => void
}

function SplitPanel({ side, content, onContentChange, children, onClose }: SplitPanelProps) {
    const router = useRouter()
    const currentOption = panelOptions.find(o => o.value === content)
    const Icon = currentOption?.icon || BookMarked

    const handleContentChange = (value: PanelContent) => {
        onContentChange(value)
        const option = panelOptions.find(o => o.value === value)
        if (option) {
            // Navigate to the new content
            router.push(option.href)
        }
    }

    return (
        <div className="flex flex-col h-full border-r last:border-r-0 bg-background">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    <Select value={content || undefined} onValueChange={(v) => handleContentChange(v as PanelContent)}>
                        <SelectTrigger className="h-8 w-[140px] text-sm border-0 bg-transparent hover:bg-muted/50 focus:ring-0 focus:ring-offset-0">
                            <Icon className="h-4 w-4 shrink-0" />
                            <SelectValue placeholder="Select...">
                                {currentOption?.label}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {panelOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center gap-2">
                                        <option.icon className="h-4 w-4" />
                                        {option.label}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {side === 'right' && onClose && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close split view</span>
                    </Button>
                )}
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-auto">
                {children}
            </div>
        </div>
    )
}

interface SplitScreenLayoutProps {
    children: React.ReactNode
    rightPanelContent?: React.ReactNode
}

export function SplitScreenLayout({ children, rightPanelContent }: SplitScreenLayoutProps) {
    const {
        isSplitScreen,
        leftPanel,
        rightPanel,
        setLeftPanel,
        setRightPanel,
        closeSplitScreen
    } = useSplitScreen()
    const pathname = usePathname()
    const router = useRouter()
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    // Sync left panel with current route
    useEffect(() => {
        if (isSplitScreen) {
            const currentContent = getContentFromPath(pathname)
            if (currentContent !== leftPanel) {
                setLeftPanel(currentContent)
            }
        }
    }, [pathname, isSplitScreen, leftPanel, setLeftPanel])

    // Don't render split screen on mobile or before hydration
    if (!isMounted || !isSplitScreen) {
        return <>{children}</>
    }

    const handleRightPanelChange = (content: PanelContent) => {
        setRightPanel(content)
    }

    const handleLeftPanelChange = (content: PanelContent) => {
        setLeftPanel(content)
        const option = panelOptions.find(o => o.value === content)
        if (option) {
            router.push(option.href)
        }
    }

    return (
        <div className="hidden lg:grid lg:grid-cols-2 h-full sticky top-0">
            {/* Left Panel - Current Route Content */}
            <SplitPanel
                side="left"
                content={leftPanel}
                onContentChange={handleLeftPanelChange}
            >
                <div className="h-full overflow-auto">
                    {children}
                </div>
            </SplitPanel>

            {/* Right Panel - Secondary Content */}
            <SplitPanel
                side="right"
                content={rightPanel}
                onContentChange={handleRightPanelChange}
                onClose={closeSplitScreen}
            >
                <div className="h-full overflow-auto">
                    {rightPanelContent || (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <p className="text-sm">Select content from the dropdown above</p>
                        </div>
                    )}
                </div>
            </SplitPanel>
        </div>
    )
}

// Component to show regular layout on mobile or when split screen is off
export function SplitScreenWrapper({ children }: { children: React.ReactNode }) {
    const { isSplitScreen } = useSplitScreen()
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    // Show children normally if not mounted, not split screen, or on mobile (handled by CSS)
    if (!isMounted || !isSplitScreen) {
        return <>{children}</>
    }

    // On desktop with split screen, hide the regular content (SplitScreenLayout handles display)
    return (
        <>
            <div className="lg:hidden">{children}</div>
        </>
    )
}
