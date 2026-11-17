'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Save, UserRound } from 'lucide-react';

export default function TeamProfilePage() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: '', mobile: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { try { const response = await api.get('/v1/auth/me'); const profile = response.user || response; setUser(profile); setForm({ name: profile.name || '', mobile: profile.mobile || '' }); } catch (error) { toast({ title: 'Could not load profile', description: error.message, variant: 'destructive' }); } finally { setLoading(false); } }, [toast]);
  useEffect(() => { load(); }, [load]);
  const save = async () => { if (!form.name.trim()) return toast({ title: 'Name is required', variant: 'destructive' }); setSaving(true); try { const response = await api.put('/v1/auth/profile', form); setUser(response.user || user); toast({ title: 'Profile updated' }); } catch (error) { toast({ title: 'Could not update profile', description: error.message, variant: 'destructive' }); } finally { setSaving(false); } };
  if (loading) return <LoadingSpinner />;
  return <div><PageHeader title="My Profile" description="Manage your Team Lead contact details." /><Card className="max-w-2xl"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4" />Account details</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>User ID</Label><Input value={user?.userId || ''} disabled /></div><div className="space-y-2"><Label>Role</Label><Input value="Team Lead" disabled /></div></div><div className="space-y-2"><Label>Email</Label><Input value={user?.email || ''} disabled /></div><div className="space-y-2"><Label>Full name</Label><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div><div className="space-y-2"><Label>Mobile number</Label><Input value={form.mobile} onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value }))} /></div><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : <><Save className="mr-2 h-4 w-4" />Save profile</>}</Button></CardContent></Card></div>;
}
