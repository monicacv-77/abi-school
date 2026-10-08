// Tiny JSON store. Uses a Vercel Blob store in production,
// and a local .data/ folder when no BLOB_READ_WRITE_TOKEN is set.
// Works with either a private or a public Blob store (private is preferred).
import { promises as fs } from 'fs';
import path from 'path';

// Connected Blob stores provide either a read-write token or a store id (with Vercel's built-in OIDC sign-in).
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const LOCAL_DIR = path.join(process.cwd(), '.data');

type Access = 'private' | 'public';
let access: Access = process.env.BLOB_ACCESS === 'public' ? 'public' : 'private';

const isAccessError = (e: unknown) => /access|public|private/i.test(String((e as Error)?.message ?? e));

async function withAccess<T>(fn: (a: Access) => Promise<T>): Promise<T> {
  try {
    return await fn(access);
  } catch (e) {
    if (!isAccessError(e)) throw e;
    const other: Access = access === 'private' ? 'public' : 'private';
    const result = await fn(other);
    access = other;
    return result;
  }
}

export async function readJSON<T>(key: string): Promise<T | null> {
  if (useBlob()) {
    const { get } = await import('@vercel/blob');
    const res = await withAccess((a) => get(key, { access: a, useCache: false }));
    if (!res || !res.stream) return null;
    return JSON.parse(await new Response(res.stream).text()) as T;
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
    await withAccess((a) =>
      put(key, body, { access: a, addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 }),
    );
    return;
  }
  if (process.env.VERCEL) throw new Error('Storage is not connected (no BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID). Connect a Blob store to the project and redeploy.');
  const file = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body, 'utf8');
}

export function storeMode() {
  return useBlob() ? `blob (${access})` : process.env.VERCEL ? 'NOT CONNECTED' : 'local files';
}
