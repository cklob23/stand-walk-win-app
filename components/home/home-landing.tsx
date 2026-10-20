import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  BookHeart,
  BookOpen,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Footprints,
  Gift,
  Globe,
  HeartHandshake,
  KeyRound,
  MessageSquare,
  ScrollText,
  Send,
  Sparkles,
  Sprout,
  Ticket,
  Trophy,
  UserRoundCheck,
} from 'lucide-react'
import { AppLogoStatic } from '@/components/app-logo'
import { Button } from '@/components/ui/button'
import { AppScreenshot, BrowserScreenshot, PhoneScreenshot } from '@/components/home/app-screenshot'
import { HomeFaqAnswer } from '@/components/home/faq-answer'
import { HomeHeader } from '@/components/home/home-header'
import { homeFaqs } from '@/lib/home-content'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

const steps: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Ticket,
    title: 'A Leader chooses a plan',
    body: 'A Leader picks a plan, or a church buys plans for its leaders. The plan sets how many Learners each Leader can pair with. Learners never pay.',
  },
  {
    icon: Send,
    title: 'Invite someone to disciple',
    body: 'Most Leaders already have someone in mind. Share your 6-character pairing code, and that person joins free and is connected to you right away.',
  },
  {
    icon: ScrollText,
    title: 'Sign the covenant',
    body: 'You both agree to six simple commitments: growth, regular communication, confidentiality, prayer, accountability, and grace.',
  },
  {
    icon: Footprints,
    title: 'Walk the 6 weeks',
    body: 'Each week brings a focus scripture, short assignments, and at least one meeting together. Finish the week, meeting included, and the next one unlocks.',
  },
]

const roles: {
  icon: LucideIcon
  role: string
  tag: string
  who: string
  doItems: string[]
  getItems: string[]
}[] = [
  {
    icon: UserRoundCheck,
    role: 'Leader',
    tag: 'The mentor',
    who: 'A believer who wants to disciple someone they already know: a friend, family member, coworker, or someone from church.',
    doItems: [
      'Invite the person you want to disciple with your pairing code',
      "Set the times you're free and meet at least once a week",
      'Read their responses and reply with encouragement',
      'Pray, message, and share verses through the week',
    ],
    getItems: [
      "A dashboard showing each Learner's week and progress",
      'The full 6-week journey, ready to go',
      "As many Learners as your plan allows, on your plan or your church's",
    ],
  },
  {
    icon: Sprout,
    role: 'Learner',
    tag: 'The one being discipled',
    who: 'Someone a Leader has invited to walk the journey with them, whether new to faith or wanting a strong foundation.',
    doItems: [
      "Join free with your Leader's pairing code",
      "Read the week's scripture and finish short assignments",
      'Meet with your Leader at least once a week',
      'Journal your prayers each day',
    ],
    getItems: [
      "It's free. Your Leader's plan covers you",
      'A Bible with Listen, highlights, and notes',
      'A celebration at the end, and the chance to lead someone else',
    ],
  },
]

