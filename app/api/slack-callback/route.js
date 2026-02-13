import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  // Dynamic redirect URI based on request origin
  const origin = url.origin;
  const redirectUri = `${origin}/api/slack-callback`;

  console.log('[Slack OAuth] Callback received. Code:', code, 'Origin:', origin);

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

    // Create Supabase client with cookies for server-side session access
    const cookieStore = cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Slack OAuth] Missing Supabase env vars.');
      return redirectError;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    });

    // Get session from cookies
    const authToken = cookieStore.get('sb-access-token')?.value || 
                      cookieStore.get(`sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`)?.value;
    
    // Try to get user from session
    let userId = null;
    
    // Check for Supabase session cookie (format varies)
    const sessionCookie = cookieStore.getAll().find(c => 
      c.name.includes('supabase') || c.name.includes('sb-')
    );
    
    if (sessionCookie) {
      try {
        // Try to decode or get user from session
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
        }
      } catch (err) {
        console.log('[Slack OAuth] Could not get user from session, will try alternative method');
      }
    }

    // Alternative: Get user from access token if available
    if (!userId && authToken) {
      try {
        const { data: { user } } = await supabase.auth.getUser(authToken);
        if (user) userId = user.id;
      } catch (err) {
        console.log('[Slack OAuth] Could not get user from auth token');
      }
    }

    if (!userId) {
      console.error('[Slack OAuth] Failed to resolve Supabase user from session. User must be logged in.');
      return redirectError;
    }

    console.log('[Slack OAuth] Supabase user resolved. user_id:', userId);

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

