-- Allow N8N to set draft status to 'executed' after posting to Slack/Jira.

ALTER TABLE drafts DROP CONSTRAINT IF EXISTS drafts_status_check;
ALTER TABLE drafts ADD CONSTRAINT drafts_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'executed'));
