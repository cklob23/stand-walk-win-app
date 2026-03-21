import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Admin Portal | Stand Walk Run',
    description: 'Manage your organization, members, and access codes',
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return children
}
