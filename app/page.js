'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function ButtonSpinner({ light = false }) {
  return (
    <span
      className={`mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-transparent ${
        light ? 'border-t-white border-l-white' : 'border-t-black border-l-black'
      }`}
      aria-hidden="true"
    />
  );
}

function ConnectedBannerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [message, setMessage] = useState(null);

  useEffect(() => {
    const slack = searchParams.get('slack');
    const zoom = searchParams.get('zoom');

    let nextMessage = null;
    if (slack === 'connected') {
      nextMessage = 'Slack has been connected successfully.';
    } else if (zoom === 'connected') {
      nextMessage = 'Zoom has been connected successfully.';
    }

    if (nextMessage) {
      setMessage(nextMessage);
      if (pathname) {
        router.replace(pathname, { scroll: false });
      }
    }
  }, [searchParams, router, pathname]);

  if (!message) return null;

  return (
    <div className="mb-6 rounded-lg border border-emerald-500/70 bg-emerald-950/70 px-4 py-3 text-sm text-emerald-100 shadow-md shadow-emerald-500/25">
      <span className="font-semibold">Success:</span> {message}
    </div>
  );
}

function ConnectedBanner() {
  return (
    <Suspense fallback={null}>
      <ConnectedBannerInner />
    </Suspense>
  );
}

function AuthCard({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSignUp,
  onSignIn,
  onResetPassword,
  authLoading,
  error,
  info,
}) {
  const isSigningUp = authLoading === 'signup';
  const isSigningIn = authLoading === 'signin';
  const isResetting = authLoading === 'reset';
  const isBusy = Boolean(authLoading);

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <p className="inline-flex items-center gap-1 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-indigo-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Private beta access
        </p>
        <h2 className="mt-3 text-xl font-semibold text-white sm:text-2xl">
          Create your FlowAI Hub account
        </h2>
        <p className="mt-2 text-xs text-gray-400">
          Sign up or sign in with email and password. No credit card required.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/60 bg-red-950/70 px-3 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

      {info && (
        <div className="mb-4 rounded-md border border-emerald-500/60 bg-emerald-950/70 px-3 py-2 text-xs text-emerald-100">
          {info}
        </div>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-300" htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="block w-full rounded-lg border border-gray-800 bg-black/60 px-3 py-2 text-sm text-gray-100 outline-none ring-0 transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="you@company.com"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-gray-300" htmlFor="password">
              Password
            </label>
            <p className="text-[10px] text-gray-500">Min. 8 characters</p>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="block w-full rounded-lg border border-gray-800 bg-black/60 px-3 py-2 text-sm text-gray-100 outline-none ring-0 transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={onResetPassword}
            disabled={isResetting || !email}
            className="mt-1 inline-flex items-center text-[11px] font-medium text-indigo-300 transition hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResetting && <ButtonSpinner light />}
            {isResetting ? 'Sending reset link…' : 'Forgot password?'}
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onSignUp}
            disabled={isBusy}
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-3 py-2 text-sm font-medium text-black shadow-lg shadow-indigo-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSigningUp && <ButtonSpinner />}
            {isSigningUp ? 'Creating account…' : 'Sign Up'}
          </button>
          <button
            type="button"
            onClick={onSignIn}
            disabled={isBusy}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-700 bg-gray-900/80 px-3 py-2 text-sm font-medium text-gray-50 shadow-sm shadow-black/40 transition hover:border-indigo-500 hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningIn && <ButtonSpinner light />}
            {isSigningIn ? 'Signing in…' : 'Sign In'}
          </button>
        </div>
      </form>

      <p className="mt-4 text-[11px] leading-relaxed text-gray-500">
        By continuing, you agree to route Zoom conversations into Slack as structured, actionable
        tasks. You can disconnect at any time from your Slack or Zoom integrations.
      </p>
    </div>
  );
}