const features: {
  icon: LucideIcon
  kicker: string
  title: string
  body: ReactNode
  bullets: string[]
  lightSrc: string
  darkSrc: string
  mobileSrc: string
  alt: string
}[] = [
  {
    icon: BookOpen,
    kicker: 'Bible reader',
    title: 'A Bible that reads to you',
    body: (
      <>
        Read in ESV, NLT, KJV, NKJV, NASB, CSB, and more. Tap <strong>Listen</strong> to hear the
        chapter read aloud. Highlight in five colors, add notes, send a verse to your partner, or
        save it to your journal. Each week&apos;s scripture is already marked for you.
      </>
    ),
    bullets: [
      'Listen to any chapter',
      'Highlights, notes, and Explain for extra background',
      '9 translations, adjustable text size',
    ],
    lightSrc: '/home/bible-light.webp',
    darkSrc: '/home/bible-dark.webp',
    mobileSrc: '/home/bible-mobile.webp',
    alt: 'Bible reader open to a highlighted chapter with the Listen control, as Sarah would see it',
  },
  {
    icon: BookHeart,
    kicker: 'Prayer journal',
    title: 'A daily journal that stays yours',
    body: (
      <>
        Each day, write three things you&apos;re praying about and what you&apos;re learning. Add
        photos, voice notes, or files. Entries stay private unless you choose to share one with your
        partner, and verses they send you land in <strong>Shared With Me</strong>.
      </>
    ),
    bullets: [
      'Two simple daily prompts',
      'Share only what you choose',
      'Look back on how God has moved',
    ],
    lightSrc: '/home/journal-light.webp',
    darkSrc: '/home/journal-dark.webp',
    mobileSrc: '/home/journal-mobile.webp',
    alt: 'Daily prayer journal with prompts and a verse shared by Leader David Carter',
  },
  {
    icon: MessageSquare,
    kicker: 'Messages',
    title: 'Stay close between meetings',
    body: 'Message your Leader or Learner in real time. React with a heart or praying hands, reply to a specific message, and share photos or files. Every conversation lives with your journey, not in a crowded group text.',
    bullets: [
      'Real-time chat with reactions',
      'Photos and files',
      'Notifications so nothing gets missed',
    ],
    lightSrc: '/home/messages-light.webp',
    darkSrc: '/home/messages-dark.webp',
    mobileSrc: '/home/messages-mobile.webp',
    alt: 'In-app messages between Learner Sarah and Leader David Carter',
  },
  {
    icon: Calendar,
    kicker: 'Schedule',
    title: 'Meet without the back-and-forth',
    body: 'Every week includes at least one meeting between the Leader and Learner. Leaders set the times they are free, and Learners pick a one-hour slot for FaceTime, Zoom, a phone call, or meeting in person, then add it to their calendar. Need a different time? Suggest a new one in the app.',
    bullets: [
      'At least one meeting every week',
      'FaceTime, Zoom, phone, or in person',
      'Add to Calendar in one tap',
    ],
    lightSrc: '/home/schedule-light.webp',
    darkSrc: '/home/schedule-dark.webp',
    mobileSrc: '/home/schedule-mobile.webp',
    alt: 'Weekly schedule showing available meeting times for Sarah and David Carter',
  },
  {
    icon: Trophy,
    kicker: 'Progress and graduation',
    title: "See how far you've come",
    body: 'Track every week and assignment as you go. When the Learner finishes all six weeks, you celebrate together, and the Learner can step up to become a Leader for someone else.',
    bullets: [
      'Week-by-week progress',
      'A celebration at the finish line',
      'Graduate to Leader and keep it going',
    ],
    lightSrc: '/home/progress-light.webp',
    darkSrc: '/home/progress-dark.webp',
    mobileSrc: '/home/graduation-mobile.webp',
    alt: 'Journey progress across six weeks, and graduation options after Sarah finishes',
  },
]

const weeks = [
  {
    title: 'The New Birth',
    verse: 'John 3:3-7',
    line: 'What it means to be born again, and why baptism matters.',
  },
  {
    title: 'The New Life',
    verse: '2 Corinthians 5:17',
    line: 'Building daily habits of prayer and Bible reading.',
  },
  {
    title: 'The New Stand',
    verse: 'Ephesians 6:13',
    line: 'Standing firm and turning away from old patterns.',
  },
  {
    title: 'The New Walk',
    verse: 'Colossians 2:6-7',
    line: 'Walking consistently with other believers.',
  },
  {
    title: 'The New Win',
    verse: '1 John 5:4',
    line: 'Overcoming temptation in the battle of spirit and flesh.',
  },
  {
    title: 'The New Work',
    verse: '1 Peter 3:15',
    line: 'Praying for friends and sharing the hope you have.',
  },
] as const

