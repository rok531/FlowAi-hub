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

2. Set up environment variables:
```bash
cp .env.local.example .env.local
# Fill in your actual values
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

See `.env.local.example`. Required:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
- `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`

Optional:

- `N8N_WEBHOOK_URL` – When a draft is approved, the app POSTs `{ draftId, action: 'approved', userId }` here so N8N can execute the action (e.g. post to Slack, create Jira ticket).

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

### 2. Drafts table (human-in-the-loop)

Run the migration in **Supabase → SQL Editor** (or use Supabase CLI):

```bash
# From project root, apply migration:
# Copy contents of supabase/migrations/001_create_drafts.sql into SQL Editor and Run.
```

Or create manually: see `supabase/migrations/001_create_drafts.sql`. Key columns:

- `user_id`, `source` (zoom | slack | email), `type` (task | message | email | ticket)
- `title`, `body`, `payload` (JSONB)
- `status`: `pending` | `approved` | `rejected`
- `resolved_at`, `resolved_by`

## N8N Integration (canonical flow)

1. **N8N writes drafts**  
   After processing Zoom/Slack (e.g. extract tasks), N8N inserts rows into Supabase `drafts` with `status = 'pending'` and `user_id` = the FlowAI Hub user who owns the connection. Use Supabase node with **service role** key so RLS doesn't block inserts.

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

### Slack
- [api.slack.com/apps](https://api.slack.com/apps) → Your App → OAuth & Permissions  
- Redirect URLs: `http://localhost:3000/api/slack-callback`, `https://your-domain.vercel.app/api/slack-callback`

### Zoom
- [marketplace.zoom.us/develop](https://marketplace.zoom.us/develop) → Your App → OAuth  
- Redirect URLs: `http://localhost:3000/api/zoom-callback`, `https://your-domain.vercel.app/api/zoom-callback`

## Deployment (Vercel)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. Add all env vars (including optional `N8N_WEBHOOK_URL`).
3. Deploy. Then add your production URL to Slack and Zoom redirect URL lists.

## Pricing (product)

- **Starter:** $29/team (up to 5 users, core integrations).
- **Growth:** $99/team (unlimited users, human-in-the-loop dashboard, sentiment alerts later).
- **Private beta:** Free access while we ramp.
