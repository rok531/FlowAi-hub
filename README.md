# FlowAI Hub

Turn Zoom conversations into actionable Slack tasks with FlowAI Hub.

## Tech Stack

- **Next.js 14** (App Router)
- **Supabase** (Authentication & Database)
- **Tailwind CSS** (Styling)
- **Slack OAuth** (Integration)
- **Zoom OAuth** (Integration)

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

Required environment variables (see `.env.local.example`):

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SLACK_CLIENT_ID` - Slack OAuth client ID
- `SLACK_CLIENT_SECRET` - Slack OAuth client secret
- `ZOOM_CLIENT_ID` - Zoom OAuth client ID
- `ZOOM_CLIENT_SECRET` - Zoom OAuth client secret

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Add all environment variables in Vercel dashboard
4. Deploy!

## Database Setup

Create a `connections` table in Supabase:

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

## OAuth Setup

### Slack
1. Create app at https://api.slack.com/apps
2. Add redirect URLs:
   - `http://localhost:3000/api/slack-callback` (dev)
   - `https://your-domain.vercel.app/api/slack-callback` (production)

### Zoom
1. Create app at https://marketplace.zoom.us/develop
2. Add redirect URLs:
   - `http://localhost:3000/api/zoom-callback` (dev)
   - `https://your-domain.vercel.app/api/zoom-callback` (production)
