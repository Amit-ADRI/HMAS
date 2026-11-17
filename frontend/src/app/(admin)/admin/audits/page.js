'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { Plus, Search, ChevronLeft, ChevronRight, Eye, X, Download } from 'lucide-react';

const STATUSES = [
  'PLANNED','UNASSIGNED','ASSIGNED','AWAITING_ACKNOWLEDGEMENT','ACCEPTED',
  'SCHEDULED','IN_PROGRESS','COMPLETED','SUBMITTED','UNDER_REVIEW',
  'RETURNED','APPROVED','CLOSED','CANCELLED',
];
const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export default function AuditsPage() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', fromDate: '', toDate: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page, limit,
        ...(search && { search }),
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v !== 'all')),
      });
      const res = await api.get(`/v1/audits?${params}`);
      setAudits(res.audits || []);
      setTotalPages(res.pages || 1);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, filters]);

  useEffect(() => { fetchAudits(); }, [fetchAudits]);

  const clearFilters = () => {
    setFilters({ status: '', fromDate: '', toDate: '' });
    setSearch('');
    setPage(1);
  };
  const hasFilters = search || Object.values(filters).some(Boolean);
  const exportCsv = () => {
    const rows = [['Audit Number', 'Hospital', 'District', 'Status', 'Team', 'Target Date'], ...audits.map((audit) => [audit.auditNumber, audit.hospital?.facilityName, audit.hospital?.district, audit.status, audit.currentAssignment?.team?.teamName, formatDate(audit.targetDate)])];
    const blob = new Blob([rows.map((row) => row.map(csvValue).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `hmas-audits-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  return (
    <div>
      <PageHeader title="All Audits" description={`${total} audits total`}>
        <Link href="/admin/audits/create">
          <Button size="sm"><Plus className="w-4 h-4 mr-2" />Create Audit</Button>
        </Link>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!audits.length}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
      </PageHeader>

      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search audit number, hospital..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select
              value={filters.status || 'all'}
              onValueChange={(v) => { setFilters((p) => ({ ...p, status: v === 'all' ? '' : v })); setPage(1); }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>From</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => { setFilters((p) => ({ ...p, fromDate: e.target.value })); setPage(1); }}
                style={{
                  padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 3,
                  fontSize: 13, fontFamily: 'inherit', background: 'var(--white)',
                  color: 'var(--ink)', outline: 'none', width: 140,
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>To</label>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => { setFilters((p) => ({ ...p, toDate: e.target.value })); setPage(1); }}
                style={{
                  padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 3,
                  fontSize: 13, fontFamily: 'inherit', background: 'var(--white)',
                  color: 'var(--ink)', outline: 'none', width: 140,
                }}
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      ) : audits.length === 0 ? (
        <EmptyState
          title="No audits found"
          description="Create your first audit to get started"
          action={<Link href="/admin/audits/create"><Button size="sm"><Plus className="w-4 h-4 mr-2" />Create Audit</Button></Link>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Audit Number</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Target Date</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audits.map((audit) => {
                const aId = audit._id || audit.id;
                return (
                  <TableRow key={aId}>
                    <TableCell className="font-mono text-xs font-medium">{audit.auditNumber || aId}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm">{audit.hospital?.facilityName || '-'}</TableCell>
                    <TableCell><StatusBadge status={audit.status} /></TableCell>
                    <TableCell className="text-xs">{audit.currentAssignment?.team?.teamName || '-'}</TableCell>
                    <TableCell className="text-sm">{formatDate(audit.targetDate)}</TableCell>
                    <TableCell>
                      <Link href={`/admin/audits/${aId}`}>
                        <Button size="icon" variant="ghost"><Eye className="w-3.5 h-3.5" /></Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
