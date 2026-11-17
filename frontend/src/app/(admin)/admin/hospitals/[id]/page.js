'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatDateTime } from '@/lib/utils';
import { ArrowLeft, Plus, Building2, ClipboardList, FileText, Activity } from 'lucide-react';

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-sm text-gray-500 w-40 flex-shrink-0">{label}:</span>
      <span className="text-sm font-medium text-gray-900">{value || '-'}</span>
    </div>
  );
}

export default function HospitalDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [hospital, setHospital] = useState(null);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [hRes, aRes] = await Promise.all([
          api.get(`/v1/hospitals/${id}`),
          api.get(`/v1/hospitals/${id}/audits`),
        ]);
        setHospital(hRes.hospital);
        setAudits(aRes.audits || []);
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
  if (!hospital) return <EmptyState title="Hospital not found" />;

  return (
    <div>
      <PageHeader
        title={hospital.facilityName}
        description={`Facility ID: ${hospital.facilityId || '-'}`}
      >
        <Link href="/admin/hospitals">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <Link href={`/admin/audits/create?hospitalId=${id}`}>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Create Audit
          </Button>
        </Link>
      </PageHeader>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview"><Building2 className="w-4 h-4 mr-2" />Overview</TabsTrigger>
          <TabsTrigger value="audits"><ClipboardList className="w-4 h-4 mr-2" />Audits ({audits.length})</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="w-4 h-4 mr-2" />Documents</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="w-4 h-4 mr-2" />Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Facility ID" value={hospital.facilityId} />
                <InfoRow label="Hospital Name" value={hospital.facilityName} />
                <InfoRow label="Hospital Type" value={hospital.hospitalType} />
                <InfoRow label="Facility Type" value={hospital.facilityType} />
                <InfoRow label="Beds" value={hospital.totalBedStrength} />
                <InfoRow label="Specialities" value={Array.isArray(hospital.specialities) ? hospital.specialities.join(', ') : hospital.specialities} />
                <InfoRow label="Scheme Code" value={hospital.schemeCode} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Location & Contact</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="State" value={hospital.state} />
                <InfoRow label="District" value={hospital.district} />
                <InfoRow label="Address" value={hospital.address} />
                <InfoRow label="Pin Code" value={hospital.pinCode} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Nodal Officer</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Name" value={hospital.nodalOfficerName} />
                <InfoRow label="Phone" value={hospital.nodalOfficerNumber} />
                <InfoRow label="Email" value={hospital.nodalOfficerEmail} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Audit Status</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Audit Priority" value={hospital.auditPriority ? <PriorityBadge priority={hospital.auditPriority} /> : '-'} />
                <InfoRow label="Risk Category" value={hospital.riskCategory || '-'} />
                <InfoRow label="Last Audit" value={formatDate(hospital.lastAuditDate)} />
                <InfoRow label="Total Audits" value={audits.length} />
                <InfoRow label="Added On" value={formatDate(hospital.createdAt)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audits">
          {audits.length === 0 ? (
            <EmptyState
              title="No audits yet"
              description="Create an audit for this hospital to get started"
              action={
                <Link href={`/admin/audits/create?hospitalId=${id}`}>
                  <Button size="sm"><Plus className="w-4 h-4 mr-2" />Create Audit</Button>
                </Link>
              }
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Audit Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Target Date</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audits.map((audit) => (
                    <TableRow key={audit._id || audit.id}>
                      <TableCell className="font-mono text-xs">{audit.auditNumber || audit._id}</TableCell>
                      <TableCell className="text-sm">{audit.auditType}</TableCell>
                      <TableCell><StatusBadge status={audit.status} /></TableCell>
                      <TableCell><PriorityBadge priority={audit.priority} /></TableCell>
                      <TableCell className="text-sm">{formatDate(audit.targetDate)}</TableCell>
                      <TableCell className="text-sm">{audit.assignment?.team?.teamName || '-'}</TableCell>
                      <TableCell>
                        <Link href={`/admin/audits/${audit._id || audit.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs">View</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents">
          <EmptyState title="No documents" description="Documents uploaded during audits will appear here" />
        </TabsContent>

        <TabsContent value="activity">
          <EmptyState title="No activity" description="Activity log for this hospital will appear here" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
