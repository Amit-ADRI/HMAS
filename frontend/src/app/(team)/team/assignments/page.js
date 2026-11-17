'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { ClipboardCheck, Eye, MapPin, Calendar } from 'lucide-react';

const STATUS_TABS = [
  { label: 'New', value: 'PENDING' },
  { label: 'Accepted', value: 'ACCEPTED' },
  { label: 'Reassignment requested', value: 'REASSIGNMENT_REQUESTED' },
];

function AssignmentCard({ assignment }) {
  const aId = assignment._id || assignment.id;
  const audit = assignment.audit || {};
  const hospital = audit.hospital || assignment.hospital || {};

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-medium text-gray-500">{audit.auditNumber || '-'}</span>
              <StatusBadge status={audit.status || assignment.status} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{hospital.facilityName || 'Hospital'}</h3>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              {hospital.district && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{hospital.district}</span>
              )}
              {(assignment.scheduledDate || audit.targetDate) && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(assignment.scheduledDate || audit.targetDate)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <Link href={`/team/assignments/${aId}`}>
              <Button size="sm" variant="outline" className="h-8">
                <Eye className="w-3.5 h-3.5 mr-1" />View
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TeamAssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('PENDING');
  const [counts, setCounts] = useState({});
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ status: activeTab });
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      const [res, allRes] = await Promise.all([
        api.get(`/v1/assignments/my-assignments?${params}`),
        api.get('/v1/assignments/my-assignments'),
      ]);
      setAssignments(res.assignments || []);
      const nextCounts = {};
      (allRes.assignments || []).forEach((assignment) => {
        nextCounts[assignment.status] = (nextCounts[assignment.status] || 0) + 1;
      });
      setCounts(nextCounts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, fromDate, toDate]);

  useAutoRefresh(fetchAssignments);

  return (
    <div>
      <PageHeader title="My Assignments" description="Accept the hospital audit, start it, mark it as suspicious or genuine, then submit the same-day report." />

      {/* Tabs + date filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, borderBottom: '1px solid var(--line)', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{
                padding: '10px 18px', fontSize: 13.5, whiteSpace: 'nowrap',
                borderBottom: activeTab === tab.value ? '2px solid var(--teal)' : '2px solid transparent',
                color: activeTab === tab.value ? 'var(--teal-deep)' : 'var(--ink-soft)',
                fontWeight: activeTab === tab.value ? 600 : 400,
                background: 'none', border: 'none',
                borderBottom: activeTab === tab.value ? '2px solid var(--teal)' : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {tab.label}
              {counts[tab.value] > 0 && (
                <span style={{ marginLeft: 8, background: 'var(--line-soft)', color: 'var(--ink)', fontSize: 11, borderRadius: 99, padding: '2px 7px', fontWeight: 600 }}>
                  {counts[tab.value]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 12.5, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--ink)', outline: 'none' }} />
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>to</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 12.5, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--ink)', outline: 'none' }} />
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate(''); }}
              style={{ fontSize: 11, color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      ) : assignments.length === 0 ? (
        <EmptyState
          title="No assignments"
          description={`No assignments in "${STATUS_TABS.find((t) => t.value === activeTab)?.label}" status`}
          icon={ClipboardCheck}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((assignment) => (
            <AssignmentCard key={assignment._id || assignment.id} assignment={assignment} />
          ))}
        </div>
      )}
    </div>
  );
}
