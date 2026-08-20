import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';
import { parse } from 'cookie';
import { getAppSettings } from '../../../lib/settings';
import { getActiveTimer, startTimer, stopTimer } from '../../../lib/entries';

// Global Time In / Time Out control (Header widget). Reuses the same active_timers/entries
// plumbing as the Dashboard's task timer — starting or stopping here is reflected there too,
// since both read/write the same row keyed by (user_id, is_employee).
export const POST: APIRoute = async ({ request }) => {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = parse(cookieHeader);
  const session = cookies.session ? await getSession(cookies.session) : null;

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const settings = await getAppSettings(session.id);
    if (settings.role === 'coordinator') {
      return new Response(JSON.stringify({ error: 'Coordinators cannot clock in/out' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isEmployee = settings.isEmployee ?? false;
    const existing = await getActiveTimer(session.id, isEmployee);

    if (existing) {
      await stopTimer(session.id, '', isEmployee);
      const { addSyncLog } = await import('../../../lib/logs');
      await addSyncLog({ userId: session.id, type: 'Sync', status: 'Success', details: 'Timed out' });
      return new Response(JSON.stringify({ success: true, active: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      const started = await startTimer(session.id, '', isEmployee);
      const { addSyncLog } = await import('../../../lib/logs');
      await addSyncLog({ userId: session.id, type: 'Sync', status: 'Success', details: 'Timed in' });
      return new Response(JSON.stringify({ success: true, active: true, startTime: started?.start_time ?? null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err: any) {
    console.error('Error toggling timer:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
