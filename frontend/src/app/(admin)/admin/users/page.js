'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { formatDateTime } from '@/lib/utils';
import { Plus, Edit, ToggleLeft, ToggleRight, Loader2, Users, Trash2 } from 'lucide-react';

const ROLES = ['ADMIN', 'TEAM_LEAD'];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'TEAM_LEAD' });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/users?limit=100');
      setUsers(res.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: '', email: '', password: '', role: 'TEAM_LEAD' });
    setDialogOpen(true);
  };

  const openEdit = (user) => {
    setEditUser(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || (!editUser && !form.password)) {
      toast({ title: 'Name, email and password are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      if (editUser) {
        const payload = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/v1/users/${editUser._id || editUser.id}`, payload);
        toast({ title: 'User updated successfully' });
      } else {
        await api.post('/v1/users', form);
        toast({ title: 'User created successfully' });
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err) {
      toast({ title: 'Operation failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (user) => {
    const uId = user._id || user.id;
    try {
      await api.patch(`/v1/users/${uId}/toggle-status`, {});
      toast({ title: `User ${user.isActive ? 'deactivated' : 'activated'}` });
      fetchUsers();
    } catch (err) {
      toast({ title: 'Failed to update status', description: err.message, variant: 'destructive' });
    }
  };
  const deleteUser = async (user) => {
    if (!window.confirm(`Delete user '${user.name}'? This cannot be undone.`)) return;
    try { await api.delete(`/v1/users/${user._id || user.id}`); toast({ title: 'User deleted' }); fetchUsers(); }
    catch (err) { toast({ title: 'Could not delete user', description: err.message, variant: 'destructive' }); }
  };

  return (
    <div>
      <PageHeader title="User Management" description={`${users.length} users`}>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />Create User
        </Button>
      </PageHeader>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      ) : users.length === 0 ? (
        <EmptyState title="No users found" icon={Users} action={<Button size="sm" onClick={openCreate}>Create User</Button>} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const uId = user._id || user.id;
                return (
                  <TableRow key={uId}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="font-mono text-xs">{user.userId || '-'}</TableCell>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.isActive !== false ? 'bg-green-100 text-green-700 border-0 px-2 py-1' : 'bg-gray-100 text-gray-600 border-0'}>
                        {user.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDateTime(user.lastLogin) || '-'}</TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDateTime(user.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(user)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          style={{ color: user.isActive !== false ? 'var(--rose)' : 'var(--teal)' }}
                          onClick={() => toggleStatus(user)}
                        >
                          {user.isActive !== false ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => deleteUser(user)} title="Delete user"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? 'Edit User' : 'Create User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                placeholder="Enter full name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                placeholder="email@hmas.gov.in"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</Label>
              <Input
                type="password"
                placeholder={editUser ? 'Leave blank to keep current' : 'Set initial password'}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editUser ? 'Update User' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
