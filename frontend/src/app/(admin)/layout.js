'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { AdminTopNav } from '@/components/layout/AdminTopNav';

export default function AdminLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'ADMIN')) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <div className="app-shell">
      <AdminSidebar />
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AdminTopNav />
        <main className="stage" style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
