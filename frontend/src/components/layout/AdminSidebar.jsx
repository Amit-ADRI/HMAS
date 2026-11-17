'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Building2, ClipboardList, Users, FileCheck,
  BarChart3, Bell, Settings, ScrollText, UserCog, GitBranch
} from 'lucide-react';

const nav = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  {
    label: 'Hospitals', icon: Building2,
    children: [
      { label: 'All Hospitals', href: '/admin/hospitals' },
    ]
  },
  {
    label: 'Audits', icon: ClipboardList,
    children: [
      { label: 'All Audits', href: '/admin/audits' },
      { label: 'Create Audit', href: '/admin/audits/create' },
      { label: 'Assignments', href: '/admin/assignments' },
      { label: 'Reassignment Requests', href: '/admin/reassignments' },
    ]
  },
  { label: 'Teams', href: '/admin/teams', icon: Users },
  { label: 'Reviews', href: '/admin/reviews', icon: FileCheck },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell },
  { label: 'Users', href: '/admin/users', icon: UserCog },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="rail">
      <div className="rail-brand">
        HAMS
        <span>Hospital Audit Management</span>
      </div>

      <nav className="rail-nav">
        {nav.map((item) => {
          if (item.children) {
            const anyActive = item.children.some(c => isActive(c.href));
            return (
              <div key={item.label}>
                <div className={`rail-group-label ${anyActive ? 'parent-active' : ''}`}>
                  <item.icon size={12} style={{ flexShrink: 0 }} />
                  {item.label}
                </div>
                <div className="rail-group-children">
                  {item.children.map(child => (
                    <Link key={child.href} href={child.href}
                      className={`rail-sub-item ${isActive(child.href) ? 'active' : ''}`}>
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <Link key={item.href} href={item.href}
              className={`rail-item ${isActive(item.href) ? 'active' : ''}`}>
              <item.icon size={15} style={{ flexShrink: 0, opacity: isActive(item.href) ? 1 : 0.65 }} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="rail-foot">
        <div style={{ fontWeight: 600, color: '#cde8df', marginBottom: 2, fontSize: 13 }}>{user?.name}</div>
        <div style={{ marginBottom: 10, fontSize: 11, color: '#5a8a7a', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          {user?.role?.replace('_', ' ')}
        </div>
        <button
          onClick={logout}
          style={{ background: 'none', border: 'none', color: '#5a8a7a', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit', transition: 'color 0.12s' }}
          onMouseEnter={e => e.target.style.color = '#9dc2b5'}
          onMouseLeave={e => e.target.style.color = '#5a8a7a'}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
