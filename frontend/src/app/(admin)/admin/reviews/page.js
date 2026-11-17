'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { formatDateTime } from '@/lib/utils';
import { Eye, CheckCircle, RotateCcw, Loader2, Star } from 'lucide-react';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [actionType, setActionType] = useState(''); // 'approve' | 'return'
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const { toast } = useToast();

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: 'SUBMITTED', limit: 50 });
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      const res = await api.get(`/v1/audits?${params}`);
      setReviews(res.audits || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const openAction = (audit, type) => {
    setSelectedAudit(audit);
    setActionType(type);
    setRemarks('');
  };

  const handleAction = async () => {
    if (!selectedAudit) return;
    const aId = selectedAudit._id || selectedAudit.id;
    setSubmitting(true);
    try {
      if (actionType === 'approve') {
        await api.post(`/v1/reports/${aId}/approve`, { remarks });
        toast({ title: 'Audit approved successfully' });
      } else {
        await api.post(`/v1/reports/${aId}/return`, { comments: remarks });
        toast({ title: 'Audit returned to team' });
      }
      setSelectedAudit(null);
      setActionType('');
      fetchReviews();
    } catch (err) {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Pending Reviews"
        description={`${reviews.length} reports awaiting review`}
        icon={Star}
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
      ) : reviews.length === 0 ? (
        <EmptyState
          title="No pending reviews"
          description="All submitted reports have been reviewed"
          icon={Star}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Audit Number</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted At</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="w-36">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((audit) => {
                const aId = audit._id || audit.id;
                return (
                  <TableRow key={aId}>
                    <TableCell className="font-mono text-xs font-medium">{audit.auditNumber}</TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate">{audit.hospital?.facilityName || '-'}</TableCell>
                    <TableCell className="text-sm">{audit.currentAssignment?.team?.teamName || '-'}</TableCell>
                    <TableCell><StatusBadge status={audit.status} /></TableCell>
                    <TableCell className="text-sm">{formatDateTime(audit.report?.versions?.[audit.report.currentVersion - 1]?.submittedAt)}</TableCell>
                    <TableCell className="text-sm">-</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/admin/audits/${aId}`}>
                          <Button size="icon" variant="ghost" title="View audit">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700"
                          onClick={() => openAction(audit, 'approve')}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                          onClick={() => openAction(audit, 'return')}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />Return
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Action Dialog */}
      <Dialog open={!!selectedAudit} onOpenChange={() => setSelectedAudit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Report' : 'Return Report for Revision'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <p className="font-medium">{selectedAudit?.auditNumber}</p>
              <p className="text-gray-500">{selectedAudit?.hospital?.facilityName}</p>
              <p className="text-gray-500">Team: {selectedAudit?.currentAssignment?.team?.teamName || '-'}</p>
            </div>
            <div className="space-y-2">
              <Label>{actionType === 'approve' ? 'Review Remarks' : 'Return Reason *'}</Label>
              <Textarea
                placeholder={actionType === 'approve' ? 'Optional remarks...' : 'Explain what needs to be corrected...'}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAudit(null)}>Cancel</Button>
            <Button
              onClick={handleAction}
              disabled={submitting || (actionType === 'return' && !remarks)}
              variant={actionType === 'approve' ? 'default' : 'outline'}
              className={actionType === 'return' ? 'text-orange-600 border-orange-300 hover:bg-orange-50' : ''}
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {actionType === 'approve' ? 'Approve & Close Audit' : 'Return to Team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
