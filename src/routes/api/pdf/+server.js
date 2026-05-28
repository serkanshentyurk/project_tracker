import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { readData } from '$lib/server/db.js';

export function GET({ url }) {
  const folder = url.searchParams.get('folder');
  const file = url.searchParams.get('file');
  const dataDir = url.searchParams.get('dataDir');

  if (!folder || !file || !dataDir) {
    return new Response('Missing parameters', { status: 400 });
  }

  // Prevent path traversal
  if (folder.includes('..') || file.includes('..') || dataDir.includes('..')) {
    return new Response('Invalid path', { status: 400 });
  }

  const filePath = join(dataDir, folder, file);

  if (!existsSync(filePath)) {
    return new Response('File not found', { status: 404 });
  }

  const content = readFileSync(filePath);
  return new Response(content, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${file}"`,
    },
  });
}
