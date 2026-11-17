'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Save } from 'lucide-react';

const blankMember = () => ({ name: '', role: 'Auditor', email: '', mobile: '' });

export default function TeamMembersPage() {
  const [team, setTeam] = useState(null); const [members, setMembers] = useState([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const fetchTeam = useCallback(async () => { try { const res = await api.get('/v1/teams/my-team'); setTeam(res.team); setMembers(res.team?.members || []); } catch (error) { toast({ title: 'Could not load team', description: error.message, variant: 'destructive' }); } finally { setLoading(false); } }, [toast]);
  // This is an editor: background refresh must not overwrite unsaved typing.
  useEffect(() => { fetchTeam(); }, [fetchTeam]);
  const update = (index, field, value) => setMembers((current) => current.map((member, i) => i === index ? { ...member, [field]: value } : member));
  const save = async () => { setSaving(true); try { const res = await api.put('/v1/teams/my-team/members', { members }); setMembers(res.team.members || []); toast({ title: 'Team members saved' }); } catch (error) { toast({ title: 'Could not save members', description: error.message, variant: 'destructive' }); } finally { setSaving(false); } };
  if (loading) return <LoadingSpinner />;
  return <div><PageHeader title="Team Members" description={`${team?.teamName || 'My team'} — maintain the audit team roster`}><Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? 'Saving...' : 'Save members'}</Button></PageHeader><Card><CardContent className="pt-6 space-y-3">{members.map((member, index) => <div key={index} className="grid gap-2 rounded border p-3 md:grid-cols-5"><Input placeholder="Member name *" value={member.name} onChange={(e) => update(index, 'name', e.target.value)} /><Input placeholder="Role" value={member.role} onChange={(e) => update(index, 'role', e.target.value)} /><Input placeholder="Email" value={member.email} onChange={(e) => update(index, 'email', e.target.value)} /><Input placeholder="Mobile" value={member.mobile} onChange={(e) => update(index, 'mobile', e.target.value)} /><Button variant="ghost" className="text-red-600" onClick={() => setMembers((current) => current.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4 mr-2" />Remove</Button></div>)}<Button variant="outline" onClick={() => setMembers((current) => [...current, blankMember()])}><Plus className="w-4 h-4 mr-2" />Add team member</Button></CardContent></Card></div>;
}
