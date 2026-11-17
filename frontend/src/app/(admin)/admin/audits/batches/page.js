'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { ClipboardList, Eye } from 'lucide-react';

export default function AuditBatchesPage() {
  const [batches, setBatches] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const fetchBatches = useCallback(async () => { try { const res = await api.get('/v1/audits/batches'); setBatches(res.batches || []); } catch (err) { setError(err.message); } finally { setLoading(false); } }, []);
  useEffect(() => { fetchBatches(); }, [fetchBatches]);
  if (loading) return <LoadingSpinner />;
  if (error) return <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  return <div><PageHeader title="Audit Batches" description="Monitor all hospitals created together, their teams, and individual workflow progress." />{!batches.length ? <EmptyState title="No multi-hospital batches" description="Create an audit for two or more hospitals to monitor it here." icon={ClipboardList} /> : <div className="space-y-5">{batches.map((batch) => <Card key={batch.batchId}><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">{batch.batchId}</CardTitle><p className="mt-1 text-xs text-gray-500">{batch.hospitals.length} hospitals • {batch.auditType} • created {formatDate(batch.createdAt)}</p></div><div className="text-right text-sm"><p><strong>{batch.assignedCount}/{batch.hospitals.length}</strong> assigned</p><p><strong>{batch.completedCount}/{batch.hospitals.length}</strong> closed</p></div></div></CardHeader><CardContent className="space-y-2">{batch.hospitals.map((item) => <div key={item.auditId} className="flex flex-wrap items-center justify-between gap-3 rounded border bg-slate-50 p-3"><div><p className="text-sm font-medium">{item.hospital?.facilityName || '-'}</p><p className="text-xs text-gray-500">{item.auditNumber} • {item.hospital?.district || '-'}</p></div><div className="flex items-center gap-3"><span className="text-xs text-gray-600">{item.team?.teamName || 'Unassigned'}</span><StatusBadge status={item.status} /><Link href={`/admin/audits/${item.auditId}`}><Button size="sm" variant="outline"><Eye className="mr-1 h-3.5 w-3.5" />Open</Button></Link></div></div>)}</CardContent></Card>)}</div>}</div>;
}
