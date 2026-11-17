'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate, formatDateTime } from '@/lib/utils';
import { ArrowLeft, Building2, UserCheck, List, FileText, Clock, Activity, Download } from 'lucide-react';

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-40 flex-shrink-0">{label}:</span>
      <span className="text-sm font-medium text-gray-900">{value || '-'}</span>
    </div>
  );
}

export default function AuditDetailPage() {
  const { id } = useParams();
  const [audit, setAudit] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [findings, setFindings] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [checklist, setChecklist] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const downloadEvidence = async (item) => {
    try {
      const blob = await api.download(`/v1/audits/${id}/evidence/${item._id || item.id}/download`);
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = item.originalName || 'evidence'; link.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aRes, tRes] = await Promise.all([
          api.get(`/v1/audits/${id}`),
          api.get(`/v1/audits/${id}/timeline`).catch(() => ({ data: [] })),
        ]);
        setAudit({ ...aRes.audit, report: aRes.report || null });
        setAssignment(aRes.assignment ? { ...aRes.assignment, schedule: aRes.schedule || null } : null);
        setFindings(aRes.findings || []);
        setEvidence(aRes.evidence || []);
        setChecklist(aRes.checklist || null);
        setTimeline(tRes.timeline || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">{error}</div>;
  if (!audit) return <EmptyState title="Audit not found" />;

  const currentAssignment = assignment;

  return (
    <div>
      <PageHeader
        title={`Audit: ${audit.auditNumber || id}`}
        description={audit.hospital?.facilityName}
      >
        <Link href="/admin/audits">
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </Link>
      </PageHeader>

      {/* Status bar */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          <StatusBadge status={audit.status} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Target:</span>
          <span className="text-sm font-medium">{formatDate(audit.targetDate)}</span>
        </div>
        {['PLANNED', 'UNASSIGNED'].includes(audit.status) && (
          <div className="ml-auto">
            <Link href={`/admin/assignments/create?auditId=${id}`}>
              <Button size="sm"><UserCheck className="w-4 h-4 mr-2" />Assign Team</Button>
            </Link>
          </div>
        )}
      </div>

      <Tabs defaultValue="details">
        <TabsList className="mb-6">
          <TabsTrigger value="details"><Building2 className="w-4 h-4 mr-2" />Details</TabsTrigger>
          <TabsTrigger value="assignment"><UserCheck className="w-4 h-4 mr-2" />Assignment</TabsTrigger>
          <TabsTrigger value="report"><FileText className="w-4 h-4 mr-2" />Report</TabsTrigger>
          <TabsTrigger value="timeline"><Clock className="w-4 h-4 mr-2" />Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Audit Information</CardTitle></CardHeader>
              <CardContent>
                <InfoRow label="Audit Number" value={audit.auditNumber} />
                <InfoRow label="Status" value={<StatusBadge status={audit.status} />} />
                <InfoRow label="Target Date" value={formatDate(audit.targetDate)} />
                <InfoRow label="Reason" value={audit.reason} />
                <InfoRow label="Instructions" value={audit.instructions} />
                <InfoRow label="Created By" value={audit.createdBy?.name} />
                <InfoRow label="Created At" value={formatDateTime(audit.createdAt)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Hospital Information</CardTitle></CardHeader>
              <CardContent>
                {audit.hospital ? (
                  <>
                    <InfoRow label="Name" value={audit.hospital.facilityName} />
                    <InfoRow label="Facility ID" value={audit.hospital.facilityId} />
                    <InfoRow label="District" value={audit.hospital.district} />
                    <InfoRow label="Hospital Type" value={audit.hospital.hospitalType} />
                    <InfoRow label="Beds" value={audit.hospital.totalBedStrength} />
                    <InfoRow label="Nodal Officer" value={audit.hospital.nodalOfficerName} />
                    <InfoRow label="Phone" value={audit.hospital.nodalOfficerNumber} />
                  </>
                ) : <p className="text-sm text-gray-400">Hospital data not available</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assignment">
          {currentAssignment ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Assignment Details</CardTitle></CardHeader>
                <CardContent>
                  <InfoRow label="Assignment ID" value={currentAssignment._id || currentAssignment.id} />
                  <InfoRow label="Status" value={<StatusBadge status={currentAssignment.status} />} />
                  <InfoRow label="Assigned Date" value={formatDateTime(currentAssignment.assignedAt)} />
                  <InfoRow label="Ack. Deadline" value={formatDateTime(currentAssignment.acknowledgementDeadline)} />
                  <InfoRow label="Acknowledged At" value={formatDateTime(currentAssignment.acknowledgedAt)} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Team & Schedule</CardTitle></CardHeader>
                <CardContent>
                  <InfoRow label="Team" value={currentAssignment.team?.teamName} />
                  <InfoRow label="Team Lead" value={currentAssignment.team?.teamLeadEmail || currentAssignment.acknowledgedBy?.name} />
                  <InfoRow label="Scheduled Date" value={formatDate(currentAssignment.schedule?.scheduledDate)} />
                  <InfoRow label="Start Time" value={currentAssignment.schedule?.startTime} />
                  <InfoRow label="Duration" value={currentAssignment.schedule?.expectedDuration ? `${currentAssignment.schedule.expectedDuration} hours` : '-'} />
                  <InfoRow label="Remarks" value={currentAssignment.schedule?.remarks} />
                </CardContent>
              </Card>
            </div>
          ) : (
            <EmptyState
              title="No assignment yet"
              description="This audit has not been assigned to a team"
              action={
                <Link href={`/admin/assignments/create?auditId=${id}`}>
                  <Button size="sm"><UserCheck className="w-4 h-4 mr-2" />Assign Team</Button>
                </Link>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="checklist">
          {!checklist ? <EmptyState title="Checklist not started" description="The checklist will appear once the audit team opens it." /> : (
            <div className="space-y-4">{(checklist.template?.sections || []).map((section) => <Card key={section.sectionId}><CardHeader><CardTitle className="text-base">{section.title}</CardTitle></CardHeader><CardContent className="space-y-3">{(section.questions || []).map((question) => { const response = (checklist.responses || []).find((item) => item.questionId === question.questionId); return <div key={question.questionId} className="border-b pb-3 last:border-0"><p className="text-sm font-medium">{question.text}</p><p className="mt-1 text-sm text-indigo-700">{response?.responseValue ?? 'Not answered'}</p>{response?.remarks && <p className="mt-1 text-xs text-gray-500"><strong>Remarks:</strong> {response.remarks}</p>}</div>; })}</CardContent></Card>)}</div>
          )}
        </TabsContent>

        <TabsContent value="findings">
          {findings.length === 0 ? (
            <EmptyState title="No findings" description="Findings will appear here once the audit team records them" />
          ) : (
            <div className="space-y-4">
              {findings.map((f, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-gray-500">#{i + 1}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            f.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                            f.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{f.severity}</span>
                          <span className="text-xs text-gray-500">{f.category}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-1">{f.observation}</p>
                        {f.recommendation && <p className="text-xs text-gray-600"><strong>Recommendation:</strong> {f.recommendation}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="report">
          {audit.report ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Audit Report</CardTitle></CardHeader>
              <CardContent>
                <InfoRow label="Report Status" value={audit.report.currentStatus} />
                <InfoRow label="Submitted At" value={formatDateTime(audit.report.versions?.[audit.report.currentVersion - 1]?.submittedAt)} />
                <InfoRow label="Review Remarks" value={audit.report.versions?.[audit.report.currentVersion - 1]?.reviewComments} />
              </CardContent>
            </Card>
          ) : (
            <EmptyState title="No report yet" description="The report will be available after the audit is submitted" />
          )}
        </TabsContent>

        <TabsContent value="timeline">
          {timeline.length === 0 ? (
            <EmptyState title="No timeline events" description="Activity timeline will appear here" />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                  <div className="space-y-6">
                    {timeline.map((event, i) => (
                      <div key={i} className="relative pl-10">
                        <div className="absolute left-2.5 top-1 w-3 h-3 bg-primary rounded-full border-2 border-white" />
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{event.action}</p>
                              {event.description && <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>}
                              {event.fromStatus && (
                                <div className="flex items-center gap-2 mt-2">
                                  <StatusBadge status={event.fromStatus} />
                                  <span className="text-xs text-gray-400">→</span>
                                  <StatusBadge status={event.toStatus} />
                                </div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-gray-500">{formatDateTime(event.timestamp)}</p>
                              <p className="text-xs font-medium text-gray-700 mt-0.5">{event.performedBy?.name || 'System'}</p>
                              {event.performedByRole && <p className="text-xs text-gray-400">{event.performedByRole}</p>}
                              {event.details && <p className="mt-1 text-xs text-gray-500">{Object.entries(event.details).map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ')}</p>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
