-- Stand, Walk, Win - Discipleship App Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('leader', 'learner')) DEFAULT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pairings table (Leader-Learner relationships)
CREATE TABLE pairings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  learner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'active', 'completed')) DEFAULT 'pending',
  covenant_accepted_leader BOOLEAN DEFAULT FALSE,
  covenant_accepted_learner BOOLEAN DEFAULT FALSE,
  current_week INTEGER DEFAULT 1 CHECK (current_week >= 1 AND current_week <= 6),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly content/curriculum
CREATE TABLE weekly_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 6),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  scripture_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignments table
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 6),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  assignment_type TEXT CHECK (assignment_type IN ('reading', 'reflection', 'prayer', 'action')) DEFAULT 'reading',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignment progress tracking
CREATE TABLE assignment_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pairing_id UUID NOT NULL REFERENCES pairings(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pairing_id, assignment_id, user_id)
);

-- Messages table for direct communication
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pairing_id UUID NOT NULL REFERENCES pairings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pairing_id UUID REFERENCES pairings(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('message', 'assignment', 'week_complete', 'encouragement', 'covenant', 'pairing')) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly reflections/journal entries
CREATE TABLE reflections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pairing_id UUID NOT NULL REFERENCES pairings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 6),
  content TEXT NOT NULL,
  shared_with_partner BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view partner profiles" ON profiles
  FOR SELECT USING (
    id IN (
      SELECT leader_id FROM pairings WHERE learner_id = auth.uid()
      UNION
      SELECT learner_id FROM pairings WHERE leader_id = auth.uid()
    )
  );

-- Pairings policies
CREATE POLICY "Leaders can create pairings" ON pairings
  FOR INSERT WITH CHECK (auth.uid() = leader_id);

CREATE POLICY "Users can view their pairings" ON pairings
  FOR SELECT USING (auth.uid() = leader_id OR auth.uid() = learner_id);

CREATE POLICY "Users can update their pairings" ON pairings
  FOR UPDATE USING (auth.uid() = leader_id OR auth.uid() = learner_id);

-- Anyone can view pairings by invite code for joining
CREATE POLICY "Anyone can view pairing by invite code" ON pairings
  FOR SELECT USING (true);

-- Weekly content policies (public read)
CREATE POLICY "Anyone can view weekly content" ON weekly_content
  FOR SELECT USING (true);

-- Assignments policies (public read)
CREATE POLICY "Anyone can view assignments" ON assignments
  FOR SELECT USING (true);

-- Assignment progress policies
CREATE POLICY "Users can view their assignment progress" ON assignment_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view partner progress" ON assignment_progress
  FOR SELECT USING (
    pairing_id IN (
      SELECT id FROM pairings WHERE leader_id = auth.uid() OR learner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their assignment progress" ON assignment_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their assignment progress" ON assignment_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view messages in their pairings" ON messages
  FOR SELECT USING (
    pairing_id IN (
      SELECT id FROM pairings WHERE leader_id = auth.uid() OR learner_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in their pairings" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    pairing_id IN (
      SELECT id FROM pairings WHERE leader_id = auth.uid() OR learner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update read status" ON messages
  FOR UPDATE USING (
    pairing_id IN (
      SELECT id FROM pairings WHERE leader_id = auth.uid() OR learner_id = auth.uid()
    )
  );

-- Notifications policies
CREATE POLICY "Users can view their notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Reflections policies
CREATE POLICY "Users can view their reflections" ON reflections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared partner reflections" ON reflections
  FOR SELECT USING (
    shared_with_partner = true AND
    pairing_id IN (
      SELECT id FROM pairings WHERE leader_id = auth.uid() OR learner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their reflections" ON reflections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their reflections" ON reflections
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pairings_updated_at BEFORE UPDATE ON pairings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignment_progress_updated_at BEFORE UPDATE ON assignment_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reflections_updated_at BEFORE UPDATE ON reflections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
