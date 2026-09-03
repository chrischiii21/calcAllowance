import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';
import { parse } from 'cookie';
import { getAppSettings } from '../../../lib/settings';
import { getActiveTimer, updateTimerStart } from '../../../lib/entries';

export const GET: APIRoute = async ({ request }) => {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = parse(cookieHeader);
  const session = cookies.session ? await getSession(cookies.session) : null;

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const settings = await getAppSettings(session.id);

  // Coordinators don't track time themselves — the widget hides itself in that case.
  if (settings.role === 'coordinator') {
    return new Response(JSON.stringify({ applicable: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const activeTimer = await getActiveTimer(session.id, settings.isEmployee ?? false);

  return new Response(JSON.stringify({
    applicable: true,
    active: !!activeTimer,
    startTime: activeTimer?.startTime ?? null,
    description: activeTimer?.description ?? '',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Lets the header widget's "adjust start time" popover correct a clock-in punched at the wrong
// time, without stopping/restarting the timer (which would split it into two DTR entries).
export const PATCH: APIRoute = async ({ request }) => {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = parse(cookieHeader);
  const session = cookies.session ? await getSession(cookies.session) : null;

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { startTime } = await request.json().catch(() => ({ startTime: null }));
  if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
    return new Response(JSON.stringify({ error: 'Invalid start time' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const settings = await getAppSettings(session.id);
    const isEmployee = settings.isEmployee ?? false;

    const existing = await getActiveTimer(session.id, isEmployee);
    if (!existing) {
      return new Response(JSON.stringify({ error: 'No active timer to adjust' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updated = await updateTimerStart(session.id, startTime, isEmployee);
    return new Response(JSON.stringify({ success: true, startTime: updated?.start_time ?? null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error adjusting timer start:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
