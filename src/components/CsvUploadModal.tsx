import React, {useRef, useState} from 'react';
import {Download, FileSpreadsheet, Loader2, Upload, X} from 'lucide-react';
import {SAMPLE_CSV_CONTENT} from '../data/nairobiPreset';

export interface ParsedCsvRow {
  zoneName: string;
  vulnerabilityWeight: number;
}

interface CsvUploadModalProps {
  isOpen: boolean;
  regionName: string;
  isProcessing: boolean;
  progressText: string | null;
  errorText: string | null;
  onClose: () => void;
  onImportRows: (rows: ParsedCsvRow[]) => Promise<void>;
}

function parseCsvText(raw: string): ParsedCsvRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const rows: ParsedCsvRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
    if (parts.length === 0) continue;

    if (
      i === 0 &&
      (parts[0].toLowerCase().includes('zone') || parts[0].toLowerCase().includes('name'))
    ) {
      continue;
    }

    const zoneName = parts[0];
    if (!zoneName) continue;

    const rawWeight = parts[1] ? Number.parseFloat(parts[1]) : 1.0;
    const vulnerabilityWeight =
      Number.isFinite(rawWeight) && rawWeight > 0 && rawWeight <= 5 ? rawWeight : 1.0;

    rows.push({zoneName, vulnerabilityWeight});
  }

  return rows;
}

export const CsvUploadModal: React.FC<CsvUploadModalProps> = ({
  isOpen,
  regionName,
  isProcessing,
  progressText,
  errorText,
  onClose,
  onImportRows,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState(SAMPLE_CSV_CONTENT);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setCsvText(content);
      setLocalError(null);
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skymap_response_custom_zones_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseCsvText(csvText);
    if (parsed.length === 0) {
      setLocalError('No valid rows found. Format: zone_name, vulnerability_weight');
      return;
    }
    setLocalError(null);
    await onImportRows(parsed);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-sky-200 rounded-2xl shadow-2xl overflow-hidden text-slate-900">
        <div className="px-5 py-4 bg-[#F8FBFF] border-b border-sky-200 flex items-center justify-between">
          <div>
            <h2 id="csv-modal-title" className="font-display text-lg font-bold text-slate-900">
              Upload Custom Flood Zones CSV
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Geocoding API converts zone names near {regionName} and caches coordinates for 30 days.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-sky-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-[#F0F7FF] hover:bg-sky-100 text-sky-950 border border-sky-200 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-sky-600" />
              <span>Choose CSV File</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:text-sky-900 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Sample Template</span>
            </button>
          </div>

          <div>
            <label
              htmlFor="csv-textarea"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              CSV Data (<span className="font-mono text-sky-800">zone_name, vulnerability_weight</span>)
            </label>
            <textarea
              id="csv-textarea"
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              disabled={isProcessing}
              className="w-full bg-[#F0F7FF] border border-sky-200 rounded-xl p-3 font-mono text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-sky-500"
            />
          </div>

          {(localError || errorText) && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
              {localError || errorText}
            </div>
          )}

          {progressText && (
            <div className="flex items-center gap-2 text-sm text-sky-800 font-mono">
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-sky-600" />
              <span>{progressText}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-sky-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white transition-colors cursor-pointer disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Geocoding &amp; Analyzing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Geocode &amp; Load Zones</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
