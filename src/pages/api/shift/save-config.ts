import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';
import { parse } from 'cookie';
import { getAppSettings } from '../../../lib/settings';
import { saveShiftConfig, type ShiftType } from '../../../lib/shift';

const VALID_TYPES: ShiftType[] = ['day', 'mid-day', 'mid-night', 'night', 'custom'];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

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
    const { shiftType, shiftStart, shiftEnd } = await request.json();

    if (!VALID_TYPES.includes(shiftType)) {
      return new Response(JSON.stringify({ error: 'Invalid shift type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!TIME_RE.test(shiftStart) || !TIME_RE.test(shiftEnd)) {
      return new Response(JSON.stringify({ error: 'shiftStart/shiftEnd must be HH:mm' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const settings = await getAppSettings(session.id);
    if (settings.role === 'coordinator') {
      return new Response(JSON.stringify({ error: 'Coordinators cannot edit shift config' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await saveShiftConfig(session.id, { shiftType, shiftStart, shiftEnd });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error saving shift config:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
