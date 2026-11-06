'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

interface MobileConversationChromeValue {
  conversationOpen: boolean
  setConversationOpen: (open: boolean) => void
}

const MobileConversationChromeContext = createContext<MobileConversationChromeValue>({
  conversationOpen: false,
  setConversationOpen: () => {},
})

export function MobileConversationChromeProvider({ children }: { children: React.ReactNode }) {
  const [conversationOpen, setConversationOpenState] = useState(false)
  const setConversationOpen = useCallback((open: boolean) => {
    setConversationOpenState(open)
  }, [])
  const value = useMemo(
    () => ({ conversationOpen, setConversationOpen }),
    [conversationOpen, setConversationOpen],
  )

  return (
    <MobileConversationChromeContext.Provider value={value}>
      {children}
    </MobileConversationChromeContext.Provider>
  )
}

export function useMobileConversationChrome() {
  return useContext(MobileConversationChromeContext)
}

/** Hides the main SWR dashboard nav on small screens while a conversation is open. */
export function MobileAwareDashboardHeader({ children }: { children: React.ReactNode }) {
  const { conversationOpen } = useMobileConversationChrome()
  return (
    <div
      data-testid="dashboard-header-shell"
      className={cn(conversationOpen && 'max-md:hidden')}
    >
      {children}
    </div>
  )
}
