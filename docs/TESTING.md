# FlowAI Hub – End-to-end testing guide

Use this to test auth, Slack/Zoom connections, and the human-in-the-loop drafts flow.

---

## Before you start

1. **Supabase**
   - Run the `connections` table SQL (see README) if you haven’t.
   - Run `supabase/migrations/001_create_drafts.sql` in Supabase → SQL Editor so the `drafts` table exists.

2. **Environment**
   - `.env.local` has: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`.

3. **App running**
   - Local: `npm run dev` → open http://localhost:3000  
   - Or use your Vercel URL.

4. **Slack / Zoom apps**
   - Redirect URLs include your app origin (e.g. `http://localhost:3000/api/slack-callback` and same for zoom, or your Vercel URL).

---

## Test 1: Auth (sign up / sign in)

1. Open the app (localhost or Vercel).
2. **Sign up:** Enter email + password (min 8 chars) → **Sign Up**.
3. If Supabase has “Confirm email” on: check inbox and confirm (or turn it off in Supabase for testing).
4. **Sign in:** Same email/password → **Sign In**.
5. You should see the dashboard: “Welcome back, &lt;email&gt;”, Connection status, Connect Slack / Connect Zoom, **Pending approvals** section, Sign Out.

**Optional:** Use **Forgot password?** → enter email → check inbox for reset link.

---

## Test 2: Slack connection

1. While logged in, click **Connect Slack**.
2. You’re sent to Slack OAuth; choose a workspace and allow.
3. You’re redirected back to the app (e.g. `/?slack=connected`).
4. You should see: green “Slack has been connected successfully” and under Connection status: **Slack: Connected**; the Slack button shows a “Connected” badge.
5. In Supabase → Table Editor → `connections`, there should be a row with `provider = slack` and your `user_id`.

---

## Test 3: Zoom connection

1. Click **Connect Zoom**.
2. Authorize the Zoom app.
3. Redirect back with `?zoom=connected` and message “Zoom has been connected successfully”.
4. Connection status shows **Zoom: Connected**; Zoom button shows “Connected”.
5. In `connections` there should be a row with `provider = zoom`.

---

## Test 4: Pending approvals (human-in-the-loop)

This checks that drafts show in the dashboard and that Approve/Reject work.

### 4a. Create a draft manually in Supabase

1. Supabase → **Authentication** → **Users** → copy your user’s **UUID**.
2. **SQL Editor** → New query, run:

```sql
INSERT INTO drafts (user_id, source, type, title, body, status)
VALUES (
  'PASTE-YOUR-USER-UUID-HERE',
  'zoom',
  'task',
  'Test task from Zoom',
  'Review the Q1 roadmap and send to client by Friday.',
  'pending'
);
```

3. Replace `PASTE-YOUR-USER-UUID-HERE` with your actual user UUID. Run.

### 4b. See and approve in the app

1. In the app (refresh if already on dashboard), open the **Pending approvals** section.
2. You should see one draft: “Test task from Zoom” with body text and **Approve** / **Reject**.
3. Click **Approve**. The draft should disappear from the list.
4. In Supabase → `drafts`, that row should have `status = 'approved'` and `resolved_at` set.

### 4c. Test Reject

1. Insert another draft (same SQL, change title e.g. to “Another test task”).
2. In the app, click **Reject** for that draft.
3. It disappears; in Supabase the row has `status = 'rejected'`.

---

## Test 5: N8N webhook on approve (optional)

Only if you use N8N and set `N8N_WEBHOOK_URL`.

1. In N8N, create a workflow: **Webhook** (POST) → any node that logs or stores the body.
2. Activate the workflow and copy the webhook URL.
3. In `.env.local` (and in Vercel env vars):  
   `N8N_WEBHOOK_URL=https://your-n8n.com/webhook/...`
4. Restart the app (or rely on Vercel env if already deployed).
5. Create a draft in Supabase (as in Test 4a) and **Approve** it in the app.
6. In N8N, check the webhook execution: body should be like  
   `{ "draftId": "...", "action": "approved", "userId": "..." }`.

---

## Quick checklist

| Step | What to do | Success |
|------|------------|--------|
| 1 | Sign up / sign in | Dashboard with email and Sign Out |
| 2 | Connect Slack | “Slack connected”, row in `connections` |
| 3 | Connect Zoom | “Zoom connected”, row in `connections` |
| 4a | Insert draft in Supabase | Row in `drafts` with `status = pending` |
| 4b | Open app → Pending approvals | Draft visible; Approve removes it, row `approved` |
| 4c | Insert draft → Reject | Draft removed, row `rejected` |
| 5 | Set N8N webhook, approve draft | N8N receives POST with draftId, action, userId |

---

## Common issues

- **“No pending drafts”**  
  Check `drafts.user_id` = your auth user UUID and `status = 'pending'`.

- **Slack/Zoom redirect error**  
  Add the exact redirect URL (e.g. `http://localhost:3000/api/slack-callback`) in the Slack/Zoom app settings.

- **Approve/Reject does nothing or error**  
  Check browser console and Network tab for `/api/drafts/...` (401 = session; send `Authorization: Bearer <access_token>`). Ensure you’re logged in and the draft’s `user_id` matches your user.

- **N8N not receiving webhook**  
  Confirm `N8N_WEBHOOK_URL` is set where the app runs (env vars), and that the N8N workflow is active and the URL is correct.
