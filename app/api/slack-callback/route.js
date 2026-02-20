import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // user_id passed from the app when starting OAuth
  
  // On Vercel, request.url origin can differ from the public URL; Slack requires redirect_uri to match exactly what the client used
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : url.origin;
  const redirectUri = `${baseUrl}/api/slack-callback`;

  console.log('[Slack OAuth] Callback. redirectUri:', redirectUri);

  const redirectConnected = NextResponse.redirect(new URL('/?slack=connected', baseUrl));
  const redirectError = NextResponse.redirect(new URL('/?slack=error', baseUrl));

  if (!code) {
    console.warn('[Slack OAuth] Missing code parameter.');
    return redirectError;
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[Slack OAuth] Missing SLACK_CLIENT_ID or SLACK_CLIENT_SECRET env vars.');
    return redirectError;
  }

  try {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    console.log('[Slack OAuth] Exchanging code for tokens...');

    const response = await fetch(SLACK_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body,
    });

    const data = await response.json();

    console.log('[Slack OAuth] Token exchange status:', response.status, 'ok:', data?.ok);

    if (!response.ok || !data?.ok) {
      console.error('[Slack OAuth] Token exchange failed:', data);
      return redirectError;
    }

    const accessToken =
      data.access_token ||
      data.authed_user?.access_token ||
      '';
    const refreshToken =
      data.refresh_token ||
      data.authed_user?.refresh_token ||
      '';
    const teamId =
      data.team?.id ||
      data.team?.team_id ||
      data.team_id ||
      '';
    const slackUserId = data.authed_user?.id || '';

    console.log('[Slack OAuth] Tokens received. access_token length:', accessToken?.length, 'team_id:', teamId);

    // user_id comes from OAuth state (set by the app when user clicked Connect Slack)
    const userId = (state && UUID_REGEX.test(state)) ? state : null;
    if (!userId) {
      console.error('[Slack OAuth] Missing or invalid state (user_id). Re-run Connect Slack from the dashboard.');
      return redirectError;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl) {
      console.error('[Slack OAuth] Missing NEXT_PUBLIC_SUPABASE_URL.');
      return redirectError;
    }
    // Service role bypasses RLS so the server can insert for any user; anon key often fails here
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey || supabaseAnonKey,
      supabaseServiceKey ? { auth: { persistSession: false, autoRefreshToken: false } } : {}
    );
    console.log('[Slack OAuth] Saving connection for user_id:', userId, 'using', supabaseServiceKey ? 'service_role' : 'anon');

    // Save connection in Supabase
    const { error: insertError } = await supabase.from('connections').insert({
      user_id: userId,
      provider: 'slack',
      access_token: accessToken,
      refresh_token: refreshToken,
      team_id: teamId,
    });

    if (insertError) {
      console.error('[Slack OAuth] Failed to persist connection in Supabase:', insertError);
      return redirectError;
    }

    // Map Slack user id → Supabase user_id so N8N can assign drafts to this user
    if (slackUserId) {
      await supabase.from('provider_identifiers').upsert(
        { user_id: userId, provider: 'slack', external_id: String(slackUserId) },
        { onConflict: 'provider,external_id' }
      );
    }

    console.log('[Slack OAuth] Connection saved successfully for user_id:', userId);

    return redirectConnected;
  } catch (error) {
    console.error('[Slack OAuth] Unexpected error during token exchange or persistence:', error);
    return redirectError;
  }
}

