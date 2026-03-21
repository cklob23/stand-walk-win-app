export type UserRole = 'leader' | 'learner'

export type AdminRole = 'master_admin' | 'org_admin'

export interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  max_users: number
  subscription_tier_id: string | null
  subscription_tier?: SubscriptionTier
  is_active: boolean
  owner_id: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: 'admin' | 'member'
  added_by: string | null
  created_at: string
  organization?: Organization
  user?: Profile
  added_by_profile?: Profile
}

export interface SubscriptionTier {
  id: string
  name: string
  display_name: string
  max_learners: number
  price_monthly: number
  features: {
    can_graduate_to_leader?: boolean
    additional_journeys?: boolean
    priority_support?: boolean
    description?: string
  }
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Journey {
  id: string
  name: string
  slug: string
  description: string | null
  total_weeks: number
  is_default: boolean
  price: number
  is_available: boolean
  created_at: string
  updated_at: string
}

export interface UserJourney {
  id: string
  user_id: string
  journey_id: string
  pairing_id: string | null
  status: 'active' | 'completed' | 'paused'
  started_at: string
  completed_at: string | null
  completion_percentage: number
  created_at: string
  updated_at: string
  journey?: Journey
}

export interface UserJourneyPurchase {
  id: string
  user_id: string
  journey_id: string
  purchased_at: string
  payment_reference: string | null
  payment_amount: number | null
  granted_by: string | null
  notes: string | null
  created_at: string
  journey?: Journey
}

export interface SubscriptionChange {
  id: string
  user_id: string
  old_tier_id: string | null
  new_tier_id: string | null
  changed_by: string | null
  reason: string | null
  payment_reference: string | null
  created_at: string
  old_tier?: SubscriptionTier
  new_tier?: SubscriptionTier
  changed_by_profile?: Profile
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole | null
  avatar_url: string | null
  bio: string | null
  phone: string | null
  zoom_link: string | null
  onboarding_complete: boolean
  in_app_notifications?: boolean
  email_notifications?: boolean
  message_notifications?: boolean
  progress_notifications?: boolean
  bible_translation_preference?: string | null
  bible_text_size?: string | null
  bible_last_book?: string | null
  bible_last_chapter?: number | null
  bible_skip_verse_numbers?: boolean | null
  bible_voice_uri?: string | null
  // Subscription & graduation fields
  subscription_tier_id?: string | null
  subscription_tier?: SubscriptionTier
  is_admin?: boolean
  admin_role?: AdminRole | null
  organization_id?: string | null
  organization?: Organization
  graduated_at?: string | null
  can_be_leader?: boolean
  created_at: string
  updated_at: string
}

export interface Pairing {
  id: string
  leader_id: string
  learner_id: string | null
  invite_code: string
  pairing_code?: string  // Alias for invite_code for backwards compatibility
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  current_week: number
  covenant_accepted_leader: boolean
  covenant_accepted_learner: boolean
  // Aliases for backwards compatibility
  covenant_signed_leader?: boolean
  covenant_signed_learner?: boolean
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at?: string
  journey_id?: string | null
  leader?: Profile
  learner?: Profile
  journey?: Journey
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
  assignment_type: 'reading' | 'reflection' | 'action' | 'discussion' | 'prayer' | 'meeting'
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
  notes: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  assignment?: Assignment
}

export interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: 'thumbsup' | 'heart' | 'pray' | 'laugh' | 'sad' | 'exclamation'
  created_at: string
}

export interface Message {
  id: string
  pairing_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
  reply_to_id?: string | null
  edited_at?: string | null
  attachment_url?: string | null
  attachment_type?: 'image' | 'file' | 'link' | null
  sender?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
  reply_to?: {
    id: string
    content: string
    sender_id: string
    sender?: { full_name: string | null } | null
  } | null
  reactions?: MessageReaction[]
}

export interface Notification {
  id: string
  user_id: string
  pairing_id: string | null
  type: 'message' | 'assignment' | 'assignment_reply' | 'assignment_reaction' | 'week_complete' | 'encouragement' | 'covenant' | 'pairing' | 'journal_shared' | 'meeting_request' | 'meeting_accepted' | 'meeting_declined' | 'meeting_counter_proposed' | 'meeting_completed'
  title: string
  message: string
  read: boolean
  created_at: string
  metadata?: {
    assignmentId?: string
    weekNumber?: number
    [key: string]: string | number | boolean | null | undefined
  } | null
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

export interface AvailabilitySlot {
  id: string
  user_id: string
  pairing_id: string
  day_of_week: number // 0=Sunday ... 6=Saturday
  start_time: string  // "HH:MM" format
  end_time: string    // "HH:MM" format
  created_at: string
}

export interface ScheduledMeeting {
  id: string
  pairing_id: string
  scheduled_by: string
  proposed_by: string | null
  original_meeting_id: string | null
  meeting_date: string // "YYYY-MM-DD"
  start_time: string
  end_time: string
  meeting_type: 'facetime' | 'zoom' | 'phone' | 'in_person'
  meeting_link: string | null
  notes: string | null
  status: 'scheduled' | 'completed' | 'cancelled' | 'pending_approval' | 'declined' | 'counter_proposed'
  decline_reason: string | null
  response_note: string | null
  created_at: string
  updated_at: string
  scheduled_by_profile?: Profile
  proposer?: Profile
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
