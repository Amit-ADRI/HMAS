'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { ScrollText, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

const ACTION_COLORS = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-gray-100 text-gray-700',
  LOGOUT: 'bg-gray-100 text-gray-600',
  APPROVE: 'bg-teal-100 text-teal-700',
  REJECT: 'bg-orange-100 text-orange-700',
  ASSIGN: 'bg-indigo-100 text-indigo-700',
  SUBMIT: 'bg-purple-100 text-purple-700',
  EXPORT: 'bg-yellow-100 text-yellow-700',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', action: '', dateFrom: '', dateTo: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 30;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page, limit,
        ...(filters.search && { search: filters.search }),
        ...(filters.action && filters.action !== 'all' && { action: filters.action }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
      });
      const res = await api.get(`/v1/audit-logs?${params}`);
      setLogs(res.logs || res.data || []);
      setTotalPages(res.pages || res.totalPages || 1);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const clearFilters = () => {
    setFilters({ search: '', action: '', dateFrom: '', dateTo: '' });
    setPage(1);
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      <PageHeader title="Audit Logs" description={`${total} log entries`} />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by user, entity, action..."
                className="pl-9"
                value={filters.search}
                onChange={(e) => { setFilters((p) => ({ ...p, search: e.target.value })); setPage(1); }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">From:</label>
              <Input
                type="date"
                className="w-40"
                value={filters.dateFrom}
                onChange={(e) => { setFilters((p) => ({ ...p, dateFrom: e.target.value })); setPage(1); }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">To:</label>
              <Input
                type="date"
                className="w-40"
                value={filters.dateTo}
                onChange={(e) => { setFilters((p) => ({ ...p, dateTo: e.target.value })); setPage(1); }}
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
      ) : logs.length === 0 ? (
        <EmptyState title="No log entries" icon={ScrollText} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const lId = log._id || log.id;
                const actionColor = ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700';
                return (
                  <TableRow key={lId}>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDateTime(log.timestamp || log.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{log.userId?.name || log.user?.name || log.userName || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.userRole || log.userId?.role || log.user?.role || '-'}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColor}`}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{log.entity || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{log.entityId ? log.entityId.toString().slice(-8) : '-'}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate" title={log.reason}>{log.reason || '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{log.ipAddress || '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {totalPages} ({total} total)</p>
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
