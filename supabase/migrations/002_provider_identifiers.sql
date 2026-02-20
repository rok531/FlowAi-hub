-- Maps external provider IDs (Zoom host_id, Slack user id) to Supabase auth user_id.
-- FlowAI Hub callbacks populate this when users connect Zoom/Slack; N8N uses it to
-- resolve user_id before inserting drafts so drafts show under the right user.

CREATE TABLE IF NOT EXISTS provider_identifiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('zoom', 'slack')),
  external_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(provider, external_id)
);

CREATE INDEX idx_provider_identifiers_lookup ON provider_identifiers(provider, external_id);

ALTER TABLE provider_identifiers ENABLE ROW LEVEL SECURITY;

-- Users can read their own mappings (optional; N8N uses service role to read)
CREATE POLICY "Users can view own provider identifiers"
  ON provider_identifiers FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts/updates from callbacks use Supabase service role (bypasses RLS).
-- No extra policy needed for service role.

COMMENT ON TABLE provider_identifiers IS 'Maps Zoom host_id and Slack user id to Supabase user_id for N8N draft assignment.';
