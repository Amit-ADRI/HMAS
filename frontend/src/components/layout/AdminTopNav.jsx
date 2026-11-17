'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';

const BREADCRUMBS = {
  '/admin/dashboard': 'Dashboard',
  '/admin/hospitals': 'Hospitals',
  '/admin/hospitals/import': 'Import Hospitals',
  '/admin/audits': 'Audits',
  '/admin/audits/create': 'Create Audit',
  '/admin/assignments': 'Assignments',
  '/admin/reassignments': 'Reassignment Requests',
  '/admin/teams': 'Teams',
  '/admin/reviews': 'Reviews',
  '/admin/reports': 'Reports',
  '/admin/notifications': 'Notifications',
  '/admin/users': 'Users',
  '/admin/settings': 'Settings',
  '/admin/audit-logs': 'Audit Logs',
};

export function AdminTopNav() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const title = BREADCRUMBS[pathname] || 'HAMS';

  useEffect(() => {
    api.get('/v1/notifications/unread-count')
      .then(d => setUnread(d.unreadCount || d.count || 0))
      .catch(() => {});
  }, [pathname]);

  return (
    <div className="topnav">
      <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{title}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/admin/notifications" style={{ position: 'relative', color: 'var(--ink-soft)', display: 'flex' }}>
          <Bell size={18} />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: -5, right: -6,
              background: 'var(--rose)', color: '#fff',
              fontSize: 10, fontWeight: 700,
              borderRadius: '50%', width: 16, height: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{unread > 9 ? '9+' : unread}</span>
          )}
        </a>
      </div>
    </div>
  );
}
