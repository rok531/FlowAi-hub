import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // user_id passed from the app when starting OAuth
  
  // Dynamic redirect URI based on request origin
  const origin = url.origin;
  const redirectUri = `${origin}/api/slack-callback`;

  console.log('[Slack OAuth] Callback received. Code:', code, 'State:', state);

  const redirectConnected = NextResponse.redirect(
    new URL('/?slack=connected', request.url)
  );
  const redirectError = NextResponse.redirect(
    new URL('/?slack=error', request.url)
  );

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

    console.log('[Slack OAuth] Tokens received. access_token length:', accessToken?.length, 'team_id:', teamId);

    // user_id comes from OAuth state (set by the app when user clicked Connect Slack)
    const userId = (state && UUID_REGEX.test(state)) ? state : null;
    if (!userId) {
      console.error('[Slack OAuth] Missing or invalid state (user_id). Re-run Connect Slack from the dashboard.');
      return redirectError;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Slack OAuth] Missing Supabase env vars.');
      return redirectError;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('[Slack OAuth] Saving connection for user_id:', userId);

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

    console.log('[Slack OAuth] Connection saved successfully for user_id:', userId);

    return redirectConnected;
  } catch (error) {
    console.error('[Slack OAuth] Unexpected error during token exchange or persistence:', error);
    return redirectError;
  }
}

