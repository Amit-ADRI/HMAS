'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Eye, Loader2, Users, Trash2 } from 'lucide-react';

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', leadId: '', members: [] });
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, uRes] = await Promise.all([
        api.get('/v1/teams?withWorkload=true'),
        api.get('/v1/users?role=TEAM_LEAD&limit=100'),
      ]);
      setTeams(tRes.teams || []);
      setUsers(uRes.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.name || !form.leadId) {
      toast({ title: 'Name and Team Lead are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/v1/teams', {
        teamName: form.name,
        teamLead: form.leadId,
        members: form.members.filter((member) => member.name.trim()),
      });
      toast({ title: 'Team created successfully' });
      setCreateOpen(false);
      setForm({ name: '', leadId: '', members: [] });
      fetchData();
    } catch (err) {
      toast({ title: 'Failed to create team', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTeam = async (team) => {
    if (!window.confirm(`Delete team '${team.teamName}'? This cannot be undone.`)) return;
    try { await api.delete(`/v1/teams/${team._id || team.id}`); toast({ title: 'Team deleted' }); fetchData(); }
    catch (err) { toast({ title: 'Could not delete team', description: err.message, variant: 'destructive' }); }
  };
  const getAvailabilityBadge = (team) => {
    const availability = team.availability || 'Unavailable';
    const styles = {
      Available: 'bg-green-100 text-green-700 border-0 px-2 py-1`',
      'Partially Available': 'bg-blue-100 text-blue-700 border-0 px-2 py-1`',
      Busy: 'bg-amber-100 text-amber-700 border-0 px-2 py-1`',
      'On Audit': 'bg-indigo-100 text-indigo-700 border-0 px-2 py-1`',
      'On Leave': 'bg-orange-100 text-orange-700 border-0 px-2 py-1`',
      Unavailable: 'bg-gray-100 text-gray-600 border-0 px-2 py-1`',
      Inactive: 'bg-gray-100 text-gray-600 border-0 px-2 py-1`',
    };
    return <Badge className={styles[availability] || styles.Unavailable}>{availability}</Badge>;
  };

  return (
    <div>
      <PageHeader title="Teams" description={`${teams.length} teams`}>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />Create Team
        </Button>
      </PageHeader>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      ) : teams.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description="Create a team to start assigning audits"
          icon={Users}
          action={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" />Create Team</Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Name</TableHead>
                <TableHead>Team Lead</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Upcoming</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => {
                const tId = team._id || team.id;
                return (
                  <TableRow key={tId}>
                    <TableCell className="font-semibold">{team.teamName}</TableCell>
                    <TableCell className="text-sm">{team.teamLead?.name || '-'}</TableCell>
                    <TableCell className="text-sm">{team.memberCount || team.members?.length || 0}</TableCell>
                    <TableCell className="text-sm">{team.upcomingAudits || 0}</TableCell>
                    <TableCell>{getAvailabilityBadge(team)}</TableCell>
                    <TableCell className="flex  items-center ">
                      <Link href={`/admin/teams/${tId}`}>
                        <Button size="icon" variant="ghost"><Eye className="w-3.5 h-3.5" /></Button>
                      </Link>
                      <Button size="icon" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => deleteTeam(team)} title="Delete team"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Team Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Team Name *</Label>
              <Input
                placeholder="e.g., North Zone Audit Team"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>Team members</Label><Button type="button" variant="outline" size="sm" onClick={() => setForm((p) => ({ ...p, members: [...p.members, { name: '', email: '', mobile: '', role: 'Auditor' }] }))}>Add member</Button></div>
              {form.members.map((member, index) => (
                <div key={index} className="grid grid-cols-2 gap-2 rounded border p-2">
                  <Input placeholder="Member name" value={member.name} onChange={(e) => setForm((p) => ({ ...p, members: p.members.map((item, i) => i === index ? { ...item, name: e.target.value } : item) }))} />
                  <Input placeholder="Role (e.g. Auditor)" value={member.role} onChange={(e) => setForm((p) => ({ ...p, members: p.members.map((item, i) => i === index ? { ...item, role: e.target.value } : item) }))} />
                  <Input placeholder="Email" value={member.email} onChange={(e) => setForm((p) => ({ ...p, members: p.members.map((item, i) => i === index ? { ...item, email: e.target.value } : item) }))} />
                  <div className="flex gap-2"><Input placeholder="Mobile" value={member.mobile} onChange={(e) => setForm((p) => ({ ...p, members: p.members.map((item, i) => i === index ? { ...item, mobile: e.target.value } : item) }))} /><Button type="button" variant="ghost" size="sm" onClick={() => setForm((p) => ({ ...p, members: p.members.filter((_, i) => i !== index) }))}>Remove</Button></div>
                </div>
              ))}
              <p className="text-xs text-gray-500">Members are recorded on the team. A team lead is a login-enabled user selected above.</p>
            </div>
            <div className="space-y-2">
              <Label>Team Lead *</Label>
              <Select value={form.leadId} onValueChange={(v) => setForm((p) => ({ ...p, leadId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team lead" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u._id || u.id} value={u._id || u.id}>{u.name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
