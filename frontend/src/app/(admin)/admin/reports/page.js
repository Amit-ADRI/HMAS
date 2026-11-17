'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import { Download, Eye, FileText } from 'lucide-react';

const REPORT_STATUSES = 'COMPLETED,SUBMITTED,RETURNED,CLOSED';
const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export default function ReportsPage() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: REPORT_STATUSES, limit: 100 });
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      const res = await api.get(`/v1/audits?${params}`);
      setAudits(res.audits || []);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [fromDate, toDate]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const exportCsv = () => {
    const rows = [
      ['Audit Number', 'Hospital', 'District', 'Status', 'Target Date'],
      ...audits.map((audit) => [audit.auditNumber, audit.hospital?.facilityName, audit.hospital?.district, audit.status, formatDate(audit.targetDate)]),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvValue).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `hmas-audit-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const downloadPdf = async (audit) => {
    try {
      const blob = await api.download(`/v1/reports/${audit._id || audit.id}/pdf`);
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${audit.auditNumber}.pdf`; link.click(); URL.revokeObjectURL(link.href);
    } catch (err) { setError(err.message); }
  };

  return <div>
    <PageHeader title="Reports" description={`${audits.length} completed, submitted, returned, or closed audits`}>
      <Button size="sm" variant="outline" onClick={exportCsv} disabled={!audits.length}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
    </PageHeader>

    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
      <label style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Filter by date</label>
      <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
        style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 13, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--ink)', outline: 'none', width: 140 }} />
      <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>to</span>
      <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
        style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 13, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--ink)', outline: 'none', width: 140 }} />
      {(fromDate || toDate) && (
        <button onClick={() => { setFromDate(''); setToDate(''); }}
          style={{ fontSize: 12, color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
          Clear
        </button>
      )}
    </div>

    {loading ? <LoadingSpinner /> : error ? <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div> : audits.length === 0 ? <EmptyState title="No reports available" description="Completed audits will appear here." icon={FileText} /> : (
      <Card><Table><TableHeader><TableRow><TableHead>Audit</TableHead><TableHead>Hospital</TableHead><TableHead>Status</TableHead><TableHead>Target</TableHead><TableHead>Open</TableHead></TableRow></TableHeader><TableBody>
        {audits.map((audit) => <TableRow key={audit._id || audit.id}><TableCell className="font-mono text-xs">{audit.auditNumber}</TableCell><TableCell>{audit.hospital?.facilityName || '-'}</TableCell><TableCell><StatusBadge status={audit.status} /></TableCell><TableCell>{formatDate(audit.targetDate)}</TableCell><TableCell><div className="flex"><Link href={`/admin/audits/${audit._id || audit.id}`}><Button size="sm" variant="ghost"><Eye className="w-4 h-4" /></Button></Link><Button size="sm" variant="ghost" onClick={() => downloadPdf(audit)} title="Download PDF"><FileText className="w-4 h-4" /></Button></div></TableCell></TableRow>)}
      </TableBody></Table></Card>
    )}
  </div>;
}
