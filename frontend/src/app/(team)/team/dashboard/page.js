'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, FileText, Play, RefreshCw, ShieldAlert, Users } from 'lucide-react';

const CLOSED = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CLOSED'];

function StatCard({ label, value, icon: Icon, tone = 'text-slate-700', href }) {
  const card = <Card className="transition-shadow hover:shadow-sm"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-slate-500">{label}</p><p className={`mt-1 text-3xl font-semibold ${tone}`}>{value}</p></div><div className="rounded-lg bg-slate-100 p-2.5"><Icon className={`h-5 w-5 ${tone}`} /></div></CardContent></Card>;
  return href ? <Link href={href}>{card}</Link> : card;
}

export default function TeamDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dashboardResponse, assignmentResponse] = await Promise.all([api.get('/v1/dashboard/team-lead'), api.get('/v1/assignments/my-assignments?limit=100')]);
      setDashboard(dashboardResponse.data || dashboardResponse);
      setAssignments(assignmentResponse.assignments || []);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useAutoRefresh(load);

  if (loading) return <LoadingSpinner fullPage />;
  const stats = dashboard?.stats || {};
  const active = assignments.filter((item) => item.audit && !CLOSED.includes(item.audit.status));
  const actionQueue = active.filter((item) => item.status === 'PENDING' || item.audit.status === 'IN_PROGRESS' || item.audit.status === 'ACCEPTED');
  const recent = assignments.filter((item) => item.audit && CLOSED.includes(item.audit.status)).slice(0, 6);
  const suspicious = assignments.filter((item) => item.audit?.isSuspicious === true);
  const targetToday = new Date().toISOString().slice(0, 10);
  const dueToday = active.filter((item) => item.audit?.targetDate?.slice?.(0, 10) === targetToday).length;
  const openHref = (item) => item.audit?.status === 'IN_PROGRESS' ? `/team/audits/${item.audit._id || item.audit.id}` : `/team/assignments/${item._id || item.id}`;
  const actionLabel = (item) => item.status === 'PENDING' ? 'Review assignment' : item.audit?.status === 'IN_PROGRESS' ? 'Continue audit' : 'Start audit';

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Team Lead workspace</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">Today&apos;s audit command centre</h1><p className="mt-1 text-sm text-slate-500">Accept assignments, complete the hospital assessment, and submit the same-day report.</p></div><Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</Button></div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Awaiting acceptance" value={stats.newAssignments || 0} icon={ClipboardCheck} tone="text-amber-600" href="/team/assignments" /><StatCard label="Active audits" value={active.length} icon={Play} tone="text-indigo-600" href="/team/audits" /><StatCard label="Due today" value={dueToday} icon={FileText} tone="text-slate-700" href="/team/audits" /><StatCard label="Overdue" value={stats.overdue || 0} icon={AlertTriangle} tone="text-red-600" href="/team/audits" /></div>

    {suspicious.length > 0 && <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 text-red-700" /><div><p className="font-semibold text-red-900">{suspicious.length} suspicious hospital{suspicious.length > 1 ? 's' : ''} recorded</p><p className="mt-0.5 text-sm text-red-700">Review the assessment and ensure the report is submitted before the day closes.</p></div></div><Link href="/team/audits"><Button size="sm" variant="outline" className="border-red-300 bg-white text-red-800">View audits</Button></Link></div>}

    <div className="grid gap-6 xl:grid-cols-3"><Card className="xl:col-span-2"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base">Action queue</CardTitle><p className="mt-1 text-sm text-slate-500">The items that need your attention now.</p></div><Link href="/team/assignments" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">All assignments</Link></CardHeader><CardContent>{actionQueue.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-green-600" /><p className="mt-3 font-medium text-slate-800">Your action queue is clear</p><p className="mt-1 text-sm text-slate-500">New assignments will appear here automatically.</p></div> : <div className="divide-y rounded-lg border">{actionQueue.slice(0, 8).map((item) => <div key={item._id || item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate font-medium text-slate-900">{item.hospital?.facilityName || 'Hospital'}</p><p className="mt-0.5 text-xs text-slate-500">{item.audit?.auditNumber} · {item.hospital?.district || 'Bihar'} · Target {formatDate(item.audit?.targetDate)}</p></div><div className="flex items-center gap-2"><StatusBadge status={item.audit?.status || item.status} /><Link href={openHref(item)}><Button size="sm">{actionLabel(item)}<ArrowRight className="ml-2 h-3.5 w-3.5" /></Button></Link></div></div>)}</div>}</CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Team status</CardTitle></CardHeader><CardContent className="space-y-4"><div><p className="text-xs uppercase tracking-wide text-slate-500">Current team</p><p className="mt-1 font-semibold text-slate-900">{dashboard?.team?.teamName || 'No active team'}</p></div><div className="flex items-center justify-between rounded-lg bg-slate-50 p-3"><span className="text-sm text-slate-600">Availability</span><span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">{dashboard?.team?.availability || 'Not set'}</span></div><div className="flex items-center justify-between border-b pb-3"><span className="text-sm text-slate-600">Team members</span><span className="font-semibold text-slate-900">{dashboard?.team?.memberCount || 0}</span></div><Link href="/team/members"><Button variant="outline" className="w-full">Manage team members</Button></Link></CardContent></Card></div>

    <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base">Recent report progress</CardTitle><p className="mt-1 text-sm text-slate-500">Completed and submitted audits from your team.</p></div><Link href="/team/audits" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View all audits</Link></CardHeader><CardContent>{recent.length === 0 ? <p className="py-5 text-center text-sm text-slate-500">No completed or submitted audits yet.</p> : <div className="divide-y rounded-lg border">{recent.map((item) => <div key={item._id || item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium text-slate-900">{item.hospital?.facilityName || 'Hospital'}</p><p className="mt-0.5 text-xs text-slate-500">{item.audit?.auditNumber} · {formatDate(item.audit?.targetDate)}</p></div><div className="flex items-center gap-3"><StatusBadge status={item.audit?.status} /><Link href={`/team/audits/${item.audit?._id || item.audit?.id}`}><Button size="sm" variant="outline">Open</Button></Link></div></div>)}</div>}</CardContent></Card>
  </div>;
}
