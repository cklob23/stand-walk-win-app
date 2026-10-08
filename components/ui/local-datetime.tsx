'use client'

import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'

/**
 * ISO timestamps formatted after mount so SSR (UTC) and the device
 * timezone cannot disagree (React minified #418).
 */
export function LocalDateTime({
    value,
    pattern,
    prefix,
    className,
}: {
    value?: string | null
    pattern: string
    prefix?: string
    className?: string
}) {
    const [text, setText] = useState('')

    useEffect(() => {
        if (!value) {
            setText('')
            return
        }
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) {
            setText(value)
            return
        }
        const formatted = format(date, pattern)
        setText(prefix ? `${prefix} ${formatted}` : formatted)
    }, [value, pattern, prefix])

    if (!text) return null
    return <span className={className}>{text}</span>
}

export function LocalRelativeTime({
    value,
    className,
}: {
    value?: string | null
    className?: string
}) {
    const [text, setText] = useState('')

    useEffect(() => {
        if (!value) {
            setText('')
            return
        }
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) {
            setText('')
            return
        }
        setText(formatDistanceToNow(date, { addSuffix: true }))
    }, [value])

    if (!text) return null
    return <span className={className}>{text}</span>
}
