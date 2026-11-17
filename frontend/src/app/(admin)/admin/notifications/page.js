'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { formatDateTime } from '@/lib/utils';
import { Bell, CheckCheck, Circle } from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const { toast } = useToast();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === 'unread' ? '?isRead=false' : '';
      const res = await api.get(`/v1/notifications${params}`);
      setNotifications(res.notifications || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      await api.patch('/v1/notifications/mark-all-read', {});
      toast({ title: 'All notifications marked as read' });
      fetchNotifications();
    } catch (err) {
      toast({ title: 'Failed to update notifications', variant: 'destructive' });
    }
  };

  const markRead = async (id) => {
    try {
      await api.patch(`/v1/notifications/${id}/read`, {});
      setNotifications((prev) => prev.map((n) => (n._id === id || n.id === id) ? { ...n, isRead: true, read: true } : n));
    } catch {}
  };

  const unreadCount = notifications.filter((n) => !n.isRead && !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread notifications`}
      >
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark all read
          </Button>
        )}
      </PageHeader>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {['all', 'unread'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {f === 'all' ? 'All' : 'Unread'}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description={filter === 'unread' ? 'You have no unread notifications' : 'No notifications found'}
          icon={Bell}
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const nId = n._id || n.id;
            const isRead = n.isRead || n.read;
            return (
              <Card
                key={nId}
                className={`transition-colors cursor-pointer ${!isRead ? 'border-primary/30 bg-primary/5' : ''}`}
                onClick={() => !isRead && markRead(nId)}
              >
                <CardContent className="flex items-start gap-4 py-4">
                  <div className={`mt-1 flex-shrink-0 ${!isRead ? 'text-primary' : 'text-gray-300'}`}>
                    {!isRead ? <Circle className="w-3 h-3 fill-current" /> : <Circle className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm ${!isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {n.title || n.message}
                        </p>
                        {n.message && n.title && (
                          <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                        )}
                        {n.type && (
                          <Badge variant="outline" className="mt-1.5 text-xs">{n.type.replace(/_/g, ' ')}</Badge>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-400">{formatDateTime(n.createdAt)}</p>
                        {!isRead && (
                          <Badge className="mt-1 bg-primary/10 text-primary border-0 text-xs">New</Badge>
                        )}
                      </div>
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
