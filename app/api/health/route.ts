// Setup check: open /api/health while logged in to see what's configured and whether storage works.
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readJSON, storeMode, writeJSON } from '@/lib/store';
import { MODEL } from '@/lib/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const out: Record<string, unknown> = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'set' : 'MISSING',
    APP_PASSCODE: process.env.APP_PASSCODE ? 'set' : 'MISSING',
    PARENT_PIN: process.env.PARENT_PIN ? 'set' : 'MISSING',
    BLOB: process.env.BLOB_READ_WRITE_TOKEN ? 'token set' : process.env.BLOB_STORE_ID ? 'store id set' : 'MISSING',
    model: MODEL,
  };
  try {
    const stamp = new Date().toISOString();
    await writeJSON('health.json', { stamp });
    const back = await readJSON<{ stamp: string }>('health.json');
    out.storage = back?.stamp === stamp ? `OK — ${storeMode()}` : `wrote but read back ${JSON.stringify(back)}`;
  } catch (e) {
    out.storage = `ERROR — ${(e as Error).message}`;
  }
  try {
    const r = await new Anthropic().messages.create({ model: MODEL, max_tokens: 5, messages: [{ role: 'user', content: 'Say ok' }] });
    out.ai = r.content.length ? 'OK' : 'empty reply';
  } catch (e) {
    out.ai = `ERROR — ${(e as Error).message}`;
  }
  return NextResponse.json(out, { headers: { 'cache-control': 'no-store' } });
}
