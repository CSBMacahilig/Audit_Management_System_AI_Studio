import React, { useMemo, useState } from 'react';
import type { AuditDivisionRiskScale, AuditEngagement, IssueRegisterItem, UniverseEntity, UserProfile } from '../data/auditData';
import {
  BulkImportContext,
  BulkImportRow,
  BulkImportTarget,
  BULK_IMPORT_TARGETS,
  getBulkImportColumns,
  getBulkImportSampleRow,
  getBulkImportTargetLabel,
  getBulkImportTemplate,
  readBulkImportFile,
  validateBulkImportRows,
} from '../utils/bulkImport';

export interface BulkImportFailure {
  line: number;
  message: string;
}

export interface BulkImportResult {
  imported: number;
  failures: BulkImportFailure[];
}

interface Props {
  targets: BulkImportTarget[];
  universe: UniverseEntity[];
  engagements: AuditEngagement[];
  userProfiles: UserProfile[];
  issues: IssueRegisterItem[];
  riskScales: AuditDivisionRiskScale[];
  currentUser: UserProfile;
  onImport: (target: BulkImportTarget, rows: BulkImportRow[]) => Promise<BulkImportResult>;
  onClose: () => void;
}

const PREVIEW_COLUMN_LIMIT = 6;

export const BulkImportModal: React.FC<Props> = ({
  targets,
  universe,
  engagements,
  userProfiles,
  issues,
  riskScales,
  currentUser,
  onImport,
  onClose,
}) => {
  const [target, setTarget] = useState<BulkImportTarget>(targets[0] ?? BULK_IMPORT_TARGETS[0].id);
  const [rows, setRows] = useState<BulkImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const context: BulkImportContext = { universe, engagements, userProfiles, issues, riskScales };
  const validatedRows = useMemo(
    () => validateBulkImportRows(target, rows, context),
    [target, rows, universe, engagements, userProfiles, issues, riskScales]
  );
  const validRows = validatedRows.filter((row) => row.errors.length === 0);
  const invalidRows = validatedRows.filter((row) => row.errors.length > 0);
  const previewColumns = getBulkImportColumns(target).slice(0, PREVIEW_COLUMN_LIMIT);

  const resetFile = () => {
    setRows([]);
    setFileName('');
    setFileError(null);
    setResult(null);
  };

  const handleTargetChange = (nextTarget: BulkImportTarget) => {
    setTarget(nextTarget);
    resetFile();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setIsReading(true);
    setFileName(file.name);
    setFileError(null);
    setResult(null);
    try {
      const importedRows = await readBulkImportFile(file, target);
      setRows(importedRows);
      if (importedRows.length === 0) setFileError('The file has no non-empty data rows.');
    } catch (error) {
      setRows([]);
      setFileError(error instanceof Error ? error.message : 'Could not read the selected file.');
    } finally {
      setIsReading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = getBulkImportTemplate(target);
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${target}-import-template.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleImport = async () => {
    if (validRows.length === 0) {
      setFileError('There are no valid rows to import. Correct the file and upload it again.');
      return;
    }
    setIsImporting(true);
    setFileError(null);
    try {
      const importResult = await onImport(target, validRows);
      setResult(importResult);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Import did not complete.');
    } finally {
      if (target === 'profiles') {
        setRows((current) => current.map((row) => ({
          ...row,
          values: { ...row.values, initial_password: '' },
        })));
      }
      setIsImporting(false);
    }
  };

  const targetLabel = getBulkImportTargetLabel(target);
  const sampleRow = getBulkImportSampleRow(target);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 py-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Bulk import</h2>
            <p className="mt-1 text-xs text-slate-500">
              Signed in as {currentUser.name}. Files are parsed in this browser; valid rows are previewed before saving.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close bulk import"
            className="rounded-md px-2 py-1 text-lg font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            ×
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto] md:items-end">
            <div>
              <label htmlFor="bulk-import-target" className="mb-1 block text-xs font-semibold text-slate-700">Data type</label>
              <select id="bulk-import-target" value={target}
                onChange={(event) => handleTargetChange(event.target.value as BulkImportTarget)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                {targets.map((item) => (
                  <option key={item} value={item}>{getBulkImportTargetLabel(item)}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={handleDownloadTemplate}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Download CSV template
            </button>
          </div>

          {target === 'profiles' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Imports directory profiles. To also create a standard login, provide username, system_role=user, and a unique initial_password; the user must change it at first sign-in. Passwords are masked in the preview and are never logged. Admin accounts must be created separately.
            </div>
          )}

          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Choose a CSV or Excel workbook</p>
                <p className="mt-1 text-xs text-slate-500">
                  Use the downloaded column names. You can edit the CSV in Excel and save it as .xlsx; XLSX imports read the first worksheet. Maximum file size is 10 MB and 2,000 rows.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-[#492785] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3b1f6b]">
                {isReading ? 'Reading file…' : 'Choose file'}
                <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={isReading || isImporting}
                  onChange={handleFileChange} className="sr-only" />
              </label>
            </div>
            {fileName && <p className="mt-3 break-all text-xs text-slate-700">Selected: {fileName}</p>}
          </div>

          {fileError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{fileError}</p>}

          {rows.length > 0 && !result && (
            <>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">{validRows.length} valid</span>
                <span className={`rounded-full px-3 py-1 font-semibold ${invalidRows.length ? 'bg-rose-50 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>
                  {invalidRows.length} with errors
                </span>
                <span className="self-center text-slate-500">{validatedRows.length} rows found · {targetLabel}</span>
              </div>

              <div className="max-h-[42vh] overflow-auto rounded-md border border-slate-200">
                <table className="min-w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2">Row</th>
                      {previewColumns.map((column) => <th key={column} className="min-w-28 px-3 py-2">{column}</th>)}
                      <th className="min-w-56 px-3 py-2">Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validatedRows.slice(0, 100).map((row) => (
                      <tr key={row.line} className="border-t border-slate-100 align-top">
                        <td className="px-3 py-2 font-mono text-slate-500">{row.line}</td>
                        {previewColumns.map((column) => (
                          <td key={column} className="max-w-56 truncate px-3 py-2 text-slate-700" title={column === 'initial_password' && row.values[column] ? '••••••••' : row.values[column]}>
                            {column === 'initial_password' && row.values[column]
                              ? '••••••••'
                              : row.values[column] || '—'}
                          </td>
                        ))}
                        <td className={`px-3 py-2 ${row.errors.length ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {row.errors.length ? row.errors.join(' ') : 'Ready to import'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validatedRows.length > 100 && (
                  <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Preview shows the first 100 rows. All {validatedRows.length} rows are validated.
                  </p>
                )}
              </div>
            </>
          )}

          {result && (
            <div role="status" className={`rounded-md border px-3 py-2 text-xs ${result.failures.length ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
              <p className="font-semibold">{result.imported} rows imported; {result.failures.length} rows failed.</p>
              {result.failures.length > 0 && (
                <ul className="mt-1 list-inside list-disc">
                  {result.failures.slice(0, 20).map((failure) => (
                    <li key={`${failure.line}-${failure.message}`}>Row {failure.line}: {failure.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!rows.length && !fileError && (
            <p className="text-[11px] text-slate-500">
              Template columns: {getBulkImportColumns(target).join(', ')}. Sample row: {sampleRow.join(' · ')}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Close
            </button>
            <button type="button" onClick={handleImport}
              disabled={isReading || isImporting || validRows.length === 0 || Boolean(result)}
              className="rounded-md bg-[#492785] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3b1f6b] disabled:cursor-not-allowed disabled:opacity-50">
              {isImporting ? 'Importing…' : `Import ${validRows.length} valid rows`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
