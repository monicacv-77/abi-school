// Tiny JSON store. Uses a private Vercel Blob store in production,
// and a local .data/ folder when no BLOB_READ_WRITE_TOKEN is set.
import { promises as fs } from 'fs';
import path from 'path';

const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const LOCAL_DIR = path.join(process.cwd(), '.data');

async function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  return await new Response(stream).text();
}

export async function readJSON<T>(key: string): Promise<T | null> {
  if (useBlob()) {
    const { get } = await import('@vercel/blob');
    const res = await get(key, { access: 'private', useCache: false });
    if (!res || !res.stream) return null;
    return JSON.parse(await streamToText(res.stream)) as T;
  }
  try {
    const text = await fs.readFile(path.join(LOCAL_DIR, key), 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  const body = JSON.stringify(value);
  if (useBlob()) {
    const { put } = await import('@vercel/blob');
    await put(key, body, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    });
    return;
  }
  const file = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body, 'utf8');
}
