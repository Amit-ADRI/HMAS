'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Eye, Plus, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const STATUSES = ['AWAITING_ACKNOWLEDGEMENT','ACCEPTED','SCHEDULED','IN_PROGRESS','COMPLETED','SUBMITTED','RETURNED'];

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [teams, setTeams] = useState([]);
  const [reassigning, setReassigning] = useState(null);
  const [newTeamId, setNewTeamId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const limit = 20;

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit, ...(statusFilter && statusFilter !== 'all' && { status: statusFilter }), ...(fromDate && { fromDate }), ...(toDate && { toDate }) });
      const res = await api.get(`/v1/assignments?${params}`);
      setAssignments(res.assignments || []);
      setTotalPages(res.pages || 1);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, fromDate, toDate]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);
  useEffect(() => { api.get('/v1/teams?isActive=true&limit=100').then((res) => setTeams(res.teams || [])).catch(() => {}); }, []);

  const directReassign = async () => {
    if (!newTeamId || reason.trim().length < 10) return toast({ title: 'Choose a team and enter a reason of at least 10 characters', variant: 'destructive' });
    setSaving(true);
    try {
      await api.post(`/v1/assignments/${reassigning._id || reassigning.id}/reassign`, { newTeamId, reason });
      toast({ title: 'Audit reassigned successfully' });
      setReassigning(null); setNewTeamId(''); setReason(''); fetchAssignments();
    } catch (err) { toast({ title: 'Reassignment failed', description: err.message, variant: 'destructive' }); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Assignments" description={`${total} total assignments`}>
        <Link href="/admin/assignments/create">
          <Button size="sm"><Plus className="w-4 h-4 mr-2" />Assign Team</Button>
        </Link>
      </PageHeader>

      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <Select
              value={statusFilter || 'all'}
              onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>From</label>
              <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 13, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--ink)', outline: 'none', width: 140 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>To</label>
              <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 13, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--ink)', outline: 'none', width: 140 }} />
            </div>
            {(statusFilter || fromDate || toDate) && (
              <button onClick={() => { setStatusFilter(''); setFromDate(''); setToDate(''); setPage(1); }}
                style={{ fontSize: 12, color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, whiteSpace: 'nowrap' }}>
                Clear all
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      ) : assignments.length === 0 ? (
        <EmptyState title="No assignments found" description="No assignments match your current filter" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assignment ID</TableHead>
                <TableHead>Audit Number</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Date</TableHead>
                <TableHead>Expected Date</TableHead>
                <TableHead>Ack. Deadline</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => {
                const asgId = a._id || a.id;
                return (
                  <TableRow key={asgId}>
                    <TableCell className="font-mono text-xs">{a.assignmentId || asgId?.slice(-8)}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">{a.audit?.auditNumber || '-'}</TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate">{a.hospital?.facilityName || '-'}</TableCell>
                    <TableCell className="text-sm">{a.team?.teamName || '-'}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell className="text-sm">{formatDateTime(a.assignedAt)}</TableCell>
                    <TableCell className="text-sm">{formatDate(a.expectedAuditDate || a.audit?.targetDate)}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(a.acknowledgementDeadline)}</TableCell>
                    <TableCell><div className="flex gap-1">
                      <Link href={`/admin/audits/${a.audit?._id || a.auditId}`}><Button size="icon" variant="ghost"><Eye className="w-3.5 h-3.5" /></Button></Link>
                      {['PENDING', 'ACCEPTED'].includes(a.status) && <Button size="icon" variant="ghost" title="Reassign team" onClick={() => setReassigning(a)}><RefreshCw className="w-3.5 h-3.5" /></Button>}
                    </div>
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
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
      <Dialog open={!!reassigning} onOpenChange={(open) => !open && setReassigning(null)}><DialogContent><DialogHeader><DialogTitle>Reassign audit</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-sm text-gray-600">Move <strong>{reassigning?.audit?.auditNumber}</strong> to another team. The new lead will receive a new acknowledgement request.</p><div className="space-y-2"><Label>New team *</Label><Select value={newTeamId} onValueChange={setNewTeamId}><SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger><SelectContent>{teams.filter((team) => (team._id || team.id) !== (reassigning?.team?._id || reassigning?.team?.id) && ['Available', 'Partially Available'].includes(team.availability)).map((team) => <SelectItem key={team._id || team.id} value={team._id || team.id}>{team.teamName} — {team.availability}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Reason *</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this reassignment required?" /></div></div><DialogFooter><Button variant="outline" onClick={() => setReassigning(null)}>Cancel</Button><Button onClick={directReassign} disabled={saving}>{saving ? 'Reassigning…' : 'Confirm reassignment'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
