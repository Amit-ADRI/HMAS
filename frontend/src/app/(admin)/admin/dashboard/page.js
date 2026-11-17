'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Plus, Upload, AlertTriangle, Clock, RotateCcw, ChevronRight } from 'lucide-react';

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function AlertStrip({ stats }) {
  const alerts = [];
  if (stats.overdue > 0)
    alerts.push({ color: 'var(--rose)', label: `${stats.overdue} overdue audit${stats.overdue > 1 ? 's' : ''}`, href: '/admin/audits?status=overdue', Icon: Clock });
  if (stats.reassignmentRequests > 0)
    alerts.push({ color: 'var(--amber)', label: `${stats.reassignmentRequests} reassignment request${stats.reassignmentRequests > 1 ? 's' : ''}`, href: '/admin/reassignments', Icon: RotateCcw });
  if (stats.unassigned > 0)
    alerts.push({ color: '#4f7cc4', label: `${stats.unassigned} audit${stats.unassigned > 1 ? 's' : ''} need assignment`, href: '/admin/audits?status=UNASSIGNED', Icon: AlertTriangle });

  if (alerts.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
      {alerts.map(({ color, label, href, Icon }) => (
        <Link key={href} href={href} style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--white)', border: `1px solid ${color}`,
            borderLeft: `3px solid ${color}`,
            padding: '8px 14px', fontSize: 12.5, color, fontWeight: 500,
            transition: 'background 0.1s', cursor: 'pointer',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--paper)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--white)'}
          >
            <Icon size={13} />
            {label}
            <ChevronRight size={12} style={{ opacity: 0.6 }} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function PipelineBar({ stats }) {
  const stages = [
    { label: 'Planned', key: 'planned', color: '#94a3b8' },
    { label: 'Unassigned', key: 'unassigned', color: '#94a3b8' },
    { label: 'Assigned', key: 'assigned', color: '#7c9bcc' },
    { label: 'Awaiting Ack', key: 'awaitingAck', color: '#f59e0b' },
    { label: 'Accepted', key: 'accepted', color: '#4ea894' },
    { label: 'Scheduled', key: 'scheduled', color: '#4f7cc4' },
    { label: 'In Progress', key: 'inProgress', color: '#4f7cc4' },
    { label: 'Completed', key: 'completed', color: '#4ea894' },
    { label: 'Submitted', key: 'submitted', color: '#f59e0b' },
    { label: 'Under Review', key: 'underReview', color: '#f59e0b' },
    { label: 'Returned', key: 'returned', color: '#e26d5a' },
    { label: 'Approved', key: 'approved', color: '#2d8c74' },
    { label: 'Closed', key: 'closed', color: '#1e6b57' },
  ];

  const total = stages.reduce((s, st) => s + (stats[st.key] || 0), 1);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Audit Pipeline — {stats.totalAudits || 0} total
      </div>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 8, borderRadius: 2, overflow: 'hidden', background: 'var(--line)', marginBottom: 12 }}>
        {stages.map(st => {
          const count = stats[st.key] || 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div key={st.key} title={`${st.label}: ${count}`}
              style={{ width: `${pct}%`, background: st.color, minWidth: count > 0 ? 3 : 0, transition: 'width 0.3s' }} />
          );
        })}
      </div>
      {/* Stage grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 0' }}>
        {stages.map(st => {
          const count = stats[st.key] || 0;
          return (
            <div key={st.key} style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 18, fontSize: 12, color: count > 0 ? 'var(--ink)' : 'var(--ink-soft)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color, flexShrink: 0, opacity: count > 0 ? 1 : 0.35 }} />
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: count > 0 ? 600 : 400 }}>{count}</span>
              <span style={{ color: 'var(--ink-soft)' }}>{st.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyChart({ monthly }) {
  if (monthly.length === 0) return null;
  const maxVal = Math.max(...monthly.map(m => m.count), 1);
  const currentMonth = `${MONTH_SHORT[new Date().getMonth()]} ${new Date().getFullYear()}`;

  return (
    <div style={{ background: 'var(--paper)', padding: '20px 24px', marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 20 }}>Monthly Audit Volume</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 120 }}>
        {monthly.map((m, i) => {
          const pct = (m.count / maxVal) * 100;
          const isCurrent = m.month === currentMonth;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: isCurrent ? 'var(--teal-deep)' : 'var(--ink-soft)', fontWeight: isCurrent ? 600 : 400 }}>
                {m.count > 0 ? m.count : ''}
              </div>
              <div style={{
                width: '100%', background: isCurrent ? 'var(--teal)' : 'var(--teal-deep)',
                opacity: isCurrent ? 1 : 0.35,
                height: `${Math.max(pct, m.count > 0 ? 6 : 0)}%`,
                minHeight: m.count > 0 ? 4 : 2,
                borderRadius: '2px 2px 0 0', transition: 'height 0.3s'
              }} />
              <div style={{ fontSize: 9.5, color: isCurrent ? 'var(--teal-deep)' : 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', fontWeight: isCurrent ? 600 : 400 }}>
                {m.month?.split(' ')[0]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DistrictChart({ districtWise }) {
  if (!districtWise || districtWise.length === 0) return null;
  const maxVal = Math.max(...districtWise.map(d => d.count), 1);
  const top8 = districtWise.slice(0, 8);

  return (
    <div style={{ background: 'var(--paper)', padding: '20px 24px', marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Top Districts by Audit Count</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {top8.map((d, i) => {
          const pct = (d.count / maxVal) * 100;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 32px', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.district}>
                {d.district || '—'}
              </div>
              <div style={{ height: 6, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--teal)', opacity: 0.6 + (i === 0 ? 0.4 : 0), borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-soft)', textAlign: 'right' }}>{d.count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  useEffect(() => {
    const query = new URLSearchParams();
    if (selectedDate) query.set('date', selectedDate);
    else if (selectedMonth) query.set('month', selectedMonth);
    else if (selectedYear) query.set('year', selectedYear);
    setLoading(true);
    api.get(`/v1/dashboard/admin${query.size ? `?${query}` : ''}`)
      .then(d => setData(d.data || d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedDate, selectedMonth, selectedYear]);

  const stats = data?.stats || {};
  const teams = data?.teamWorkload || [];
  const monthly = data?.monthlyTrend || [];
  const districtWise = data?.districtWise || [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div className="eyebrow">Admin</div>
          <h1 style={{ margin: '2px 0 4px', fontSize: 26 }}>Dashboard</h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13.5, margin: 0, lineHeight: 1.5 }}>
            Live overview of the entire hospital audit operation.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginTop: 4 }}>
          <Link href="/admin/hospitals/import" style={{ textDecoration: 'none' }}>
            <button className="btn" style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5,
              background: 'var(--paper)', border: '1px solid var(--line-soft)',
              color: 'var(--ink-soft)', padding: '7px 14px', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'border-color 0.1s, color 0.1s'
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.color = 'var(--teal-deep)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line-soft)'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
            >
              <Upload size={13} />
              Import Hospitals
            </button>
          </Link>
          <Link href="/admin/audits/create" style={{ textDecoration: 'none' }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5,
              background: 'var(--teal)', border: 'none', color: '#fff',
              padding: '7px 16px', cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: 600, letterSpacing: '0.01em', transition: 'opacity 0.1s'
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Plus size={14} />
              Create Audit
            </button>
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 10, marginBottom: 24, padding: 14, background: 'var(--paper)', border: '1px solid var(--line-soft)' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginRight: 4, paddingBottom: 8 }}>Filter audit statistics:</div>
        <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--ink-soft)' }}>Date
          <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedMonth(''); setSelectedYear(''); }} style={{ height: 32, border: '1px solid var(--line)', background: '#fff', padding: '0 8px', fontFamily: 'inherit', fontSize: 12 }} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--ink-soft)' }}>Month
          <input type="month" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setSelectedDate(''); setSelectedYear(''); }} style={{ height: 32, border: '1px solid var(--line)', background: '#fff', padding: '0 8px', fontFamily: 'inherit', fontSize: 12 }} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--ink-soft)' }}>Year
          <select value={selectedYear} onChange={(e) => { setSelectedYear(e.target.value); setSelectedDate(''); setSelectedMonth(''); }} style={{ height: 32, minWidth: 92, border: '1px solid var(--line)', background: '#fff', padding: '0 8px', fontFamily: 'inherit', fontSize: 12 }}>
            <option value="">All years</option>{Array.from({ length: 6 }, (_, index) => String(new Date().getFullYear() - index)).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        {(selectedDate || selectedMonth || selectedYear) && <button type="button" onClick={() => { setSelectedDate(''); setSelectedMonth(''); setSelectedYear(''); }} style={{ height: 32, border: '1px solid var(--line)', background: '#fff', padding: '0 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>}
      </div>

      {/* Alert strip */}
      {!loading && <AlertStrip stats={stats} />}

      {loading ? (
        <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '40px 0' }}>Loading dashboard...</div>
      ) : (
        <>
          {/* Primary KPI tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'var(--line)', marginBottom: 1 }}>
            {[
              { num: stats.totalHospitals ?? 0, lbl: 'Total hospitals', href: '/admin/hospitals' },
              { num: stats.totalAudits ?? 0, lbl: 'Total audits', href: '/admin/audits' },
              { num: stats.inProgress ?? 0, lbl: 'In progress', href: '/admin/audits?status=IN_PROGRESS' },
              { num: stats.submitted ?? 0, lbl: 'Awaiting review', href: '/admin/reviews', cls: (stats.submitted > 0 ? 'amber' : '') },
              { num: stats.closed ?? 0, lbl: 'Closed', href: '/admin/audits?status=CLOSED' },
            ].map(({ num, lbl, href, cls }) => (
              <Link key={lbl} href={href} style={{ textDecoration: 'none' }}>
                <div className="tile" style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--paper)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--white)'}
                >
                  <div className={`num ${cls || ''}`}>{num}</div>
                  <div className="lbl">{lbl}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Attention tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'var(--line)', marginBottom: 28 }}>
            {[
              { num: stats.unassigned ?? 0, lbl: 'Unassigned', href: '/admin/audits?status=UNASSIGNED', cls: stats.unassigned > 0 ? 'amber' : '' },
              { num: stats.awaitingAck ?? 0, lbl: 'Awaiting ack.', href: '/admin/audits?status=AWAITING_ACKNOWLEDGEMENT', cls: stats.awaitingAck > 0 ? 'amber' : '' },
              { num: stats.underReview ?? 0, lbl: 'Under review', href: '/admin/reviews', cls: '' },
              { num: stats.overdue ?? 0, lbl: 'Overdue', href: '/admin/audits?status=overdue', cls: stats.overdue > 0 ? 'rose' : '' },
              { num: stats.reassignmentRequests ?? 0, lbl: 'Reassignment req.', href: '/admin/reassignments', cls: stats.reassignmentRequests > 0 ? 'amber' : '' },
            ].map(({ num, lbl, href, cls }) => (
              <Link key={lbl} href={href} style={{ textDecoration: 'none' }}>
                <div className="tile" style={{ cursor: 'pointer', transition: 'background 0.1s', paddingTop: 10, paddingBottom: 10 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--paper)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--white)'}
                >
                  <div className={`num ${cls || ''}`} style={{ fontSize: 26 }}>{num}</div>
                  <div className="lbl">{lbl}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pipeline bar */}
          <div style={{ background: 'var(--paper)', padding: '18px 24px', marginBottom: 24 }}>
            <PipelineBar stats={stats} />
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--line)', marginBottom: 24 }}>
            <MonthlyChart monthly={monthly} />
            <DistrictChart districtWise={districtWise} />
          </div>

          {/* Team workload */}
          <div className="ledger-title-row">
            <h2>Team workload</h2>
            <Link href="/admin/teams" style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: 12, color: 'var(--teal-deep)', display: 'flex', alignItems: 'center', gap: 3 }}>
                {teams.length} teams <ChevronRight size={12} />
              </span>
            </Link>
          </div>
          <div className="ledger" style={{ marginBottom: 32 }}>
            <div className="ledger-row head" style={{ gridTemplateColumns: '1fr 64px 72px 1fr 90px' }}>
              <span>Team / Lead</span>
              <span style={{ textAlign: 'right' }}>Active</span>
              <span style={{ textAlign: 'right' }}>Upcoming</span>
              <span>Completion rate</span>
              <span>Availability</span>
            </div>
            {teams.length === 0 && (
              <div className="empty-note">No teams configured yet. <Link href="/admin/teams" style={{ color: 'var(--teal-deep)' }}>Add a team</Link></div>
            )}
            {teams.map(t => (
              <Link key={t._id} href={`/admin/teams`} style={{ textDecoration: 'none' }}>
                <div className="ledger-row" style={{ gridTemplateColumns: '1fr 64px 72px 1fr 90px', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--paper)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <div>
                    <div className="row-title">{t.teamName}</div>
                    <div className="row-meta">{t.teamLeadName || '—'}</div>
                  </div>
                  <span className="tabnum" style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{t.activeCount ?? 0}</span>
                  <span className="tabnum" style={{ textAlign: 'right', fontSize: 13 }}>{t.upcomingCount ?? 0}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="bar-track" style={{ flex: 1 }}>
                      <div className="bar-fill" style={{ width: `${t.completionRate || 0}%` }} />
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums', width: 30, textAlign: 'right' }}>
                      {t.completionRate || 0}%
                    </span>
                  </div>
                  <span className={`status-dot ${t.availability === 'Available' ? 'ACCEPTED' : t.availability === 'Busy' ? 'IN_PROGRESS' : 'pending'}`}>
                    <span className="sw" />{t.availability || 'Unknown'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
