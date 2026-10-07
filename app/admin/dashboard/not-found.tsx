import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AdminDashboardNotFound() {
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Admin page not found</h1>
                <p className="text-muted-foreground">
                    This admin URL does not exist or has been moved.
                </p>
            </div>
            <Button asChild>
                <Link href="/admin/dashboard">Back to dashboard</Link>
            </Button>
        </div>
    )
}
