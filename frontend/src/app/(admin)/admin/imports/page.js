'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatDate } from '@/lib/utils';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export default function ImportsPage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/v1/imports')
      .then(d => setBatches(d.batches || d.data || []))
      .catch(() => setBatches([]))
      .finally(() => setLoading(false));
  }, []);

  const statusDot = (status) => {
    const map = {
      COMPLETED: '#22c55e',
      PARTIAL: '#f59e0b',
      FAILED: '#ef4444',
      PROCESSING: '#3b82f6',
    };
    return map[status] || '#94a3b8';
  };

  return (
    <div>
      <PageHeader title="Imports" description="Bulk import hospitals from Excel or CSV files">
        <Link href="/admin/hospitals/import">
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={14} />
            New Import
          </button>
        </Link>
      </PageHeader>

      {/* Quick action card */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr', gap: 1,
        background: 'var(--line)', marginBottom: 28
      }}>
        <Link href="/admin/hospitals/import" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'var(--paper)', padding: '20px 24px',
            display: 'flex', alignItems: 'center', gap: 16,
            cursor: 'pointer', transition: 'background 0.12s'
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--paper-raised)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--paper)'}
          >
            <div style={{
              width: 42, height: 42, background: 'var(--teal)', borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <FileSpreadsheet size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 2 }}>
                Hospital Data Import
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                Upload .xlsx, .xls, or .csv — supports Bihar NABH empanelled hospitals format
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--teal)', fontWeight: 500 }}>
              Start import →
            </div>
          </div>
        </Link>
      </div>

      {/* Import history */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
        Import History
      </div>

      <div style={{ background: 'var(--line)', gap: 1, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ background: 'var(--paper)', padding: '32px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13 }}>
            Loading...
          </div>
        ) : batches.length === 0 ? (
          <div style={{ background: 'var(--paper)', padding: '48px 32px', textAlign: 'center' }}>
            <Clock size={32} style={{ color: 'var(--ink-soft)', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>No imports yet</div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
              Your import history will appear here after your first import.
            </div>
          </div>
        ) : (
          batches.map(batch => (
            <div key={batch._id} style={{
              background: 'var(--paper)', padding: '14px 20px',
              display: 'grid', gridTemplateColumns: '1fr auto auto auto',
              alignItems: 'center', gap: 24
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>
                  {batch.filename || 'Hospital Import'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                  {formatDate(batch.importedAt)} · by {batch.importedBy?.name || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{batch.added || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>added</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{batch.updated || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>updated</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-soft)' }}>
                <span style={{
                  display: 'inline-block', width: 7, height: 7,
                  borderRadius: '50%', background: statusDot(batch.status), flexShrink: 0
                }} />
                {batch.status || 'COMPLETED'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
