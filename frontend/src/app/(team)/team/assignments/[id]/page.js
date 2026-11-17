'use client';
import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { ArrowLeft, CheckCircle, RefreshCw, Play, Loader2, Printer, Download } from 'lucide-react';

const REASSIGNMENT_REASONS = [
  'Team member unavailability',
  'Scheduling conflict',
  'Expertise mismatch',
  'Travel constraints',
  'Conflict of interest',
  'Resource reallocation',
  'Other',
];

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-40 flex-shrink-0">{label}:</span>
      <span className="text-sm font-medium text-gray-900">{value || '-'}</span>
    </div>
  );
}

function AcceptanceForm({ assignment, audit, hospital }) {
  const acceptedAt = assignment.acknowledgedAt || [...(assignment.acknowledgementHistory || [])].reverse().find((entry) => entry.action === 'ACCEPTED')?.timestamp;
  const leadName = assignment.acknowledgedBy?.name || 'Team Lead';

  return (
    <section className="print-document rounded-lg border-2 border-slate-700 bg-white p-6 text-sm text-slate-900">
      <div className="mb-5 flex items-start justify-between border-b-2 border-slate-700 pb-4">
        <div>
          <p className="text-lg font-bold tracking-wide">HAMS</p>
          <p className="text-xs text-slate-600">Hospital Audit Management System</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-semibold">FORM: AUDIT ASSIGNMENT ACCEPTANCE</p>
          <p>Assignment No.: {assignment.assignmentId || assignment._id}</p>
        </div>
      </div>

      <h2 className="mb-4 text-center text-base font-bold uppercase">Audit Assignment Acceptance Form</h2>
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <InfoRow label="Audit number" value={audit.auditNumber} />
        <InfoRow label="Target date" value={formatDate(audit.targetDate)} />
        <InfoRow label="Hospital" value={hospital.facilityName} />
        <InfoRow label="Facility ID" value={hospital.facilityId} />
        <InfoRow label="District / State" value={[hospital.district, hospital.state].filter(Boolean).join(', ')} />
        <InfoRow label="Hospital address" value={hospital.address} />
        <InfoRow label="Assigned team" value={assignment.team?.teamName} />
        <InfoRow label="Team Lead" value={leadName} />
        <InfoRow label="Assigned on" value={formatDateTime(assignment.assignedAt)} />
        <InfoRow label="Acknowledgement deadline" value={formatDateTime(assignment.acknowledgementDeadline)} />
      </div>
      <div className="mt-4 rounded border border-slate-300 p-3">
        <p className="mb-1 text-xs font-semibold uppercase text-slate-600">Audit purpose / instructions</p>
        <p>{audit.instructions || assignment.instructions || audit.reason || 'No additional instructions provided.'}</p>
      </div>
      <div className="mt-5 border-t border-slate-300 pt-4">
        <p className="leading-6">I, <strong>{leadName}</strong>, acknowledge receipt of this audit assignment and accept responsibility for coordinating, scheduling, and completing the audit in accordance with the instructions above.</p>
        <div className="mt-7 grid grid-cols-2 gap-8 text-xs">
          <div className="border-t border-slate-500 pt-1">Team Lead acknowledgement: {acceptedAt ? formatDateTime(acceptedAt) : 'Pending acceptance'}</div>
          <div className="border-t border-slate-500 pt-1">System-generated acceptance record</div>
        </div>
      </div>
    </section>
  );
}

