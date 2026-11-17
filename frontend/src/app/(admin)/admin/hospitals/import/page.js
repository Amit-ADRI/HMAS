'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Loader2, Download } from 'lucide-react';

const STEPS = ['Upload File', 'Preview & Validate', 'Confirm Import'];

export default function ImportHospitalsPage() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [uploadedFilename, setUploadedFilename] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const { toast } = useToast();

  const handleFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'csv', 'xls'].includes(ext)) {
      toast({ title: 'Invalid file type', description: 'Please upload .xlsx, .xls or .csv file', variant: 'destructive' });
      return;
    }
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      // Step 1: upload the file, get server filename back
      const fd = new FormData();
      fd.append('file', file);
      const uploadRes = await api.upload('/v1/imports/upload', fd);
      const filename = uploadRes.filename;
      setUploadedFilename(filename);

      // Step 2: preview using the server filename
      const previewRes = await api.post('/v1/imports/preview', { filename });
      setPreview(previewRes.preview || previewRes);
      setStep(1);
    } catch (err) {
      toast({ title: 'Preview failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!uploadedFilename) return;
    setLoading(true);
    try {
      const res = await api.post('/v1/imports/confirm', { filename: uploadedFilename });
      const batch = res.batch || res;
      setResult({
        imported: (batch.added || 0) + (batch.updated || 0),
        added: batch.added || 0,
        updated: batch.updated || 0,
        skipped: batch.skipped || 0,
        failed: batch.failed || 0,
        batchId: batch.batchId,
      });
      setStep(2);
      toast({ title: 'Import successful', description: `${(batch.added || 0) + (batch.updated || 0)} hospitals imported` });
    } catch (err) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    setUploadedFilename(null);
    setPreview(null);
    setResult(null);
  };

  return (
    <div>
      <PageHeader title="Import Hospitals" description="Upload a spreadsheet to bulk import hospital data">
        <Link href="/admin/hospitals">
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </Link>
      </PageHeader>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${i <= step ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
              {i + 1}
            </div>
            <span className={`text-sm font-medium ${i === step ? 'text-gray-900' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`h-px flex-1 min-w-[40px] ${i < step ? 'bg-primary' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Upload */}
      {step === 0 && (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle className="text-base">Upload Hospital Data File</CardTitle></CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
            >
              <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => handleFile(e.target.files[0])} />
              <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              {file ? (
                <div>
                  <p className="font-semibold text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Drop your file here or click to browse</p>
                  <p className="text-sm text-gray-500">Supports .xlsx, .xls, .csv</p>
                </div>
              )}
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
              <p className="font-semibold mb-1">Required columns:</p>
              <p className="text-xs">Facility ID, Hospital Name, District, State, Hospital Type, Facility Type, Beds, Nodal Officer, Phone, Email</p>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={handlePreview} disabled={!file || loading} className="flex-1">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><Upload className="w-4 h-4 mr-2" />Preview File</>}
              </Button>
              <Button variant="outline" onClick={() => toast({ title: 'Download template coming soon' })}>
                <Download className="w-4 h-4 mr-2" />Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Preview */}
      {step === 1 && preview && (
        <div>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'New', value: preview.new || 0, icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
              { label: 'Updated', value: preview.updated || 0, icon: AlertCircle, color: 'text-blue-600 bg-blue-50' },
              { label: 'Unchanged', value: preview.unchanged || 0, icon: CheckCircle2, color: 'text-gray-600 bg-gray-50' },
              { label: 'Invalid', value: preview.invalid || 0, icon: XCircle, color: 'text-red-600 bg-red-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
                  <div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Preview table */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">Preview (first 20 rows)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Facility ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Beds</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(preview.records || []).slice(0, 20).map((row, i) => (
                    <TableRow key={i} className={row._status === 'INVALID' ? 'bg-red-50' : ''}>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          row._status === 'NEW' ? 'bg-green-100 text-green-700' :
                          row._status === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                          row._status === 'INVALID' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{row._status}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.facilityId}</TableCell>
                      <TableCell className="text-sm">{row.facilityName}</TableCell>
                      <TableCell className="text-sm">{row.district}</TableCell>
                      <TableCell className="text-xs">{row.hospitalType}</TableCell>
                      <TableCell className="text-sm">{row.totalBedStrength}</TableCell>
                      <TableCell className="text-xs text-red-600">
                        {row._errors ? row._errors.map(e => e.error).join(', ') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={handleConfirm} disabled={loading || ((preview.new || 0) === 0 && (preview.updated || 0) === 0)}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</> : `Confirm Import (${(preview.new || 0) + (preview.updated || 0)} records)`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Result */}
      {step === 2 && result && (
        <Card className="max-w-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Import Complete</h2>
            <p className="text-gray-500 mb-6">
              Successfully imported <strong>{result.imported || 0}</strong> hospitals.
              {result.failed > 0 && <> <strong>{result.failed}</strong> records had errors.</>}
            </p>
            <div className="flex gap-3 justify-center">
              {result.errorReportUrl && (
                <Button variant="outline" onClick={() => window.open(result.errorReportUrl)}>
                  <Download className="w-4 h-4 mr-2" />Download Error Report
                </Button>
              )}
              <Link href="/admin/hospitals"><Button>View Hospitals</Button></Link>
              <Button variant="outline" onClick={reset}>Import More</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
