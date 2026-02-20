# N8N setup for FlowAI Hub

This guide explains **Step 2: In N8N**—how to wire N8N so it creates drafts in Supabase and runs a workflow when a user approves a draft in FlowAI Hub (Zoom → approve in Hub → create task in Slack).

---

## Overview

- **Workflow A – “Create draft”:** When something happens (e.g. Zoom meeting ends, new Slack message), N8N looks up the Supabase `user_id` from the `provider_identifiers` table (using Zoom host_id or Slack user id), then inserts a row in `drafts`. The user sees it in FlowAI Hub under “Pending approvals” and can Approve or Reject.
- **Workflow B – “Execute approved”:** When a user clicks **Approve** in FlowAI Hub, the app updates the draft to `approved` and POSTs to your N8N webhook. N8N loads the draft, posts to Slack (or Jira, etc.), then updates the draft status to `executed`.

---

## Prerequisites

1. **Supabase**
   - Run migrations in order: `001_create_drafts.sql`, `002_provider_identifiers.sql`, `003_drafts_status_executed.sql` (SQL Editor or Supabase CLI).
   - **Service role key** (not the anon key): Supabase Dashboard → Project Settings → API → `service_role`. N8N uses this to insert/update `drafts` and to read `provider_identifiers` for user lookup.

2. **User ID resolution**
   - FlowAI Hub stores a mapping from Zoom/Slack identities to Supabase `user_id` in the `provider_identifiers` table. When a user connects **Connect Zoom** or **Connect Slack** in the Hub, the app writes a row: `(user_id, provider, external_id)` (e.g. Zoom `host_id` or Slack `user` id). N8N must **look up** `user_id` from this table (by `provider` and `external_id`) before inserting into `drafts`, so the draft appears for the right user.

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

### 2. Resolve Supabase user_id and prepare draft data

- From the trigger you have an **external id** (e.g. Zoom `host_id`, Slack `user` id).
- **Look up Supabase user_id:** Add a Supabase node **Get all** on table `provider_identifiers` with filters: `provider` = `zoom` (or `slack`) and `external_id` = the trigger’s host/user id. Use the first row’s `user_id` (UUID).
- Then build:
  - **Title** – e.g. meeting topic or message snippet.
  - **Body** – description or full message.
  - **Source** – `zoom` or `slack`.
  - **Type** – `task` (or `message` / `email`).
  - **user_id** – from the lookup above (so the draft shows for that user in the Hub).

Users must have connected Zoom or Slack in FlowAI Hub at least once so a row exists in `provider_identifiers`.

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

1. Add a **Webhook** node at the start of the approval workflow.
2. **HTTP Method:** POST.
3. **Path:** `draft-approval` (so the full URL is `https://your-n8n.com/webhook/draft-approval`).
4. Save the workflow and copy the **Production Webhook URL**.

### 2. Set the URL in FlowAI Hub

- In `.env.local` and in **Vercel** env vars set:  
  `N8N_WEBHOOK_URL=https://your-n8n.com/webhook/draft-approval`  
  (Use your real N8N base URL and the path you set in the Webhook node.)
- When a user approves a draft, the app sends a POST with body:
  ```json
  {
    "draftId": "uuid-of-the-draft",
    "action": "approved",
    "userId": "uuid-of-the-user"
  }
  ```
  In N8N the body is available as `$json.body.draftId`, `$json.body.action`, `$json.body.userId`.

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

## End-to-end example (Zoom → Approve → Slack)

1. User has **connected Zoom** and **connected Slack** in FlowAI Hub (so `connections` and `provider_identifiers` have rows for that user).
2. **Zoom meeting ends** → Zoom sends an event to your N8N “Zoom Meeting End” webhook (or N8N polls Zoom).
3. N8N gets meeting details (topic, agenda, `host_id`). It **looks up** `provider_identifiers` where `provider = 'zoom'` and `external_id = host_id` → gets Supabase `user_id`.
4. N8N **inserts a row into `drafts`** with that `user_id`, `source: 'zoom'`, `type: 'task'`, `title`, `body`, `status: 'pending'`.
5. User opens FlowAI Hub and sees the draft under “Pending approvals”.
6. User clicks **Approve**. FlowAI Hub sets `status: 'approved'` and POSTs to **N8N_WEBHOOK_URL** with `{ draftId, action: 'approved', userId }`.
7. N8N webhook workflow receives the POST, loads the draft from Supabase by `draftId`, checks `action === 'approved'`, then posts to Slack (or Jira). Finally N8N updates the draft to `status: 'executed'`.

The included workflow file **FlowAI Hub v3 - Zoom → Slack Approve → Create Task.json** implements this flow: Zoom and Slack triggers → lookup `provider_identifiers` → insert draft → webhook `draft-approval` → get draft → if approved, route by type (Slack/Jira) → post/create → update draft to `executed`.
