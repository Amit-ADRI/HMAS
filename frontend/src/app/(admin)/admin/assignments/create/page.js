'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Users, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

export default function CreateAssignmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get('auditId');
  const { toast } = useToast();

  const [audit, setAudit] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsRes] = await Promise.all([
          api.get('/v1/teams?withWorkload=true'),
        ]);
        setTeams(teamsRes.teams || []);

        if (auditId) {
          const aRes = await api.get(`/v1/audits/${auditId}`);
          setAudit(aRes.audit);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [auditId]);

  const handleAssign = async () => {
    if (!selectedTeam || !audit) return;
    setSubmitting(true);
    try {
      await api.post('/v1/assignments', {
        auditId: audit._id || audit.id,
        teamId: selectedTeam._id || selectedTeam.id,
      });
      toast({ title: 'Team assigned successfully' });
      router.push(`/admin/audits/${audit._id || audit.id}`);
    } catch (err) {
      toast({ title: 'Assignment failed', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div>
      <PageHeader title="Assign Team" description="Select a team to handle this audit">
        <Link href="/admin/assignments">
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </Link>
      </PageHeader>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Audit Info */}
          {audit && (
            <Card className="mb-6">
              <CardHeader><CardTitle className="text-base">Audit Information</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Audit Number:</span>
                    <p className="font-mono font-medium">{audit.auditNumber}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Hospital:</span>
                    <p className="font-medium">{audit.hospital?.facilityName}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <div className="mt-1"><StatusBadge status={audit.status} /></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Teams List */}
          <Card>
            <CardHeader><CardTitle className="text-base">Available Teams ({teams.length})</CardTitle></CardHeader>
            <CardContent>
              {teams.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">No teams available</div>
              ) : (
                <div className="space-y-3">
                  {teams.map((team) => {
                    const tId = team._id || team.id;
                    const isSelected = selectedTeam && (selectedTeam._id || selectedTeam.id) === tId;
                    const isAvailable = ['Available', 'Partially Available'].includes(team.availability);

                    return (
                      <div
                        key={tId}
                        onClick={() => isAvailable && setSelectedTeam(team)}
                        className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : isAvailable
                            ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isSelected ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}`}>
                              {team.teamName?.charAt(0) || 'T'}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{team.teamName}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Lead: {team.teamLead?.name || '-'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {team.memberCount || team.members?.length || 0} members
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={isAvailable ? 'secondary' : 'destructive'} className="mb-1">
                              {isAvailable ? 'Available' : 'Overloaded'}
                            </Badge>
                            {isSelected && <CheckCircle className="w-4 h-4 text-primary ml-auto mt-1" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Confirm Panel */}
        <div>
          <Card className="sticky top-24">
            <CardHeader><CardTitle className="text-base">Confirm Assignment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {selectedTeam ? (
                <div className="p-4 bg-primary/5 rounded-lg text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-primary">{selectedTeam.teamName}</span>
                  </div>
                  <p className="text-gray-600">Lead: {selectedTeam.teamLead?.name || '-'}</p>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  Select a team from the list
                </div>
              )}

              <Button
                className="w-full"
                disabled={!selectedTeam || submitting}
                onClick={handleAssign}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Assigning...</>
                ) : (
                  <><CheckCircle className="w-4 h-4 mr-2" />Confirm Assignment</>
                )}
              </Button>
              <Link href="/admin/assignments">
                <Button variant="outline" className="w-full">Cancel</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
