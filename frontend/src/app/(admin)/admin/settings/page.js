'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Bell, Building2, Loader2, Save } from 'lucide-react';

const DEFAULT_GENERAL = { organizationName: 'Hospital Audit Management System', supportEmail: '', supportPhone: '' };
const DEFAULT_NOTIFICATIONS = { assignmentAlerts: true, reassignmentAlerts: true, reportAlerts: true };

export default function SettingsPage() {
  const { toast } = useToast();
  const [general, setGeneral] = useState(DEFAULT_GENERAL);
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const response = await api.get('/v1/settings');
      const values = response.settingsMap || {};
      setGeneral({ ...DEFAULT_GENERAL, ...(values.generalSettings || {}) });
      setNotifications({ ...DEFAULT_NOTIFICATIONS, ...(values.notificationSettings || {}) });
    } catch (error) {
      toast({ title: 'Could not load settings', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const save = async (key, value) => {
    setSaving(key);
    try {
      await api.put(`/v1/settings/${key}`, { value });
      toast({ title: 'Settings saved' });
    } catch (error) {
      toast({ title: 'Could not save settings', description: error.message, variant: 'destructive' });
    } finally { setSaving(''); }
  };

  if (loading) return <LoadingSpinner />;

  return <div><PageHeader title="Settings" description="Manage basic system and notification preferences." />
    <div className="max-w-3xl space-y-6">
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />General</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="space-y-2"><Label>Organization name</Label><Input value={general.organizationName} onChange={(event) => setGeneral((current) => ({ ...current, organizationName: event.target.value }))} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Support email</Label><Input type="email" value={general.supportEmail} onChange={(event) => setGeneral((current) => ({ ...current, supportEmail: event.target.value }))} placeholder="support@example.gov.in" /></div><div className="space-y-2"><Label>Support phone</Label><Input value={general.supportPhone} onChange={(event) => setGeneral((current) => ({ ...current, supportPhone: event.target.value }))} placeholder="Contact number" /></div></div>
        <Button onClick={() => save('generalSettings', general)} disabled={saving === 'generalSettings'}>{saving === 'generalSettings' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save general settings</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" />Notifications</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-gray-500">Choose which operational events should generate system notifications for administrators.</p>
        {[['assignmentAlerts', 'New audit assignments'], ['reassignmentAlerts', 'Reassignment requests'], ['reportAlerts', 'Submitted audit reports']].map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{label}</span><input type="checkbox" className="h-4 w-4" checked={Boolean(notifications[key])} onChange={(event) => setNotifications((current) => ({ ...current, [key]: event.target.checked }))} /></label>)}
        <Button onClick={() => save('notificationSettings', notifications)} disabled={saving === 'notificationSettings'}>{saving === 'notificationSettings' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save notification settings</Button>
      </CardContent></Card>
    </div>
  </div>;
}
