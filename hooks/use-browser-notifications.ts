'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

type NotifPermission = 'default' | 'denied' | 'granted'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotifPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const hasCheckedRef = useRef(false)

  const isSupported = typeof window !== 'undefined' && 'Notification' in window

  // Check current permission on mount
  useEffect(() => {
    if (!isSupported) return
    setPermission(Notification.permission as NotifPermission)

    // Check existing push subscription
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setIsSubscribed(!!sub))
        .catch(() => { /* ignore */ })
    }
  }, [isSupported])

  // Try to register service worker on mount (best-effort)
  useEffect(() => {
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }
  }, [])

  // Attempt to subscribe to Web Push (best-effort, won't block if it fails)
  const subscribeToPush = useCallback(async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) return

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        const keyArray = urlBase64ToUint8Array(vapidKey)
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyArray as unknown as BufferSource,
        })
      }

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })

      if (response.ok) setIsSubscribed(true)
    } catch {
      // Web Push failed (e.g. localhost, blocked ports). Notification API still works.
    }
  }, [])

  // Request notification permission and optionally try push subscription
  const requestPermission = useCallback(async (): Promise<NotifPermission> => {
    if (!isSupported) return 'denied'

    if (Notification.permission === 'granted') {
      setPermission('granted')
      subscribeToPush() // best-effort, fire-and-forget
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      setPermission('denied')
      return 'denied'
    }

    const result = await Notification.requestPermission()
    setPermission(result as NotifPermission)

    if (result === 'granted') {
      subscribeToPush() // best-effort, fire-and-forget
    }

    return result as NotifPermission
  }, [isSupported, subscribeToPush])

  // Show a browser notification (works whenever the tab is open and permission is granted)
  const sendNotification = useCallback(
    (title: string, options?: { body?: string; tag?: string; onClick?: () => void }) => {
      if (!isSupported || Notification.permission !== 'granted') return

      // Skip in-tab notification if page is hidden (push SW handles background)
      if (document.visibilityState === 'hidden' && isSubscribed) return

      try {
        const notification = new Notification(title, {
          body: options?.body,
          tag: options?.tag,
          icon: '/icon-192.png',
        })

        notification.onclick = () => {
          window.focus()
          options?.onClick?.()
          notification.close()
        }

        setTimeout(() => notification.close(), 5000)
      } catch {
        // Silently fail
      }
    },
    [isSupported, isSubscribed]
  )

  return {
    permission,
    isSubscribed,
    isSupported,
    requestPermission,
    subscribeToPush,
    sendNotification,
  }
}
