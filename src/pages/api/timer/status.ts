import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';
import { parse } from 'cookie';
import { getAppSettings } from '../../../lib/settings';
import { getActiveTimer } from '../../../lib/entries';

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
