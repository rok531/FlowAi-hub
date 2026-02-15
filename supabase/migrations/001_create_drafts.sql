-- Drafts table: human-in-the-loop approvals (N8N writes here, FlowAI Hub approves)
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) or via Supabase CLI

CREATE TABLE IF NOT EXISTS drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('zoom', 'slack', 'email')),
  type TEXT NOT NULL CHECK (type IN ('task', 'message', 'email', 'ticket')),
  title TEXT,
  body TEXT,
  payload JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_drafts_user_id ON drafts(user_id);
CREATE INDEX idx_drafts_status ON drafts(status);
CREATE INDEX idx_drafts_created_at ON drafts(created_at DESC);

-- RLS: users see only their own drafts
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drafts"
  ON drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own pending drafts (approve/reject)"
  ON drafts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- N8N or backend can insert drafts (service role or authenticated insert)
CREATE POLICY "Users can insert drafts for themselves"
  ON drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Optional: allow service role to insert (for N8N using service key)
-- CREATE POLICY "Service role can insert drafts" ON drafts FOR INSERT WITH CHECK (true);

COMMENT ON TABLE drafts IS 'Human-in-the-loop: AI creates drafts here; user approves or rejects in FlowAI Hub. N8N can write new rows and react to status changes.';
