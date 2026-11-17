'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { TeamSidebar } from '@/components/layout/TeamSidebar';

export default function TeamLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'TEAM_LEAD')) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <div className="app-shell">
      <TeamSidebar />
      <main className="stage">
        {children}
      </main>
    </div>
  );
}
