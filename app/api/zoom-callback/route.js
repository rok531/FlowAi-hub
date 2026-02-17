import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : url.origin;
  const redirectUri = `${baseUrl}/api/zoom-callback`;

  console.log('[Zoom OAuth] Callback received. Code:', code ? 'present' : 'missing', 'State:', state ? 'present' : 'missing');

  const redirectConnected = NextResponse.redirect(new URL('/?zoom=connected', baseUrl));
  const redirectError = NextResponse.redirect(new URL('/?zoom=error', baseUrl));

  if (!code) {
    console.warn('[Zoom OAuth] Missing code parameter.');
    return redirectError;
  }

  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[Zoom OAuth] Missing ZOOM_CLIENT_ID or ZOOM_CLIENT_SECRET env vars.');
    return redirectError;
  }

  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    console.log('[Zoom OAuth] Exchanging code for tokens...');

    const response = await fetch(ZOOM_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const data = await response.json();

    console.log('[Zoom OAuth] Token exchange status:', response.status, 'error:', data?.error);

    if (!response.ok || data?.error) {
      console.error('[Zoom OAuth] Token exchange failed:', data);
      return redirectError;
    }

    const accessToken = data.access_token || '';
    const refreshToken = data.refresh_token || '';
    const teamId = data.account_id || data.user_id || '';

    console.log('[Zoom OAuth] Tokens received. access_token length:', accessToken?.length, 'team_id/account_id:', teamId);

    const userId = (state && UUID_REGEX.test(state)) ? state : null;
    if (!userId) {
      console.error('[Zoom OAuth] Missing or invalid state (user_id).');
      return redirectError;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl) {
      console.error('[Zoom OAuth] Missing NEXT_PUBLIC_SUPABASE_URL.');
      return redirectError;
    }
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey || supabaseAnonKey,
      supabaseServiceKey ? { auth: { persistSession: false, autoRefreshToken: false } } : {}
    );
    console.log('[Zoom OAuth] Saving connection for user_id:', userId, 'using', supabaseServiceKey ? 'service_role' : 'anon');

    // Save connection in Supabase
    const { error: insertError } = await supabase.from('connections').insert({
      user_id: userId,
      provider: 'zoom',
      access_token: accessToken,
      refresh_token: refreshToken,
      team_id: teamId,
    });

    if (insertError) {
      console.error('[Zoom OAuth] Failed to persist connection in Supabase:', insertError);
      return redirectError;
    }

    console.log('[Zoom OAuth] Connection saved successfully for user_id:', userId);

    return redirectConnected;
  } catch (error) {
    console.error('[Zoom OAuth] Unexpected error during token exchange or persistence:', error);
    return redirectError;
  }
}

