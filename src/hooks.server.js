import { redirect } from '@sveltejs/kit';

const PASSWORD = process.env.APP_PASSWORD || '';

export async function handle({ event, resolve }) {
  // No password set = no auth required (local dev)
  if (!PASSWORD) return resolve(event);

  // Always allow login routes and API auth endpoint
  const path = event.url.pathname;
  if (path === '/login' || path === '/api/auth') {
    return resolve(event);
  }

  // Check session cookie
  const session = event.cookies.get('tracker_session');
  if (session !== 'authenticated') {
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw redirect(303, '/login');
  }

  return resolve(event);
}
