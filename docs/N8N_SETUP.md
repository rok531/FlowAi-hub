# N8N setup for FlowAI Hub

This guide explains **Step 2: In N8N**—how to wire N8N so it creates drafts in Supabase and (optionally) runs a workflow when a user approves a draft in FlowAI Hub.

---

## Overview

- **Workflow A – “Create draft”:** When something happens (e.g. Zoom meeting ends, new Slack message), N8N creates a row in the `drafts` table. The user then sees it in FlowAI Hub under “Pending approvals” and can Approve or Reject.
- **Workflow B – “Execute approved”:** When a user clicks **Approve** in FlowAI Hub, the app can POST to an N8N webhook. N8N then runs your “execute” logic (e.g. post to Slack, create Jira ticket).

You can start with Workflow A only; add Workflow B when you want approvals to trigger actions.

---

## Prerequisites

1. **Supabase**
   - `drafts` table created (run `supabase/migrations/001_create_drafts.sql` in SQL Editor).
   - **Service role key** (not the anon key): Supabase Dashboard → Project Settings → API → `service_role` (secret). N8N needs this to insert into `drafts` (RLS is bypassed for the service role).

2. **User ID**
   - You need a `user_id` (UUID from `auth.users`) to assign the draft to. For testing you can copy one user’s ID from Supabase → Authentication → Users. Later you can resolve it from Slack/Zoom context (e.g. from your `connections` table by `team_id` or email).

---

## Workflow A: Create a draft (insert into Supabase)

Goal: when a trigger fires (schedule, webhook, Zoom, Slack, etc.), N8N inserts one row into `drafts` so it shows in FlowAI Hub as “Pending approval”.

### 1. Add a trigger

- Examples:
  - **Schedule** – e.g. “Every hour” to poll for new meetings.
  - **Webhook** – another system calls N8N when a meeting ends.
  - **Slack** – new message in a channel.
  - **Zoom** – “Meeting ended” (if your Zoom app supports it).

Use whatever fits your current N8N workflow.

### 2. Process the trigger data (optional)

- Use N8N nodes to get:
  - **Title** – e.g. “Tasks from Zoom: Weekly Sync”
  - **Body** – short description or list of proposed actions.
  - **Source** – `zoom` or `slack`.
  - **Type** – `task`, `message`, or `email`.
  - **user_id** – the FlowAI Hub user who should see this draft (UUID from `auth.users`).

If you don’t have `user_id` yet, use a fixed UUID for testing (one of your Supabase auth users).

### 3. Insert into Supabase `drafts`

**Option A – Supabase node (if available in your N8N)**

1. Add a **Supabase** node.
2. **Credentials:** create a new credential:
   - **Host:** from Supabase (Settings → Database). Often `db.<project-ref>.supabase.co`.
   - **Service Role Key:** paste the **service_role** key (Project Settings → API).
   - Or use the **Supabase API** credential with URL `https://<project-ref>.supabase.co` and the **service_role** key if the node expects that.
3. **Operation:** Insert.
4. **Table:** `drafts`.
5. **Columns / JSON body:** map:
   - `user_id` → your resolved or test user UUID.
   - `source` → `zoom` or `slack`.
   - `type` → `task` (or `message` / `email`).
   - `title` → string from previous node.
   - `body` → string from previous node (optional).
   - `status` → `pending` (or omit; default is `pending`).
   - `payload` → optional JSON, e.g. `{ "channel": "#general", "meeting_id": "..." }`.

**Option B – HTTP Request node (works everywhere)**

1. Add **HTTP Request**.
2. **Method:** POST.
3. **URL:** `https://<your-project-ref>.supabase.co/rest/v1/drafts`
4. **Headers:**
   - `apikey`: your Supabase **service_role** key.
   - `Authorization`: `Bearer <same service_role key>`.
   - `Content-Type`: `application/json`.
   - `Prefer`: `return=representation` (optional; returns the created row).
5. **Body (JSON):**
   ```json
   {
     "user_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
     "source": "zoom",
     "type": "task",
     "title": "Tasks from Zoom: Weekly Sync",
     "body": "1. Update roadmap by Friday\n2. Send proposal to client",
     "status": "pending",
     "payload": {}
   }
   ```
   Replace `user_id` with a real UUID from Supabase → Authentication → Users.

After you run this workflow, open FlowAI Hub, sign in as that user, and you should see the draft under “Pending approvals”.

---

## Workflow B: Execute when a draft is approved (webhook)

Goal: when a user clicks **Approve** in FlowAI Hub, the app POSTs to N8N; N8N then performs the action (e.g. post to Slack).

### 1. Create a webhook trigger in N8N

1. Add a **Webhook** node at the start of a new workflow (or an existing one).
2. **HTTP Method:** POST.
3. **Path:** e.g. `draft-approved` (or leave default).
4. Save the workflow and copy the **Production Webhook URL** (e.g. `https://your-n8n.com/webhook/draft-approved`).

### 2. Set the URL in FlowAI Hub

- In `.env.local` (and in Vercel env vars):  
  `N8N_WEBHOOK_URL=https://your-n8n.com/webhook/draft-approved`
- When a user approves a draft, the app sends:
  ```json
  {
    "draftId": "uuid-of-the-draft",
    "action": "approved",
    "userId": "uuid-of-the-user"
  }
  ```

### 3. In N8N: use the webhook payload

- The next node receives the body above.
- **Get the draft from Supabase** (optional but useful):
  - **HTTP Request** GET `https://<project-ref>.supabase.co/rest/v1/drafts?id=eq.{{ $json.draftId }}` with the same `apikey` and `Authorization` headers (service role).
  - Or use a Supabase node “Get” by id.
- Then run your logic:
  - **Slack** – post the draft’s `title`/`body` to a channel (e.g. from `payload.channel` or a default).
  - **Jira / Asana** – create a task from `title` and `body`.
  - **Email** – send the body.

You can branch on `action === 'approved'` if you later send both approves and rejects to the same webhook; for now the app only calls on approve.

---

## End-to-end example (text)

1. **Zoom meeting ends** (or a cron runs).
2. N8N gets meeting summary (e.g. from Zoom API or transcript).
3. N8N extracts “tasks” (manually or with an AI node).
4. For each task (or once per meeting), N8N **inserts a row into `drafts`** with `user_id`, `source: 'zoom'`, `type: 'task'`, `title`, `body`, `status: 'pending'`.
5. User opens FlowAI Hub and sees the draft under “Pending approvals”.
6. User clicks **Approve**.
7. FlowAI Hub updates the row to `status: 'approved'` and POSTs to **N8N_WEBHOOK_URL** with `draftId`, `action`, `userId`.
8. N8N webhook workflow loads the draft from Supabase (by `draftId`), then posts to Slack (or creates a ticket, etc.).

---

## Resolving `user_id` in real use

- **Single user / testing:** Use one fixed UUID from Supabase Auth.
- **Per Slack workspace:** Store in your app which `user_id` is linked to which Slack `team_id` (you have this in `connections`). When N8N sees an event from Slack, get `team_id`, look up `user_id` in `connections`, then insert the draft with that `user_id`.
- **Per Zoom account:** Same idea with Zoom user/account id and your `connections` table.

If you tell me your trigger (e.g. “Slack message in #standup” or “Zoom meeting ended webhook”), I can outline the exact N8N nodes and field mappings for that case.