export default function AssignmentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog states
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [reassignReason, setReassignReason] = useState('');
  const [reassignRemarks, setReassignRemarks] = useState('');

  const fetchAssignment = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/v1/assignments/${id}`);
      setAssignment({ ...(res.assignment || res), schedule: res.schedule || null });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useAutoRefresh(fetchAssignment);

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      await api.post(`/v1/assignments/${id}/acknowledge`, {});
      toast({ title: 'Assignment accepted successfully' });
      setAcceptOpen(false);
      fetchAssignment();
    } catch (err) {
      toast({ title: 'Failed to accept assignment', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignReason) {
      toast({ title: 'Please select a reason', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/v1/assignments/${id}/request-reassignment`, {
        reason: [reassignReason, reassignRemarks].filter(Boolean).join(': '),
      });
      toast({ title: 'Reassignment request submitted' });
      setReassignOpen(false);
      fetchAssignment();
    } catch (err) {
      toast({ title: 'Request failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };


  const handleStartAudit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/v1/assignments/${id}/start-audit`, {});
      toast({ title: 'Audit started' });
      router.push(`/team/audits/${assignment.audit?._id || assignment.auditId}`);
    } catch (err) {
      toast({ title: 'Failed to start audit', description: err.message, variant: 'destructive' });
      setSubmitting(false);
    }
  };

  const printAcceptanceForm = () => window.print();
  const downloadAuditOrder = async () => {
    try {
      const auditId = assignment?.audit?._id || assignment?.audit?.id;
      const blob = await api.download(`/v1/audits/${auditId}/order-pdf`);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${assignment.audit?.auditNumber || 'audit'}-order.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      toast({ title: 'Could not download audit order', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">{error}</div>;
  if (!assignment) return <EmptyState title="Assignment not found" />;

  const audit = assignment.audit || {};
  const hospital = audit.hospital || assignment.hospital || {};
  const status = assignment.status;
  const isPending = status === 'AWAITING_ACKNOWLEDGEMENT' || status === 'PENDING';
  const isAccepted = status === 'ACCEPTED' && audit.status === 'ACCEPTED';
  const reassignmentRequest = [...(assignment.acknowledgementHistory || [])].reverse().find((event) => event.action === 'REASSIGNMENT_REQUESTED');

  return (
    <div>
      <PageHeader
        title={`Assignment: ${audit.auditNumber || id}`}
        description={hospital.facilityName}
      >
        <Link href="/team/assignments">
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </Link>
      </PageHeader>

      {/* Status & Actions */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-white rounded-lg border border-gray-200">
        <StatusBadge status={audit.status || status} />
        <div className="ml-auto flex items-center gap-2">
          {isPending && (
            <>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setAcceptOpen(true)}>
                <CheckCircle className="w-4 h-4 mr-2" />Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => setReassignOpen(true)}>
                <RefreshCw className="w-4 h-4 mr-2" />Request Reassignment
              </Button>
            </>
          )}
          {isAccepted && (
            <>
              <Button size="sm" variant="outline" onClick={downloadAuditOrder}><Download className="w-4 h-4 mr-2" />Audit Order PDF</Button>
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={handleStartAudit} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Start Audit
              </Button>
            </>
          )}
        </div>
      </div>

      {status === 'ACCEPTED' && (
        <Card className="mb-6">
          <CardHeader className="screen-only flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Accepted Audit Assignment Form</CardTitle>
            <Button variant="outline" size="sm" onClick={printAcceptanceForm}><Printer className="w-4 h-4 mr-2" />Print form</Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6"><AcceptanceForm assignment={assignment} audit={audit} hospital={hospital} /></CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hospital Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Hospital Information</CardTitle></CardHeader>
          <CardContent>
            <InfoRow label="Hospital Name" value={hospital.facilityName} />
            <InfoRow label="Facility ID" value={hospital.facilityId} />
            <InfoRow label="District" value={hospital.district} />
            <InfoRow label="State" value={hospital.state} />
            <InfoRow label="Hospital Type" value={hospital.hospitalType} />
            <InfoRow label="Beds" value={hospital.totalBedStrength} />
            <InfoRow label="Nodal Officer" value={hospital.nodalOfficerName} />
            <InfoRow label="Phone" value={hospital.nodalOfficerNumber} />
            <InfoRow label="Address" value={hospital.address} />
          </CardContent>
        </Card>

        {/* Audit Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Audit Information</CardTitle></CardHeader>
          <CardContent>
            <InfoRow label="Audit Number" value={audit.auditNumber} />
            <InfoRow label="Target Date" value={formatDate(audit.targetDate)} />
            <InfoRow label="Reason" value={audit.reason} />
            <InfoRow label="Instructions" value={audit.instructions} />
          </CardContent>
        </Card>

        {/* Assignment Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Assignment Details</CardTitle></CardHeader>
          <CardContent>
            <InfoRow label="Status" value={<StatusBadge status={status} />} />
            <InfoRow label="Assigned At" value={formatDateTime(assignment.assignedAt)} />
            <InfoRow label="Ack. Deadline" value={formatDateTime(assignment.acknowledgementDeadline)} />
            <InfoRow label="Acknowledged At" value={formatDateTime(assignment.acknowledgedAt)} />
          </CardContent>
        </Card>

        {/* Reassignment info if applicable */}
        {reassignmentRequest && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader><CardTitle className="text-base text-orange-800">Reassignment Request</CardTitle></CardHeader>
            <CardContent>
              <InfoRow label="Reason" value={reassignmentRequest.reassignmentReason} />
              <InfoRow label="Requested At" value={formatDateTime(reassignmentRequest.timestamp)} />
              <InfoRow label="Status" value={assignment.status} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Accept Dialog */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Review and accept audit assignment</DialogTitle></DialogHeader>
          <AcceptanceForm assignment={assignment} audit={audit} hospital={hospital} />
          <p className="text-sm text-gray-600">By accepting, you confirm the acknowledgement shown in this form. A printable copy will be saved on this assignment.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleAccept} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Accept Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Reassignment Dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Reassignment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={reassignReason} onValueChange={setReassignReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASSIGNMENT_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Additional Remarks</Label>
              <Textarea
                placeholder="Provide any additional context..."
                value={reassignRemarks}
                onChange={(e) => setReassignRemarks(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReassign} disabled={submitting || !reassignReason}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
