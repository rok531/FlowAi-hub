import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function PATCH(request, { params }) {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: 'Draft id required' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body?.action;
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: 'Body must include action: "approve" or "reject"' },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '') || (await cookies()).get('sb-access-token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized. Send Authorization: Bearer <session.access_token> from client.' }, { status: 401 });
  }

  // Use the user's token so RLS allows reading/updating their drafts
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: draft, error: fetchError } = await supabase
    .from('drafts')
    .select('id, user_id, status')
    .eq('id', id)
    .single();

  if (fetchError || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }
  if (draft.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (draft.status !== 'pending') {
    return NextResponse.json(
      { error: `Draft already ${draft.status}` },
      { status: 409 }
    );
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  const { error: updateError } = await supabase
    .from('drafts')
    .update({
      status: newStatus,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('[drafts] Update error:', updateError);
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
  }

  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  if (n8nWebhookUrl && action === 'approve') {
    try {
      await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: id, action: 'approved', userId: user.id }),
      });
    } catch (err) {
      console.warn('[drafts] N8N webhook failed:', err.message);
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
