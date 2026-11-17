'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { formatDateTime } from '@/lib/utils';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function ReassignmentsPage() {
  const [requests, setRequests] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionDialog, setActionDialog] = useState(null); // { request, action: 'approve'|'reject' }
  const [selectedTeam, setSelectedTeam] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      const qs = params.toString() ? `?${params}` : '';
      const [rRes, tRes] = await Promise.all([
        api.get(`/v1/assignments/reassignment-requests${qs}`),
        api.get('/v1/teams'),
      ]);
      setRequests(rRes.assignments || []);
      setTeams(tRes.teams || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async () => {
    if (!actionDialog) return;
    const { request, action } = actionDialog;
    if (action === 'approve' && !selectedTeam) {
      toast({ title: 'Please select a new team', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      if (action === 'approve') {
        await api.post(`/v1/assignments/${request._id || request.id}/approve-reassignment`, {
          newTeamId: selectedTeam,
          remarks,
        });
        toast({ title: 'Reassignment approved' });
      } else {
        await api.post(`/v1/assignments/${request._id || request.id}/reject-reassignment`, { remarks });
        toast({ title: 'Reassignment rejected' });
      }
      setActionDialog(null);
      setSelectedTeam('');
      setRemarks('');
      fetchData();
    } catch (err) {
      toast({ title: `Action failed`, description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Reassignment Requests"
        description={`${requests.length} pending requests`}
      />

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

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      ) : requests.length === 0 ? (
        <EmptyState title="No reassignment requests" description="All requests have been processed" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Audit Number</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Current Team</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Requested At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => {
                const reqId = req._id || req.id;
                const requestEvent = [...(req.acknowledgementHistory || [])].reverse().find((event) => event.action === 'REASSIGNMENT_REQUESTED');
                const isPending = req.status === 'REASSIGNMENT_REQUESTED';
                return (
                  <TableRow key={reqId}>
                    <TableCell className="font-mono text-xs">{req.audit?.auditNumber || '-'}</TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate">{req.hospital?.facilityName || '-'}</TableCell>
                    <TableCell className="text-sm">{req.team?.teamName || '-'}</TableCell>
                    <TableCell className="text-sm max-w-[200px]">
                      <p className="truncate" title={requestEvent?.reassignmentReason}>{requestEvent?.reassignmentReason || '-'}</p>
                    </TableCell>
                    <TableCell className="text-sm">{req.team?.teamName || '-'}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(requestEvent?.timestamp)}</TableCell>
                    <TableCell>
                      <StatusBadge status={req.status} />
                    </TableCell>
                    <TableCell>
                      {isPending && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setActionDialog({ request: req, action: 'approve' })}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setActionDialog({ request: req, action: 'reject' })}
                          >
                            <XCircle className="w-3 h-3 mr-1" />Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === 'approve' ? 'Approve Reassignment' : 'Reject Reassignment'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <p className="font-medium">{actionDialog?.request?.audit?.auditNumber}</p>
              <p className="text-gray-500">{actionDialog?.request?.hospital?.facilityName}</p>
              <p className="text-gray-500 mt-1"><strong>Reason:</strong> {[...(actionDialog?.request?.acknowledgementHistory || [])].reverse().find((event) => event.action === 'REASSIGNMENT_REQUESTED')?.reassignmentReason || '-'}</p>
            </div>

            {actionDialog?.action === 'approve' && (
              <div className="space-y-2">
                <Label>Select New Team *</Label>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams
                      .filter((t) => (t._id || t.id) !== (actionDialog?.request?.team?._id || actionDialog?.request?.teamId))
                      .map((t) => (
                        <SelectItem key={t._id || t.id} value={t._id || t.id}>{t.teamName}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                placeholder="Add any remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button
              onClick={handleAction}
              disabled={submitting}
              variant={actionDialog?.action === 'reject' ? 'destructive' : 'default'}
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {actionDialog?.action === 'approve' ? 'Approve & Reassign' : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