export function HomeLanding() {
  return (
    <div className="min-h-screen bg-background">
      <HomeHeader />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:pt-20 lg:pb-24 lg:pt-24">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="text-center lg:col-span-5 lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                One Leader. One Learner. Six weeks.
              </span>
              <h1 className="mt-5 text-balance text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                A <span className="text-primary">6-week</span> guided discipleship journey for a
                Leader and a Learner
              </h1>
              <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
                A Leader invites someone they want to disciple, and Stand Walk Run guides you both,
                week by week. Scripture and assignments, weekly meetings, a prayer journal, a Bible
                you can listen to, and messages all live in one simple app.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Button asChild size="lg" className="h-11 w-full px-7 sm:w-auto">
                  <Link href="/auth/signup">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-11 w-full bg-transparent px-7 sm:w-auto"
                >
                  <a href="#how">See how it works</a>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground lg:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <Gift className="h-4 w-4 text-primary" />
                  Learners join free
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  Meet every week
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-primary" />
                  Works in any browser
                </span>
              </div>
            </div>
            <div className="lg:col-span-7">
              <div className="relative hidden sm:block">
                <BrowserScreenshot
                  lightSrc="/home/dashboard-light.webp"
                  darkSrc="/home/dashboard-dark.webp"
                  alt="Learner dashboard for Sarah showing Week 3, The New Stand, with Leader David Carter"
                  priority
                />
                <div className="absolute -bottom-6 -left-6 hidden items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg lg:flex">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <HeartHandshake className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Your Leader walks with you</p>
                    <p className="text-xs text-muted-foreground">Real person, real conversations</p>
                  </div>
                </div>
              </div>
              <div className="sm:hidden">
                <PhoneScreenshot
                  src="/home/dashboard-mobile.webp"
                  alt="Learner dashboard for Sarah showing Week 3, The New Stand, with Leader David Carter"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-20 bg-muted/30 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-primary">How it works</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
              Four steps from sign-up to week one
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              It only takes a few minutes to get started together.
            </p>
          </div>
          <ol className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="relative rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="roles" className="scroll-mt-20 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-primary">Two roles, one journey</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
              Are you leading or learning?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Every journey has a Leader and a Learner. Here is what each one does.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:mt-14 md:grid-cols-2">
            {roles.map((role) => (
              <div key={role.role} className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <role.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{role.role}</h3>
                    <p className="text-sm text-muted-foreground">{role.tag}</p>
                  </div>
                </div>
                <div className="mt-6 space-y-5 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Who it&apos;s for
                    </p>
                    <p className="mt-1.5 text-foreground">{role.who}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      What you do
                    </p>
                    <ul className="mt-2 space-y-2 text-foreground">
                      {role.doItems.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      What you get
                    </p>
                    <ul className="mt-2 space-y-2 text-foreground">
                      {role.getItems.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-20 bg-muted/30 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-primary">Inside the app</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
              Everything for the journey, in one place
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              These are real screens from Stand Walk Run.
            </p>
          </div>
          <div className="mt-12 space-y-16 sm:mt-16 sm:space-y-24">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={cn(
                  'flex flex-col items-center gap-8 lg:gap-14',
                  index % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row',
                )}
              >
                <div className="w-full lg:w-[42%]">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <feature.icon className="h-3.5 w-3.5" />
                    {feature.kicker}
                  </div>
                  <h3 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                  <ul className="mt-5 space-y-2 text-sm text-foreground">
                    {feature.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="w-full lg:w-[58%]">
                  <AppScreenshot
                    lightSrc={feature.lightSrc}
                    darkSrc={feature.darkSrc}
                    mobileSrc={feature.mobileSrc}
                    alt={feature.alt}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="journey" className="scroll-mt-20 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-primary">The first journey</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
              New Believer Foundations
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              From new birth to new work. Each week builds on the last, with a focus scripture,
              short assignments to read, reflect, pray, and act, and at least one meeting with your
              Leader.
            </p>
          </div>
          <div className="relative mt-12 sm:mt-16">
            <div className="absolute bottom-8 left-[21px] top-2 w-px bg-border lg:bottom-auto lg:left-[8%] lg:right-[8%] lg:top-[22px] lg:h-px lg:w-auto" />
            <ol className="relative grid gap-0 lg:grid-cols-6 lg:gap-6">
              {weeks.map((week, index) => (
                <li key={week.title} className="relative flex gap-4 lg:block lg:text-center">
                  <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground lg:mx-auto">
                    {index + 1}
                  </div>
                  <div className="pb-6 lg:mt-4 lg:pb-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Week {index + 1}
                    </p>
                    <h3 className="font-semibold text-foreground">{week.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{week.line}</p>
                    <p className="mt-2 font-serif text-xs italic text-primary">{week.verse}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="mx-auto mt-10 grid max-w-3xl gap-3 sm:mt-14 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-foreground">
              <CalendarCheck className="h-5 w-5 shrink-0 text-primary" />
              Every week includes at least one meeting with your Leader.
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-foreground">
              <Sparkles className="h-5 w-5 shrink-0 text-primary" />
              More journeys for other groups are on the way.
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-20 bg-muted/30 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4">
          <div className="text-center">
            <p className="text-sm font-semibold text-primary">FAQ</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
              Questions people ask
            </h2>
          </div>
          <div className="mt-10 space-y-3">
            {homeFaqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border bg-card px-5 py-4"
                open={faq.open}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground">
                  {faq.question}
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  <HomeFaqAnswer faq={faq} />
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary/5 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            Ready to take the first step?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:mt-4 sm:text-base">
            Whether you&apos;re ready to lead or ready to learn, your 6-week journey can start this
            week.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 w-full px-7 sm:w-auto">
              <Link href="/auth/signup">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 w-full bg-transparent px-7 sm:w-auto"
            >
              <Link href="/auth/signup?pairing=1">
                <KeyRound className="h-4 w-4" />
                I have a pairing code
              </Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            <Link href="/pricing" className="font-medium text-primary underline underline-offset-2">
              Plans for individual leaders and churches
            </Link>
          </p>
        </div>
      </section>

      <footer className="border-t bg-card py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <AppLogoStatic iconClassName="h-7 w-7 sm:h-8 sm:w-8" />
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-6">
              <p className="text-center text-xs text-muted-foreground sm:text-sm">
                Grow together in faith. One step at a time.
              </p>
              <nav className="flex items-center gap-4 text-xs sm:text-sm">
                <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
                  Plans
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
