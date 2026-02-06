'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

type NotificationPermission = 'default' | 'denied' | 'granted'

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const hasRequestedRef = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission as NotificationPermission)
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied' as NotificationPermission
    }

    if (Notification.permission === 'granted') {
      setPermission('granted')
      return 'granted' as NotificationPermission
    }

    if (Notification.permission === 'denied') {
      setPermission('denied')
      return 'denied' as NotificationPermission
    }

    if (!hasRequestedRef.current) {
      hasRequestedRef.current = true
      const result = await Notification.requestPermission()
      setPermission(result as NotificationPermission)
      return result as NotificationPermission
    }

    return Notification.permission as NotificationPermission
  }, [])

  const sendNotification = useCallback(
    (title: string, options?: { body?: string; tag?: string; onClick?: () => void }) => {
      if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        Notification.permission !== 'granted'
      ) {
        return
      }

      // Only send if the page is not currently visible
      if (document.visibilityState === 'visible') {
        return
      }

      try {
        const notification = new Notification(title, {
          body: options?.body,
          tag: options?.tag,
          icon: '/icon.svg',
        })

        if (options?.onClick) {
          notification.onclick = () => {
            window.focus()
            options.onClick?.()
            notification.close()
          }
        } else {
          notification.onclick = () => {
            window.focus()
            notification.close()
          }
        }

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000)
      } catch {
        // Silently fail if Notification constructor is not supported
      }
    },
    []
  )

  return {
    permission,
    requestPermission,
    sendNotification,
    isSupported: typeof window !== 'undefined' && 'Notification' in window,
  }
}
