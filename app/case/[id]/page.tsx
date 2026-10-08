import { notFound } from 'next/navigation';
import { getSession } from '@/lib/sessions';
import { toView } from '@/lib/view';
import Play from '@/app/components/Play';

export const dynamic = 'force-dynamic';

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  if (!s) notFound();
  return <Play initial={toView(s)} />;
}
