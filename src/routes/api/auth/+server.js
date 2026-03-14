import { json } from '@sveltejs/kit';

const PASSWORD = process.env.APP_PASSWORD || '';

export async function POST({ request, cookies }) {
  const { password } = await request.json();

  if (!PASSWORD) {
    // No password configured — auto-authenticate
    cookies.set('tracker_session', 'authenticated', {
      path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30
    });
    return json({ ok: true });
  }

  if (password === PASSWORD) {
    cookies.set('tracker_session', 'authenticated', {
      path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30
    });
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Wrong password' }, { status: 401 });
}

export async function DELETE({ cookies }) {
  cookies.delete('tracker_session', { path: '/' });
  return json({ ok: true });
}