function Dashboard({
  email,
  authLoading,
  onSignOut,
  slackConnected,
  zoomConnected,
  connectionsLoading,
}) {
  const [connecting, setConnecting] = useState(null);

  const isSigningOut = authLoading === 'signout';

  const handleConnect = (provider) => () => {
    setConnecting(provider);
  };

  // Dynamic OAuth URLs based on current origin
  const getSlackHref = () => {
    if (typeof window === 'undefined') return '#';
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/slack-callback`);
    return `https://slack.com/oauth/v2/authorize?client_id=10490775030869.10497112809173&scope=chat:write,channels:read,users:read&redirect_uri=${redirectUri}`;
  };

  const getZoomHref = () => {
    if (typeof window === 'undefined') return '#';
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/zoom-callback`);
    return `https://zoom.us/oauth/authorize?response_type=code&client_id=c4cvH4S_TpSXe6FPcBQikQ&redirect_uri=${redirectUri}`;
  };

  const slackHref = getSlackHref();
  const zoomHref = getZoomHref();

  const slackStatusText = connectionsLoading
    ? 'Checking…'
    : slackConnected
    ? 'Connected'
    : 'Not connected';

  const zoomStatusText = connectionsLoading
    ? 'Checking…'
    : zoomConnected
    ? 'Connected'
    : 'Not connected';

  const slackStatusColor =
    connectionsLoading && !slackConnected
      ? 'text-gray-400'
      : slackConnected
      ? 'text-emerald-400'
      : 'text-yellow-400';
  const zoomStatusColor =
    connectionsLoading && !zoomConnected
      ? 'text-gray-400'
      : zoomConnected
      ? 'text-emerald-400'
      : 'text-yellow-400';

  return (
    <div className="w-full">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-400">
          You&apos;re in
        </p>
        <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
          Welcome back, {email || 'creator'}
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Connect Slack and Zoom to let FlowAI Hub transform meetings into tasks automatically.
        </p>
      </div>

      <div className="rounded-lg border border-gray-800 bg-black/40 p-3 text-xs text-gray-300">
        <p className="font-medium text-gray-100">Connection status</p>
        <ul className="mt-2 space-y-1 text-[11px] text-gray-400">
          <li>
            • Account:{' '}
            <span className="text-emerald-400">
              Active
            </span>
          </li>
          <li>
            • Slack:{' '}
            <span className={slackStatusColor}>
              {slackStatusText}
            </span>
          </li>
          <li>
            • Zoom:{' '}
            <span className={zoomStatusColor}>
              {zoomStatusText}
            </span>
          </li>
        </ul>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <a
          href={slackHref}
          onClick={handleConnect('slack')}
          className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:bg-indigo-400"
        >
          {connecting === 'slack' && <ButtonSpinner light />}
          {connecting === 'slack' ? 'Opening Slack…' : 'Connect Slack'}
          {slackConnected && !connectionsLoading && (
            <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              Connected
            </span>
          )}
        </a>
        <a
          href={zoomHref}
          onClick={handleConnect('zoom')}
          className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-black shadow-lg shadow-sky-500/40 transition hover:bg-sky-400"
        >
          {connecting === 'zoom' && <ButtonSpinner />}
          {connecting === 'zoom' ? 'Opening Zoom…' : 'Connect Zoom'}
          {zoomConnected && !connectionsLoading && (
            <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              Connected
            </span>
          )}
        </a>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        disabled={isSigningOut}
        className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-gray-700 bg-gray-900/80 px-3 py-2 text-sm font-medium text-gray-100 shadow-sm shadow-black/40 transition hover:border-red-500 hover:bg-gray-950 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSigningOut && <ButtonSpinner light />}
        {isSigningOut ? 'Signing out…' : 'Sign Out'}
      </button>
    </div>
  );
}

