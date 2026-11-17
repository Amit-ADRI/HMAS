'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { formatDate, formatDateTime } from '@/lib/utils';
import { ArrowLeft, Users, ClipboardList, Activity, Pencil } from 'lucide-react';

export default function TeamDetailPage() {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ teamName: '', teamLead: '', availability: 'Available' });
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tRes, aRes, uRes] = await Promise.all([
          api.get(`/v1/teams/${id}`),
          api.get(`/v1/teams/${id}/assignments`).catch(() => ({ assignments: [] })),
          api.get('/v1/users?role=TEAM_LEAD&limit=100').catch(() => ({ users: [] })),
        ]);
        // Attach activeAssignments count (array length from response root) onto the team object
        const teamObj = tRes.team;
        if (teamObj && Array.isArray(tRes.activeAssignments)) {
          teamObj.activeAssignments = tRes.activeAssignments.length;
        }
        setTeam(teamObj);
        setAssignments(aRes.assignments || []);
        setUsers(uRes.users || []);
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
  if (!team) return <EmptyState title="Team not found" />;

  const members = team.members || [];
  const openEdit = () => {
    setEditForm({ teamName: team.teamName || '', teamLead: team.teamLead?._id || team.teamLead || '', availability: team.availability || 'Available' });
    setEditOpen(true);
  };
  const saveTeam = async () => {
    if (!editForm.teamName || !editForm.teamLead) return toast({ title: 'Team name and lead are required', variant: 'destructive' });
    setSaving(true);
    try {
      const res = await api.put(`/v1/teams/${id}`, editForm);
      setTeam(res.team); setEditOpen(false); toast({ title: 'Team updated' });
    } catch (err) { toast({ title: 'Could not update team', description: err.message, variant: 'destructive' }); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title={team.teamName} description={`Team ID: ${team.teamId || id}`}>
        <Button variant="outline" size="sm" onClick={openEdit}><Pencil className="w-4 h-4 mr-2" />Edit team</Button>
        <Link href="/admin/teams">
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </Link>
      </PageHeader>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Members</p>
            <p className="text-2xl font-bold">{members.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Active Audits</p>
            <p className="text-2xl font-bold text-purple-600">{team.activeAssignments || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total Assignments</p>
            <p className="text-2xl font-bold">{assignments.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="mb-6">
          <TabsTrigger value="info"><Users className="w-4 h-4 mr-2" />Team Info</TabsTrigger>
          <TabsTrigger value="assignments"><ClipboardList className="w-4 h-4 mr-2" />Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Team Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <span className="text-gray-500 w-32">Team Name:</span>
                  <span className="font-medium">{team.teamName}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 w-32">Team Lead:</span>
                  <span className="font-medium">{team.teamLead?.name || '-'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 w-32">Lead Email:</span>
                  <span className="font-medium">{team.teamLead?.email || '-'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 w-32">Created:</span>
                  <span className="font-medium">{formatDate(team.createdAt)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 w-32">Status:</span>
                  <Badge variant={team.isActive !== false ? 'default' : 'secondary'}>
                    {team.isActive !== false ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Members ({members.length})</CardTitle></CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No members yet</p>
                ) : (
                  <div className="space-y-3">
                    {members.map((m, i) => {
                      const member = m.user || m;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-xs font-semibold">
                            {member.name?.charAt(0) || 'M'}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{member.name || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{member.email || '-'}</p>
                          </div>
                          <Badge variant="outline" className="ml-auto text-xs">
                            {m.role || 'Member'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assignments">
          {assignments.length === 0 ? (
            <EmptyState title="No assignments" description="This team has no assignment history" />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Audit Number</TableHead>
                    <TableHead>Hospital</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned Date</TableHead>
                    <TableHead>Scheduled Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a._id || a.id}>
                      <TableCell className="font-mono text-xs">{a.audit?.auditNumber || '-'}</TableCell>
                      <TableCell className="text-sm">{a.audit?.hospital?.facilityName || '-'}</TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                      <TableCell className="text-sm">{formatDateTime(a.assignedAt)}</TableCell>
                      <TableCell className="text-sm">{formatDate(a.scheduledDate)}</TableCell>
                      <TableCell>
                        {a.audit && (
                          <Link href={`/admin/audits/${a.audit._id || a.auditId}`}>
                            <Button size="sm" variant="ghost" className="h-7 text-xs">View</Button>
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent><DialogHeader><DialogTitle>Edit team</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Team name</Label><Input value={editForm.teamName} onChange={(e) => setEditForm((p) => ({ ...p, teamName: e.target.value }))} /></div><div className="space-y-2"><Label>Team lead</Label><Select value={editForm.teamLead} onValueChange={(value) => setEditForm((p) => ({ ...p, teamLead: value }))}><SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger><SelectContent>{users.map((user) => <SelectItem key={user._id || user.id} value={user._id || user.id}>{user.name} ({user.email})</SelectItem>)}</SelectContent></Select><p className="text-xs text-gray-500">The chosen lead must be a Team Lead user and cannot lead another active team.</p></div><div className="space-y-2"><Label>Availability</Label><Select value={editForm.availability} onValueChange={(value) => setEditForm((p) => ({ ...p, availability: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Available', 'Partially Available', 'Busy', 'On Audit', 'On Leave', 'Unavailable', 'Inactive'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={saveTeam} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
