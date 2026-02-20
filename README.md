# FlowAI Hub

**The AI that waits for your permission.** Turn meeting decisions into actions—with one click to approve. No bot in the call. No AI sending emails or tasks until you say so.

## Positioning

- **Human-in-the-loop:** AI drafts tasks/messages; you approve or reject in the Hub (and soon in Slack).
- **Workflow reliability:** Built for teams who don't want AI to act without permission.
- **Team pricing:** Flat price per team (Starter $29, Growth $99), not per seat.

## Tech Stack

- **Next.js 14** (App Router)
- **Supabase** (Auth, `connections`, `drafts`)
- **Tailwind CSS**
- **Slack & Zoom OAuth**
- **N8N** (optional): writes drafts to Supabase; runs workflows when drafts are approved

## Getting Started

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` in the project root and add your keys (see **Environment Variables** below).

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Put these in `.env.local` (local) and in Vercel → Settings → Environment Variables (production).

**Required:**

- `NEXT_PUBLIC_SUPABASE_URL` – Supabase project URL (Project Settings → API)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – Supabase anon key (Project Settings → API)
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` – from [api.slack.com/apps](https://api.slack.com/apps)
- `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` – from [marketplace.zoom.us/develop](https://marketplace.zoom.us/develop)

**Recommended for OAuth callbacks (so Slack/Zoom “Connected” status works):**

- `SUPABASE_SERVICE_ROLE_KEY` – Supabase service_role key (Project Settings → API); used in callbacks to save connections when RLS is on.

**Optional:**

- `N8N_WEBHOOK_URL` – When a draft is approved, the app POSTs `{ draftId, action: 'approved', userId }` here. Use your N8N webhook URL (e.g. `https://your-n8n.com/webhook/draft-approval`). See `docs/N8N_SETUP.md`.

## Database Setup

### 1. Connections table (Slack/Zoom tokens)

```sql
CREATE TABLE connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('slack', 'zoom')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  team_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_connections_user_id ON connections(user_id);
CREATE INDEX idx_connections_provider ON connections(provider);
```

**So the dashboard can show "Connected", allow logged-in users to read their own rows:**

```sql
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own connections"
  ON connections FOR SELECT
  USING (auth.uid() = user_id);
```

(Inserts are done from the OAuth callback using the service role key, which bypasses RLS.)

### 2. Drafts table (human-in-the-loop)

Run the migrations in **Supabase → SQL Editor** in order:

1. `supabase/migrations/001_create_drafts.sql` – drafts table  
2. `supabase/migrations/002_provider_identifiers.sql` – maps Zoom host_id / Slack user id → Supabase user_id (used by N8N to assign drafts)  
3. `supabase/migrations/003_drafts_status_executed.sql` – allows N8N to set status to `executed` after posting to Slack/Jira  

Or create manually: see those files. Key columns for `drafts`:

- `user_id`, `source` (zoom | slack | email), `type` (task | message | email | ticket)
- `title`, `body`, `payload` (JSONB)
- `status`: `pending` | `approved` | `rejected`
- `resolved_at`, `resolved_by`

## N8N Integration (canonical flow)

1. **N8N writes drafts**  
   After processing Zoom/Slack (e.g. Zoom meeting end, Slack message), N8N must **look up** the Supabase `user_id` from the `provider_identifiers` table (by Zoom `host_id` or Slack `user` id). FlowAI Hub fills that table when users click Connect Zoom / Connect Slack. Then N8N inserts into `drafts` with that `user_id`, `status = 'pending'`. Use Supabase node with **service role** key.

2. **User approves in FlowAI Hub**  
   Dashboard shows "Pending approvals". User clicks **Approve** or **Reject**.

3. **App calls N8N on approve**  
   If `N8N_WEBHOOK_URL` is set, the app POSTs to it when a draft is approved. N8N workflow can:
   - Read the draft from Supabase (by `draftId`),
   - Post to Slack / create Jira ticket / send email,
   - Optionally update the draft or another table.

4. **Optional: Slack approval**  
   Later you can add Slack interactivity (buttons "Approve" / "Reject") that call the same FlowAI Hub API so users approve without leaving Slack.

## OAuth Setup

Use the **exact** redirect URLs below (no trailing slash). Replace the domain with your real app URL if different.

### Slack
1. [api.slack.com/apps](https://api.slack.com/apps) → Your App → **OAuth & Permissions**
2. Under **Redirect URLs**, add:
   - Production: `https://flowai-hub.vercel.app/api/slack-callback`
   - Local: `http://localhost:3000/api/slack-callback`
3. **Save URLs**

### Zoom (fixes "Invalid redirect url" / error 4700)
1. [marketplace.zoom.us/develop](https://marketplace.zoom.us/develop) → Your App
2. Open **OAuth** (or **App Credentials** → Redirect URL)
3. Add **exactly** (copy-paste):
   - Production: `https://flowai-hub.vercel.app/api/zoom-callback`
   - Local: `http://localhost:3000/api/zoom-callback`
4. Save. Zoom is strict: the URL must match character-for-character.

## Deployment (Vercel)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. Add all env vars (including optional `N8N_WEBHOOK_URL`).
3. Deploy. Then add your production URL to Slack and Zoom redirect URL lists.

## Pricing (product)

- **Starter:** $29/team (up to 5 users, core integrations).
- **Growth:** $99/team (unlimited users, human-in-the-loop dashboard, sentiment alerts later).
- **Private beta:** Free access while we ramp.
