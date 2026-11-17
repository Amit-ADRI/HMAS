'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate } from '@/lib/utils';
import { Search, Upload, Plus } from 'lucide-react';

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());

  const limit = 25;

  const fetchHospitals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit, ...(search && { search }), ...(district && { district }) });
      const d = await api.get(`/v1/hospitals?${params}`);
      setHospitals(d.hospitals || d.data || []);
      setTotal(d.total || 0);
    } catch {}
    setLoading(false);
  }, [page, search, district]);

  useEffect(() => { fetchHospitals(); }, [fetchHospitals]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === hospitals.length) setSelected(new Set());
    else setSelected(new Set(hospitals.map(h => h._id)));
  };

  const pages = Math.ceil(total / limit);

  return (
    <div>
      <div className="stage-head">
        <div className="eyebrow">Hospital Master</div>
        <h1>Hospitals</h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14.5, margin: 0 }}>
          {total.toLocaleString()} hospitals in the master list.
        </p>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)' }} />
          <input
            type="search"
            placeholder="Search hospitals..."
            className="search-input"
            style={{ paddingLeft: 30 }}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <input
          type="text"
          placeholder="District"
          value={district}
          onChange={e => { setDistrict(e.target.value); setPage(1); }}
          style={{ padding: '8px 11px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 13.5, background: 'var(--white)', fontFamily: 'inherit', outline: 'none', width: 140 }}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Link href="/admin/hospitals/import" className="btn btn-ghost btn-sm">
            <Upload size={13} /> Import
          </Link>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ background: 'var(--teal-deep)', color: '#eaf3ef', padding: '10px 16px', borderRadius: 3, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16, fontSize: 13.5 }}>
          <span>{selected.size} selected</span>
          <Link href={`/admin/audits/create?hospitals=${[...selected].join(',')}`}
            className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
            Create Audit
          </Link>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }} onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {/* Ledger */}
      <div className="ledger-title-row">
        <h2>Hospital list</h2>
        <span className="count">{total} total · page {page}/{pages || 1}</span>
      </div>
      <div className="ledger">
        <div className="ledger-row head" style={{ gridTemplateColumns: '32px 140px 1fr 120px 60px 110px 80px' }}>
          <input type="checkbox" onChange={toggleAll} checked={selected.size === hospitals.length && hospitals.length > 0} />
          <span>Facility ID</span><span>Hospital</span><span>District</span><span>Beds</span><span>Audit status</span><span></span>
        </div>
        {loading && <div className="empty-note">Loading...</div>}
        {!loading && hospitals.length === 0 && <div className="empty-note">No hospitals found.</div>}
        {!loading && hospitals.map((h, i) => (
          <div key={h._id} className="ledger-row" style={{ gridTemplateColumns: '32px 140px 1fr 120px 60px 110px 80px' }}>
            <input type="checkbox" checked={selected.has(h._id)} onChange={() => toggleSelect(h._id)} />
            <span className="mono">{h.facilityId}</span>
            <div>
              <div className="row-title">{h.facilityName}</div>
              <div className="row-meta">{h.facilityType} · {h.hospitalType}</div>
            </div>
            <span style={{ fontSize: 13.5 }}>{h.district}</span>
            <span className="tabnum">{h.totalBedStrength || '—'}</span>
            <StatusBadge status={h.lastAuditResult || 'PLANNED'} />
            <div className="row-action">
              <Link href={`/admin/hospitals/${h._id}`} className="link-btn">
                View
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span style={{ padding: '0 8px' }}>Page {page} of {pages || 1}</span>
        <button className="page-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}
