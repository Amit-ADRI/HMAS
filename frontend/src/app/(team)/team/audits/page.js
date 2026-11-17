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
import { ClipboardList, Eye, MapPin, Calendar } from 'lucide-react';

const STATUS_TABS = [
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Returned', value: 'RETURNED' },
  { label: 'Completed', value: 'COMPLETED,APPROVED,CLOSED' },
];

export default function TeamAuditsPage() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('IN_PROGRESS');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ status: activeTab });
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      const res = await api.get(`/v1/audits?${params}`);
      setAudits(res.audits || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, fromDate, toDate]);

  useAutoRefresh(fetchAudits);

  return (
    <div>
      <PageHeader title="My Audits" description="Audits assigned to your team" />

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
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
          <input
            type="date" value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 12.5, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--ink)', outline: 'none' }}
          />
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>to</span>
          <input
            type="date" value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 12.5, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--ink)', outline: 'none' }}
          />
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
      ) : audits.length === 0 ? (
        <EmptyState
          title="No audits"
          description={`No audits in "${STATUS_TABS.find((t) => t.value === activeTab)?.label}" status`}
          icon={ClipboardList}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {audits.map((audit) => {
            const aId = audit._id || audit.id;
            const hospital = audit.hospital || {};
            return (
              <Card key={aId} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono font-medium text-gray-500">{audit.auditNumber}</span>
                        <StatusBadge status={audit.status} />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">{hospital.facilityName || '-'}</h3>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        {hospital.district && (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{hospital.district}</span>
                        )}
                        {audit.targetDate && (
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(audit.targetDate)}</span>
                        )}
                      </div>
                      {audit.status === 'RETURNED' && audit.report?.versions?.[audit.report.currentVersion - 1]?.reviewComments && (
                        <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                          <strong>Return reason:</strong> {audit.report.versions[audit.report.currentVersion - 1].reviewComments}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Link href={`/team/audits/${aId}`}>
                        <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700">
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          {audit.status === 'IN_PROGRESS' ? 'Continue' : 'View'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
