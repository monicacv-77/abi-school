'use client';

export default function PrintButton() {
  return (
    <button className="btn ghost" onClick={() => window.print()} style={{ minHeight: 40, padding: '6px 14px' }}>
      Print / save PDF
    </button>
  );
}
