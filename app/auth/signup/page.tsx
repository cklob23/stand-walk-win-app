import { SignupForm } from '@/components/auth/signup-form'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground">Disciples Path</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Begin your journey</h1>
          <p className="mt-2 text-muted-foreground">
            Create an account to start your discipleship path
          </p>
        </div>
        
        <SignupForm />
        
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
