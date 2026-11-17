'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Dices, Loader2, Search, Users } from 'lucide-react';

export default function CreateAuditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedHospitalId = searchParams.get('hospitalId');
  const { toast } = useToast();

  const [hospitals, setHospitals] = useState([]);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [selectedHospitals, setSelectedHospitals] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [selectionFilters, setSelectionFilters] = useState({ state: '', district: '', facilityType: '', hospitalType: '' });
  const [eligibleHospitals, setEligibleHospitals] = useState([]);
  const [eligibleTotal, setEligibleTotal] = useState(0);
  const [allHospitals, setAllHospitals] = useState([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: { targetDate: '', reason: '', instructions: '' },
  });

  // Load preselected hospital
  useEffect(() => {
    if (preselectedHospitalId) {
      api.get(`/v1/hospitals/${preselectedHospitalId}`)
        .then((res) => {
          const h = res.hospital || res;
          setSelectedHospitals([h]);
          setHospitalSearch(h.facilityName);
        })
        .catch(() => {});
    }
  }, [preselectedHospitalId]);

  // The same conditions used for random selection are visible to the admin.
  // This keeps a random pick auditable and prevents inactive hospitals being selected.
  useEffect(() => {
    const loadEligibleHospitals = async () => {
      setLoadingEligible(true);
      try {
        const query = new URLSearchParams({ limit: '500', isActive: 'true' });
        Object.entries(selectionFilters).forEach(([key, value]) => { if (value) query.set(key, value); });
        const res = await api.get(`/v1/hospitals?${query}`);
        setEligibleHospitals(res.hospitals || []);
        setEligibleTotal(res.total || (res.hospitals || []).length);
      } catch {
        setEligibleHospitals([]);
      } finally { setLoadingEligible(false); }
    };
    loadEligibleHospitals();
  }, [selectionFilters]);

  // Load ALL active hospitals once for filter dropdown options
  useEffect(() => {
    api.get('/v1/hospitals?isActive=true&limit=2000')
      .then((res) => setAllHospitals(res.hospitals || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/v1/teams?isActive=true&limit=100').then((res) => setTeams(res.teams || [])).catch(() => {});
  }, []);

  const searchHospitals = async (q) => {
    if (!q || q.length < 2) { setHospitals([]); return; }
    setLoadingHospitals(true);
    try {
      const res = await api.get(`/v1/hospitals?search=${encodeURIComponent(q)}&limit=10`);
      setHospitals(res.hospitals || []);
    } catch {}
    finally { setLoadingHospitals(false); }
  };

  const onSubmit = async (data) => {
    if (!selectedHospitals.length) {
      toast({ title: 'Please select at least one hospital', variant: 'destructive' });
      return;
    }
    if (!selectedTeamId) {
      toast({ title: 'Please assign one team', variant: 'destructive' });
      return;
    }
    setLoading(true);
    let createdAuditId = null;
    try {
      const res = await api.post('/v1/audits', {
        hospitalIds: selectedHospitals.map((hospital) => hospital._id || hospital.id),
        targetDate: data.targetDate,
        reason: data.reason,
        instructions: data.instructions,
      });
      const audits = res.audits || (res.audit ? [res.audit] : []);
      if (audits.length !== selectedHospitals.length || res.hospitalCount !== undefined && res.hospitalCount !== selectedHospitals.length) {
        throw new Error(`Only ${audits.length} of ${selectedHospitals.length} selected hospitals were created. Please contact an administrator before assigning a team.`);
      }
      const aId = audits[0]?._id || audits[0]?.id;
      createdAuditId = aId;
      if (audits.length) await api.post('/v1/assignments', { auditId: aId, teamId: selectedTeamId, expectedAuditDate: data.targetDate, instructions: data.instructions });
      if (aId) {
        const blob = await api.download(`/v1/audits/${aId}/order-pdf`);
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${audits[0]?.auditNumber || 'audit'}-order.pdf`; link.click(); URL.revokeObjectURL(link.href);
      }
      toast({ title: 'Audit created, team assigned, and audit order downloaded' });
      router.push(aId ? `/admin/audits/${aId}` : '/admin/audits');
    } catch (err) {
      if (createdAuditId) {
        toast({ title: 'Audit created, but team assignment needs attention', description: err.message, variant: 'destructive' });
        router.push(`/admin/audits/${createdAuditId}`);
      } else {
        toast({ title: 'Failed to create audit', description: err.message, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const selectRandomHospital = () => {
    if (!eligibleHospitals.length) {
      toast({ title: 'No hospitals match these selection conditions', variant: 'destructive' });
      return;
    }
    const hospital = eligibleHospitals[Math.floor(Math.random() * eligibleHospitals.length)];
    setSelectedHospitals([hospital]);
    setHospitalSearch(hospital.facilityName);
    toast({ title: 'Random hospital selected', description: hospital.facilityName });
  };

  const availableTeams = teams.filter((team) => ['Available', 'Partially Available'].includes(team.availability));
  const filterValues = (field) => [...new Set(allHospitals.map((hospital) => hospital[field]).filter(Boolean))].sort();

  return (
    <div>
      <PageHeader title="Create Audit Process" description="Select one Bihar hospital and assign an available team in one workflow.">
        <Link href="/admin/audits">
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </Link>
      </PageHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Hospital Selection */}
            <Card>
              <CardHeader><CardTitle className="text-base">Hospital Selection</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 mb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="font-medium text-sm">Condition-based random selection</p>
                        <p className="text-xs text-gray-500">Filter the eligible pool first, then select one hospital at random.</p>
                      </div>
                      <Button type="button" variant="secondary" size="sm" onClick={selectRandomHospital} disabled={loadingEligible}>
                        <Dices className="w-4 h-4 mr-2" />{loadingEligible ? 'Loading...' : 'Select random hospital'}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {[
                        ['state', 'State'], ['district', 'District'], ['facilityType', 'Facility type'], ['hospitalType', 'Hospital type'],
                      ].map(([field, label]) => <Select key={field} value={selectionFilters[field] || 'all'} onValueChange={(value) => setSelectionFilters((current) => ({ ...current, [field]: value === 'all' ? '' : value }))}><SelectTrigger className="h-9"><SelectValue placeholder={label} /></SelectTrigger><SelectContent><SelectItem value="all">All {label}s</SelectItem>{filterValues(field).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>)}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{loadingEligible ? 'Checking hospitals...' : `${eligibleTotal} active hospital(s) match current filters`}</p>
                  </div>
                  <Label>Hospitals *</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      className="pl-9"
                      placeholder="Search hospital by name or facility ID..."
                      value={hospitalSearch}
                      onChange={(e) => {
                        setHospitalSearch(e.target.value);
                        setShowDropdown(true);
                        searchHospitals(e.target.value);
                      }}
                      onFocus={() => setShowDropdown(true)}
                    />
                    {showDropdown && hospitals.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                        {hospitals.map((h) => (
                          <button
                            key={h._id || h.id}
                            type="button"
                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                            onClick={() => {
                              setSelectedHospitals([h]);
                              setHospitalSearch(h.facilityName);
                              setShowDropdown(false);
                            }}
                          >
                            <div className="font-medium">{h.facilityName}</div>
                            <div className="text-xs text-gray-500">{h.facilityId} &bull; {h.district} &bull; {h.hospitalType || ''}</div>
                            {h.specialities?.length > 0 && <div className="text-xs text-teal-700 mt-0.5">{h.specialities.join(', ')}</div>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedHospitals.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                      <div className="font-semibold text-blue-900 mb-2">Selected hospital</div>
                      {selectedHospitals.map((hospital) => (
                        <div key={hospital._id || hospital.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '6px 0' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{hospital.facilityName}</div>
                            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                              {hospital.facilityId} · {hospital.district} · {hospital.hospitalType || ''} · {hospital.totalBedStrength ? `${hospital.totalBedStrength} beds` : ''}
                            </div>
                            {hospital.specialities?.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                {hospital.specialities.map(s => (
                                  <span key={s} style={{ fontSize: 11, padding: '2px 8px', background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 2, color: 'var(--teal-deep)' }}>{s}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button type="button" onClick={() => setSelectedHospitals((current) => current.filter((item) => (item._id || item.id) !== (hospital._id || hospital.id)))}
                            style={{ fontSize: 12, color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, fontWeight: 600, padding: '2px 6px' }}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />Team Assignment</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Label>Assign team *</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger><SelectValue placeholder="Select one available team" /></SelectTrigger>
                  <SelectContent>
                    {availableTeams.map((team) => (
                      <SelectItem key={team._id || team.id} value={team._id || team.id}>
                        {team.teamName} — {team.availability}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">Only active teams marked Available or Partially Available are offered. Busy, On Leave, Unavailable and Inactive teams cannot receive new audits.</p>
              </CardContent>
            </Card>

            {/* Audit Details */}
            <Card>
              <CardHeader><CardTitle className="text-base">Audit Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Target Date *</Label>
                  <Input
                    type="date"
                    {...register('targetDate', { required: 'Target date is required' })}
                    className={errors.targetDate ? 'border-destructive' : ''}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {errors.targetDate && <p className="text-xs text-destructive">{errors.targetDate.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Reason / Objective</Label>
                  <Textarea
                    placeholder="Describe the reason or objective for this audit..."
                    rows={3}
                    {...register('reason')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Special Instructions</Label>
                  <Textarea
                    placeholder="Any special instructions for the audit team..."
                    rows={3}
                    {...register('instructions')}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Submit Card */}
          <div>
            <Card className="sticky top-24">
              <CardHeader><CardTitle className="text-base">Submit</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-500 space-y-1">
                  <div className="flex justify-between"><span>Hospitals:</span><span className="font-medium text-gray-800">{selectedHospitals.length || 'Not selected'}</span></div>
                  <div className="flex justify-between"><span>Target:</span><span className="font-medium text-gray-800">{watch('targetDate') || '-'}</span></div>
                  <div className="flex justify-between"><span>Team:</span><span className="font-medium text-gray-800 truncate max-w-[120px]">{teams.find((team) => (team._id || team.id) === selectedTeamId)?.teamName || 'Not selected'}</span></div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Audit & Download Order'}
                </Button>
                <Link href="/admin/audits">
                  <Button type="button" variant="outline" className="w-full">Cancel</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
