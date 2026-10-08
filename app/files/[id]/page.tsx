import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/sessions';
import CaseSummaryPage from '@/app/components/CaseSummaryPage';
import PrintButton from '@/app/components/PrintButton';

export const dynamic = 'force-dynamic';

export default async function FilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  if (!s || !s.summary) notFound();
  return (
    <main style={{ padding: '16px 0 60px' }}>
      <div className="no-print row" style={{ maxWidth: 816, margin: '0 auto 12px', padding: '0 16px', justifyContent: 'space-between' }}>
        <Link href="/files">← Archive</Link>
        <PrintButton />
      </div>
      <CaseSummaryPage s={s.summary} />
    </main>
  );
}
