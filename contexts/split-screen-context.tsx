'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

type PanelContent = 'bible' | 'journal' | 'schedule' | 'messages' | 'dashboard' | 'covenant' | null

interface SplitScreenContextType {
    isSplitScreen: boolean
    leftPanel: PanelContent
    rightPanel: PanelContent
    toggleSplitScreen: () => void
    setLeftPanel: (content: PanelContent) => void
    setRightPanel: (content: PanelContent) => void
    closeSplitScreen: () => void
}

const SplitScreenContext = createContext<SplitScreenContextType | undefined>(undefined)

const STORAGE_KEY = 'split-screen-state'

interface StoredState {
    isSplitScreen: boolean
    leftPanel: PanelContent
    rightPanel: PanelContent
}

export function SplitScreenProvider({ children }: { children: React.ReactNode }) {
    const [isSplitScreen, setIsSplitScreen] = useState(false)
    const [leftPanel, setLeftPanelState] = useState<PanelContent>('bible')
    const [rightPanel, setRightPanelState] = useState<PanelContent>('journal')
    const [isHydrated, setIsHydrated] = useState(false)

    // Load state from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                const state: StoredState = JSON.parse(stored)
                setIsSplitScreen(state.isSplitScreen)
                setLeftPanelState(state.leftPanel)
                setRightPanelState(state.rightPanel)
            }
        } catch {
            // Ignore localStorage errors
        }
        setIsHydrated(true)
    }, [])

    // Save state to localStorage when it changes
    useEffect(() => {
        if (!isHydrated) return
        try {
            const state: StoredState = { isSplitScreen, leftPanel, rightPanel }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        } catch {
            // Ignore localStorage errors
        }
    }, [isSplitScreen, leftPanel, rightPanel, isHydrated])

    const toggleSplitScreen = useCallback(() => {
        setIsSplitScreen(prev => !prev)
    }, [])

    const setLeftPanel = useCallback((content: PanelContent) => {
        setLeftPanelState(content)
    }, [])

    const setRightPanel = useCallback((content: PanelContent) => {
        setRightPanelState(content)
    }, [])

    const closeSplitScreen = useCallback(() => {
        setIsSplitScreen(false)
    }, [])

    return (
        <SplitScreenContext.Provider
            value={{
                isSplitScreen: isHydrated ? isSplitScreen : false,
                leftPanel,
                rightPanel,
                toggleSplitScreen,
                setLeftPanel,
                setRightPanel,
                closeSplitScreen,
            }}
        >
            {children}
        </SplitScreenContext.Provider>
    )
}

export function useSplitScreen() {
    const context = useContext(SplitScreenContext)
    if (context === undefined) {
        throw new Error('useSplitScreen must be used within a SplitScreenProvider')
    }
    return context
}
