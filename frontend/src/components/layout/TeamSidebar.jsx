'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LayoutDashboard, ClipboardCheck, FileText, Users, Bell, User } from 'lucide-react';

const nav = [
  { label: 'Dashboard', href: '/team/dashboard', icon: LayoutDashboard },
  { label: 'My Assignments', href: '/team/assignments', icon: ClipboardCheck },
  { label: 'My Audits', href: '/team/audits', icon: FileText },
  { label: 'Team Members', href: '/team/members', icon: Users },
  { label: 'Notifications', href: '/team/notifications', icon: Bell },
  { label: 'Profile', href: '/team/profile', icon: User },
];

export function TeamSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="rail">
      <div className="rail-brand">
        HAMS
        <span>Team Lead Portal</span>
      </div>
      <nav className="rail-nav">
        {nav.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}
              className={`rail-item ${active ? 'active' : ''}`}>
              <item.icon size={15} style={{ flexShrink: 0, opacity: active ? 1 : 0.65 }} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="rail-foot">
        <div style={{ fontWeight: 600, color: '#cde8df', marginBottom: 2, fontSize: 13 }}>{user?.name}</div>
        <div style={{ marginBottom: 10, fontSize: 11, color: '#5a8a7a', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          Team Lead
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
