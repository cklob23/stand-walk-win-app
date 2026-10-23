import { notFound } from 'next/navigation'

export default function DailyPrayerPreviewLayout({
    children,
}: {
    children: React.ReactNode
}) {
    if (process.env.NODE_ENV === 'production') {
        notFound()
    }
    return children
}
