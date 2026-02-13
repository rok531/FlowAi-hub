import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  // Dynamic redirect URI based on request origin
  const origin = url.origin;
  const redirectUri = `${origin}/api/zoom-callback`;

  console.log('[Zoom OAuth] Callback received. Code:', code, 'Origin:', origin);

  const redirectConnected = NextResponse.redirect(
    new URL('/?zoom=connected', request.url)
  );
  const redirectError = NextResponse.redirect(
    new URL('/?zoom=error', request.url)
  );

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

    // Create Supabase client with cookies for server-side session access
    const cookieStore = cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Zoom OAuth] Missing Supabase env vars.');
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
        console.log('[Zoom OAuth] Could not get user from session, will try alternative method');
      }
    }

    // Alternative: Get user from access token if available
    if (!userId && authToken) {
      try {
        const { data: { user } } = await supabase.auth.getUser(authToken);
        if (user) userId = user.id;
      } catch (err) {
        console.log('[Zoom OAuth] Could not get user from auth token');
      }
    }

    if (!userId) {
      console.error('[Zoom OAuth] Failed to resolve Supabase user from session. User must be logged in.');
      return redirectError;
    }

    console.log('[Zoom OAuth] Supabase user resolved. user_id:', userId);

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