export default function HomePage() {
  const [session, setSession] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(null); // 'signup' | 'signin' | 'signout' | 'reset' | null
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const [connections, setConnections] = useState({ slack: false, zoom: false });
  const [connectionsLoading, setConnectionsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function getInitialSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (error) throw error;
        setSession(data.session ?? null);
      } catch (err) {
        console.error('[supabase] getSession error', err);
        if (isMounted) {
          setError('Unable to load your session. Please try again.');
        }
      } finally {
        if (isMounted) {
          setInitialLoading(false);
        }
      }
    }

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadConnections() {
      if (!session?.user?.id) {
        if (isMounted) {
          setConnections({ slack: false, zoom: false });
        }
        return;
      }

      setConnectionsLoading(true);

      try {
        const { data, error } = await supabase
          .from('connections')
          .select('provider')
          .eq('user_id', session.user.id);

        if (!isMounted) return;

        if (error) {
          throw error;
        }

        const providers = (data || []).map((row) => row.provider);
        setConnections({
          slack: providers.includes('slack'),
          zoom: providers.includes('zoom'),
        });

        console.log('[supabase] Loaded connection providers:', providers);
      } catch (err) {
        console.error('[supabase] load connections error', err);
      } finally {
        if (isMounted) {
          setConnectionsLoading(false);
        }
      }
    }

    loadConnections();

    return () => {
      isMounted = false;
    };
  }, [session]);

  const validateCredentials = (mode) => {
    const trimmedEmail = (email || '').trim();
    const trimmedPassword = password || '';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail) {
      return 'Please enter your email address.';
    }
    if (!emailRegex.test(trimmedEmail)) {
      return 'Please enter a valid email address.';
    }

    if (!trimmedPassword) {
      return 'Please enter your password.';
    }
    if (mode === 'signup' && trimmedPassword.length < 8) {
      return 'Please choose a password with at least 8 characters.';
    }

    return null;
  };

  const handleSignUp = async () => {
    const validationError = validateCredentials('signup');
    if (validationError) {
      setError(validationError);
      setInfo(null);
      return;
    }

    setAuthLoading('signup');
    setError(null);
    setInfo(null);

    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setInfo('Account created. Check your inbox to confirm your email (if required).');
    } catch (err) {
      console.error('[supabase] signUp error', err);
      setError(err?.message || 'Unable to sign up. Please check your details and try again.');
    } finally {
      setAuthLoading(null);
    }
  };

  const handleSignIn = async () => {
    const validationError = validateCredentials('signin');
    if (validationError) {
      setError(validationError);
      setInfo(null);
      return;
    }

    setAuthLoading('signin');
    setError(null);
    setInfo(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setInfo('Signed in successfully.');
    } catch (err) {
      console.error('[supabase] signIn error', err);
      setError(err?.message || 'Unable to sign in. Please check your credentials.');
    } finally {
      setAuthLoading(null);
    }
  };

  const handleResetPassword = async () => {
    const trimmedEmail = (email || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError('Enter a valid email address to reset your password.');
      setInfo(null);
      return;
    }

    setAuthLoading('reset');
    setError(null);
    setInfo(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
      if (error) throw error;
      setInfo('If an account exists for that email, a reset link has been sent.');
    } catch (err) {
      console.error('[supabase] resetPassword error', err);
      setError(
        err?.message ||
          'Unable to send a reset link right now. Please try again in a few minutes.'
      );
    } finally {
      setAuthLoading(null);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading('signout');
    setError(null);
    setInfo(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      console.error('[supabase] signOut error', err);
      setError(err?.message || 'Unable to sign out. Please try again.');
    } finally {
      setAuthLoading(null);
    }
  };

  const userEmail = session?.user?.email ?? '';

  return (
    <div className="flex min-h-screen flex-col bg-black text-gray-100">
      <header className="border-b border-gray-900 bg-black/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            {/* Simple logo placeholder */}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-sky-500 to-emerald-400 shadow-lg shadow-indigo-500/40">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-black"
                aria-hidden="true"
              >
                <path
                  d="M4 12c0-4.418 3.134-8 7-8s7 3.582 7 8-3.134 8-7 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M5 15c1.2-1.2 2.8-2 4.5-2 2.8 0 3.8 2 6.5 2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-white">
                FlowAI Hub
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                Zoom → Slack automation
              </span>
            </div>
          </div>

          {session && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={authLoading === 'signout'}
              className="hidden items-center justify-center rounded-full border border-gray-800 bg-gray-950 px-4 py-1.5 text-xs font-medium text-gray-100 shadow-sm shadow-black/40 transition hover:border-red-500 hover:bg-black hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
            >
              {authLoading === 'signout' && <ButtonSpinner light />}
              {authLoading === 'signout' ? 'Signing out…' : 'Sign Out'}
            </button>
          )}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-between">
          <section className="max-w-xl text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-400">
              AI workflow orchestration
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
              FlowAI Hub
            </h1>
            <p className="mt-4 text-sm text-gray-300 sm:text-base">
              Turn every Zoom conversation into structured, prioritized Slack tasks. FlowAI Hub
              listens to your meetings, extracts decisions and action items, and sends them straight
              into the channels where work actually happens.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[11px] text-gray-400 lg:justify-start">
              <div className="inline-flex items-center gap-1 rounded-full border border-gray-800 bg-gray-950/70 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Realtime Zoom capture</span>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-gray-800 bg-gray-950/70 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                <span>Slack-native task threads</span>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-gray-800 bg-gray-950/70 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                <span>Privacy-first, team-ready</span>
              </div>
            </div>
          </section>

          <section className="w-full max-w-md">
            <ConnectedBanner />

            <div className="rounded-2xl border border-gray-900 bg-gray-950/80 p-6 shadow-2xl shadow-indigo-500/15 backdrop-blur">
              {initialLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-gray-400">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-400" />
                  <span>Loading your FlowAI Hub experience…</span>
                </div>
              ) : session ? (
                <Dashboard
                  email={userEmail}
                  authLoading={authLoading}
                  onSignOut={handleSignOut}
                  slackConnected={connections.slack}
                  zoomConnected={connections.zoom}
                  connectionsLoading={connectionsLoading}
                />
              ) : (
                <AuthCard
                  email={email}
                  password={password}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onSignUp={handleSignUp}
                  onSignIn={handleSignIn}
                  onResetPassword={handleResetPassword}
                  authLoading={authLoading}
                  error={error}
                  info={info}
                />
              )}
            </div>

            <footer className="mt-6 border-t border-gray-900 pt-4 text-center text-[11px] text-gray-500">
              <p>
                © 2026 FlowAI Hub
              </p>
              <p className="mt-1 text-[10px] text-gray-600">
                Private beta • Feedback &amp; support: support@flowai-hub.com
              </p>
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}

