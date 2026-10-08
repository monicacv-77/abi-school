import { NextResponse } from 'next/server';
import { addWonder } from '@/lib/sessions';

export async function POST(req: Request) {
  const { question } = (await req.json().catch(() => ({}))) as { question?: string };
  if (!question?.trim()) return NextResponse.json({ error: 'Empty question' }, { status: 400 });
  const item = await addWonder(question);
  return NextResponse.json({ item });
}
