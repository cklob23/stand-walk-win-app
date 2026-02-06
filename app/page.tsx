import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  BookOpen, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Calendar, 
  Heart,
  ArrowRight,
  CheckCircle2
} from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single()

    if (profile?.onboarding_complete) {
      redirect('/dashboard')
    } else {
      redirect('/onboarding')
    }
  }

  const features = [
    {
      icon: Users,
      title: '1-on-1 Mentorship',
      description: 'Connect with a dedicated Leader or Learner for personalized spiritual guidance.',
    },
    {
      icon: Calendar,
      title: '6-Week Journey',
      description: 'Structured weekly content with scripture, reflections, and actionable assignments.',
    },
    {
      icon: MessageSquare,
      title: 'Real-time Messaging',
      description: 'Stay connected with your partner through in-app messaging and notifications.',
    },
    {
      icon: TrendingUp,
      title: 'Track Progress',
      description: 'Monitor your spiritual growth with visual progress tracking and milestones.',
    },
  ]

  const weeklyThemes = [
    'Foundation of Faith',
    'Prayer & Communion',
    'Scripture Study',
    'Community & Fellowship',
    'Service & Outreach',
    'Living Your Faith',
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-primary">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground text-sm sm:text-base">Stand Walk Run</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" asChild size="sm" className="hidden sm:flex">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button variant="ghost" asChild size="sm" className="sm:hidden">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="sm:hidden">
              <Link href="/auth/signup">Start</Link>
            </Button>
            <Button asChild className="hidden sm:flex">
              <Link href="/auth/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24 lg:py-32 relative">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight text-balance">
              Grow Together in{' '}
              <span className="text-primary">Faith</span>
            </h1>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty px-4">
              A transformative 6-week discipleship journey connecting Leaders and Learners 
              for meaningful spiritual growth, accountability, and lasting impact.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/auth/signup">
                  Start Your Journey
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto bg-transparent">
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Everything you need for discipleship</h2>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-4">
              Our platform provides the tools and structure for meaningful spiritual mentorship.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title} className="border-border/50">
                <CardContent className="pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Journey Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Your 6-Week Journey</h2>
              <p className="mt-3 sm:mt-4 text-sm sm:text-base text-muted-foreground">
                Each week builds upon the last, guiding you through foundational truths 
                and practical applications of faith.
              </p>
              <div className="mt-8 space-y-4">
                {weeklyThemes.map((theme, index) => (
                  <div key={theme} className="flex items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      {index + 1}
                    </div>
                    <span className="text-foreground font-medium">{theme}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="pt-6 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Heart className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Covenant Agreement</h3>
                      <p className="text-sm text-muted-foreground">
                        Begin with a shared commitment to growth
                      </p>
                    </div>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span className="text-sm text-foreground">Weekly scripture readings</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span className="text-sm text-foreground">Guided reflection prompts</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span className="text-sm text-foreground">Practical action steps</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span className="text-sm text-foreground">Discussion questions</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span className="text-sm text-foreground">Prayer partnerships</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 bg-primary/5">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Ready to begin?</h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-muted-foreground">
            Join thousands of believers who have deepened their faith through 
            intentional discipleship relationships.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/auth/signup">
                Create Your Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-primary">
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground text-sm sm:text-base">Stand Walk Run</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Grow together in faith. One step at a time.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
