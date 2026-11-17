'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useToast } from '@/components/ui/use-toast';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';

const TYPES = ['Routine', 'Surprise', 'Complaint', 'Follow-up', 'Re-audit', 'Special', 'Verification'];
const RESPONSE_TYPES = ['COMPLIANT_CHECK', 'TEXT', 'SCORE', 'SINGLE_CHOICE'];
const emptyQuestion = () => ({ text: '', responseType: 'COMPLIANT_CHECK', isMandatory: true, requiresRemark: false, requiresEvidence: false });
const emptySection = () => ({ title: '', questions: [emptyQuestion()] });

export default function ChecklistsPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]); const [loading, setLoading] = useState(true); const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ templateName: '', auditType: '', sections: [emptySection()] });
  const fetchTemplates = useCallback(async () => { setLoading(true); try { const res = await api.get('/v1/checklists/templates'); setTemplates(res.templates || []); } catch (err) { toast({ title: 'Could not load templates', description: err.message, variant: 'destructive' }); } finally { setLoading(false); } }, [toast]);
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  const updateQuestion = (sectionIndex, questionIndex, field, value) => setForm((current) => ({ ...current, sections: current.sections.map((section, i) => i !== sectionIndex ? section : { ...section, questions: section.questions.map((question, j) => j !== questionIndex ? question : { ...question, [field]: value }) }) }));
  const save = async () => {
    if (!form.templateName || !form.auditType || form.sections.some((section) => !section.title || section.questions.some((question) => !question.text))) return toast({ title: 'Provide a template name, type, section names and question text', variant: 'destructive' });
    setSaving(true);
    try {
      const sections = form.sections.map((section, sectionIndex) => ({ sectionId: `S${sectionIndex + 1}`, title: section.title, order: sectionIndex + 1, questions: section.questions.map((question, questionIndex) => ({ ...question, questionId: `S${sectionIndex + 1}Q${questionIndex + 1}`, order: questionIndex + 1, options: question.responseType === 'SINGLE_CHOICE' ? (question.options || '').split(',').map((item) => item.trim()).filter(Boolean) : [] })) }));
      await api.post('/v1/checklists/templates', { templateName: form.templateName, auditType: form.auditType, sections });
      toast({ title: 'Checklist template created' }); setOpen(false); setForm({ templateName: '', auditType: '', sections: [emptySection()] }); fetchTemplates();
    } catch (err) { toast({ title: 'Could not create template', description: err.message, variant: 'destructive' }); } finally { setSaving(false); }
  };
  return <div><PageHeader title="Checklist Templates" description="Define the questions each team must complete during an audit."><Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />New template</Button></PageHeader>
    {loading ? <LoadingSpinner /> : templates.length === 0 ? <EmptyState icon={ClipboardList} title="No checklist templates" description="Create a template before teams begin audits." action={<Button onClick={() => setOpen(true)}>Create template</Button>} /> : <div className="grid md:grid-cols-2 gap-4">{templates.map((template) => <Card key={template._id || template.id}><CardHeader><CardTitle className="text-base flex justify-between gap-3"><span>{template.templateName}</span><Badge variant={template.isActive ? 'default' : 'secondary'}>{template.isActive ? 'Active' : 'Inactive'}</Badge></CardTitle></CardHeader><CardContent className="text-sm text-gray-600"><p>{template.auditType}</p><p className="mt-1">{template.sections?.length || 0} sections · {template.sections?.reduce((count, section) => count + (section.questions?.length || 0), 0)} questions</p></CardContent></Card>)}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Build checklist template</DialogTitle></DialogHeader><div className="space-y-5"><div className="grid sm:grid-cols-2 gap-3"><div className="space-y-2"><Label>Template name *</Label><Input value={form.templateName} onChange={(e) => setForm((current) => ({ ...current, templateName: e.target.value }))} placeholder="Routine hospital audit" /></div><div className="space-y-2"><Label>Audit type *</Label><Select value={form.auditType} onValueChange={(value) => setForm((current) => ({ ...current, auditType: value }))}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent>{TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div></div>{form.sections.map((section, sectionIndex) => <Card key={sectionIndex}><CardHeader className="py-4"><div className="flex gap-2"><Input value={section.title} placeholder={`Section ${sectionIndex + 1} title`} onChange={(e) => setForm((current) => ({ ...current, sections: current.sections.map((item, i) => i === sectionIndex ? { ...item, title: e.target.value } : item) }))} />{form.sections.length > 1 && <Button variant="ghost" size="icon" onClick={() => setForm((current) => ({ ...current, sections: current.sections.filter((_, i) => i !== sectionIndex) }))}><Trash2 className="w-4 h-4" /></Button>}</div></CardHeader><CardContent className="space-y-3">{section.questions.map((question, questionIndex) => <div key={questionIndex} className="rounded border p-3 grid sm:grid-cols-2 gap-2"><Input className="sm:col-span-2" placeholder="Question" value={question.text} onChange={(e) => updateQuestion(sectionIndex, questionIndex, 'text', e.target.value)} /><Select value={question.responseType} onValueChange={(value) => updateQuestion(sectionIndex, questionIndex, 'responseType', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RESPONSE_TYPES.map((type) => <SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select>{question.responseType === 'SINGLE_CHOICE' && <Input placeholder="Options, comma separated" value={question.options || ''} onChange={(e) => updateQuestion(sectionIndex, questionIndex, 'options', e.target.value)} />}{['isMandatory', 'requiresRemark', 'requiresEvidence'].map((field) => <label key={field} className="flex gap-2 text-xs items-center"><input type="checkbox" checked={Boolean(question[field])} onChange={(e) => updateQuestion(sectionIndex, questionIndex, field, e.target.checked)} />{field.replace(/([A-Z])/g, ' $1')}</label>)}{section.questions.length > 1 && <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setForm((current) => ({ ...current, sections: current.sections.map((item, i) => i === sectionIndex ? { ...item, questions: item.questions.filter((_, j) => j !== questionIndex) } : item) }))}>Remove question</Button>}</div>)}<Button variant="outline" size="sm" onClick={() => setForm((current) => ({ ...current, sections: current.sections.map((item, i) => i === sectionIndex ? { ...item, questions: [...item.questions, emptyQuestion()] } : item) }))}>Add question</Button></CardContent></Card>)}<Button variant="outline" onClick={() => setForm((current) => ({ ...current, sections: [...current.sections, emptySection()] }))}>Add section</Button></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create template'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
