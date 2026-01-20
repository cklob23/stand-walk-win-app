export type UserRole = 'leader' | 'learner'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole | null
  avatar_url: string | null
  bio: string | null
  phone: string | null
  onboarding_complete: boolean
  current_week: number
  created_at: string
  updated_at: string
}

export interface Pairing {
  id: string
  leader_id: string
  learner_id: string
  pairing_code: string
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  current_week: number
  covenant_signed_leader: boolean
  covenant_signed_learner: boolean
  started_at: string | null
  completed_at: string | null
  created_at: string
  leader?: Profile
  learner?: Profile
}

export interface WeeklyContent {
  id: string
  week_number: number
  title: string
  description: string
  scripture_reference: string | null
  video_url: string | null
  content_json: Record<string, unknown> | null
  created_at: string
}

export interface Assignment {
  id: string
  week_number: number
  title: string
  description: string
  assignment_type: 'reading' | 'reflection' | 'action' | 'discussion' | 'prayer'
  order_index: number
  created_at: string
  weekly_content?: WeeklyContent
}

export interface AssignmentProgress {
  id: string
  pairing_id: string
  assignment_id: string
  user_id: string
  status: 'not_started' | 'in_progress' | 'completed'
  response_text: string | null
  completed_at: string | null
  week_number: number
  created_at: string
  updated_at: string
  assignment?: Assignment
}

export interface Message {
  id: string
  pairing_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
  sender?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface Notification {
  id: string
  user_id: string
  pairing_id: string | null
  type: 'message' | 'assignment' | 'week_complete' | 'encouragement' | 'covenant' | 'pairing'
  title: string
  message: string
  read: boolean
  created_at: string
}

export interface Reflection {
  id: string
  pairing_id: string
  user_id: string
  week_number: number
  reflection_text: string
  is_shared: boolean
  created_at: string
  updated_at: string
  user?: Profile
}

export interface WeekProgress {
  week_number: number
  title: string
  total_assignments: number
  completed_assignments: number
  is_current: boolean
  is_unlocked: boolean
}

export interface DashboardData {
  profile: Profile
  pairing: Pairing | null
  partner: Profile | null
  currentWeekContent: WeeklyContent | null
  weekProgress: WeekProgress[]
  recentMessages: Message[]
  notifications: Notification[]
  assignments: AssignmentProgress[]
}
