
import React, { useState, useRef, useCallback, useMemo } from "react";
import Papa from "papaparse";
import type { CsvRow } from './types';
import { UploadIcon, DownloadIcon, CopyIcon, ResetIcon, InfoIcon, CsvIcon } from './components/icons';

export default function App() {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [filtered, setFiltered] = useState<CsvRow[]>([]);
  const [websiteCol, setWebsiteCol] = useState<string>("");
  const [phoneCol, setPhoneCol] = useState<string>("");
  const [message, setMessage] = useState<string>("Upload a CSV file to get started.");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const guessColumn = useCallback((hdrs: string[], candidates: string[], keywords: string[]): string => {
    for (const c of hdrs) {
      const lower = c.toLowerCase().trim().replace(/_/g, " ");
      if (candidates.includes(lower)) return c;
      if (keywords.some(kw => lower.includes(kw))) return c;
    }
    return "";
  }, []);

  const guessWebsiteColumn = useCallback((hdrs: string[]) => {
    return guessColumn(hdrs, ["website", "url", "website url", "website link", "site", "web"], ["web", "site", "url"]);
  }, [guessColumn]);

  const guessPhoneColumn = useCallback((hdrs: string[]) => {
    return guessColumn(hdrs, ["phone", "phone number", "telephone", "tel", "mobile", "contact", "phone1", "phone2", "ph"], ["phone", "tel", "mobile", "contact"]);
  }, [guessColumn]);
  
  const normalizePhone = (s: any): string => {
    if (!s) return "";
    const cleaned = String(s).replace(/[^\d+]/g, "").replace(/\s+/g, "");
    if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
    return cleaned;
  };

  const applyFilter = useCallback((data: CsvRow[], col: string) => {
    let filteredRows: CsvRow[] = [];
    if (!col) {
      setMessage("No website column selected — showing rows where no obvious website field exists.");
      filteredRows = data.filter((row) => {
        return !Object.values(row).some((val) => typeof val === "string" && val.match(/https?:\/\//));
      });
    } else {
      filteredRows = data.filter((row) => {
        const value = row[col];
        if (value === undefined || value === null) return true;
        const str = String(value).trim().toLowerCase();
        if (!str || ["n/a", "na", "-", "none"].includes(str)) return true;
        if (!str.includes("http") && !str.match(/\.[a-z]{2,6}(\/|$)/)) return true;
        return false;
      });
    }

    setFiltered(filteredRows);
    setMessage(`Found ${filteredRows.length} rows without website (out of ${data.length}).`);
  }, []);

  const onFile = (file: File | null) => {
    if (!file) return;
    setIsProcessing(true);
    setMessage("Parsing CSV...");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = (results.data as CsvRow[]) || [];
        const hdrs = results.meta.fields || (data.length ? Object.keys(data[0]) : []);
        setRows(data);
        setHeaders(hdrs);
        const guessedWeb = guessWebsiteColumn(hdrs);
        const guessedPhone = guessPhoneColumn(hdrs);
        setWebsiteCol(guessedWeb);
        setPhoneCol(guessedPhone);
        setMessage(`Loaded ${data.length} rows.`);
        setTimeout(() => applyFilter(data, guessedWeb), 50);
        setIsProcessing(false);
      },
      error: (err: any) => {
        setMessage("Error parsing CSV: " + err.message);
        setIsProcessing(false);
      },
    });
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    onFile(file || null);
  };

  const handleReset = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setRows([]);
    setFiltered([]);
    setHeaders([]);
    setWebsiteCol("");
    setPhoneCol("");
    setMessage("Upload a CSV file to get started.");
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadFiltered = () => {
    if (!filtered.length) return;
    const csv = Papa.unparse(filtered);
    downloadFile(csv, "filtered_no_website.csv", "text/csv;charset=utf-8;");
  };
  
  const extractedPhones = useMemo(() => {
    if (!filtered.length) return [];
    const col = phoneCol || guessPhoneColumn(headers);
    if (!col) return [];
    
    const phones = filtered.map((r) => normalizePhone(r[col])).filter(p => p && p.length > 5);
    return [...new Set(phones)];
  }, [filtered, phoneCol, headers, guessPhoneColumn]);

  const copyPhones = () => {
    if (!extractedPhones.length) { alert('No phone numbers found'); return; }
    navigator.clipboard.writeText(extractedPhones.join('\n'));
    alert(`Copied ${extractedPhones.length} phone number(s) to clipboard`);
  };

  const downloadPhones = () => {
    if (!extractedPhones.length) return;
    downloadFile(extractedPhones.join('\n'), "phones_no_website.txt", "text/plain;charset=utf-8;");
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <main className="max-w-5xl mx-auto">
        <header className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 tracking-tight">CSV Website & Phone Extractor</h1>
            <p className="mt-2 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
              Upload a CSV from Google Maps, find entries without a website, and extract their phone numbers.
            </p>
        </header>

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg space-y-8">
            {/* 1. File Upload */}
            <section>
                <h2 className="text-lg font-semibold text-slate-700 mb-4">1. Upload your File</h2>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <label 
                        htmlFor="csv-upload"
                        className="flex-1 w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                        <UploadIcon className="w-10 h-10 text-slate-400 mb-2"/>
                        <span className="text-slate-700 font-medium">Click to upload or drag and drop</span>
                        <span className="text-sm text-slate-500">CSV file required</span>
                        <input ref={fileInputRef} id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} className="sr-only" />
                    </label>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition-colors disabled:opacity-50"
                        disabled={isProcessing || rows.length === 0}
                    >
                        <ResetIcon className="w-5 h-5"/> Reset
                    </button>
                </div>
            </section>

            {/* Status Bar */}
            <div className={`flex items-center gap-3 p-4 rounded-lg ${message.startsWith('Error') ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
                <InfoIcon className={`w-6 h-6 flex-shrink-0 ${message.startsWith('Error') ? 'text-red-500' : 'text-blue-500'}`} />
                <p className="font-medium text-sm">{message}</p>
            </div>

            {rows.length > 0 && (
            <>
                {/* 2. Column Configuration */}
                <section>
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">2. Configure Columns</h2>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">Detected Headers (Click to select as Website Column)</label>
                            <div className="flex flex-wrap gap-2">
                                {headers.length ? (
                                headers.map((h) => (
                                    <button
                                    key={h}
                                    className={`px-3 py-1 text-sm border rounded-full transition-colors ${
                                        h === websiteCol ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 hover:bg-slate-100 border-slate-300"
                                    }`}
                                    onClick={() => {
                                        setWebsiteCol(h);
                                        applyFilter(rows, h);
                                    }}
                                    >
                                    {h}
                                    </button>
                                ))
                                ) : (
                                <span className="text-sm text-slate-500">No headers found.</span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="website-col" className="block text-sm font-medium text-slate-600 mb-1">Website Column</label>
                                <input
                                id="website-col"
                                value={websiteCol}
                                onChange={(e) => setWebsiteCol(e.target.value)}
                                onBlur={() => applyFilter(rows, websiteCol)}
                                placeholder="Auto-detected or type manually"
                                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                />
                            </div>

                            <div>
                                <label htmlFor="phone-col" className="block text-sm font-medium text-slate-600 mb-1">Phone Column</label>
                                <input
                                id="phone-col"
                                value={phoneCol}
                                onChange={(e) => setPhoneCol(e.target.value)}
                                placeholder="Auto-detected or type manually"
                                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Actions & Results */}
                <section>
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">3. Results & Export</h2>
                    <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                        <div className="flex flex-wrap gap-3 items-center">
                            <button
                                disabled={!filtered.length}
                                onClick={downloadFiltered}
                                className="flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <CsvIcon className="w-5 h-5"/> Download Filtered CSV ({filtered.length})
                            </button>
                            <button
                                onClick={copyPhones}
                                className="flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!extractedPhones.length}
                            >
                                <CopyIcon className="w-5 h-5"/> Copy Phones ({extractedPhones.length})
                            </button>

                            <button
                                onClick={downloadPhones}
                                className="flex items-center gap-2 px-4 py-2 rounded-md bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!extractedPhones.length}
                            >
                                <DownloadIcon className="w-5 h-5"/> Download Phones (.txt)
                            </button>
                        </div>

                        <div>
                            <h3 className="text-base font-semibold text-slate-700 mb-2">Extracted Phone Numbers</h3>
                            <div className="text-sm text-slate-500 mb-2">Detected from column: <strong>{phoneCol || guessPhoneColumn(headers) || 'N/A'}</strong></div>
                            <div className="max-h-60 overflow-auto p-3 border border-slate-200 rounded-md bg-white">
                                {extractedPhones.length ? (
                                <ol className="list-decimal list-inside space-y-1">
                                    {extractedPhones.map((p, i) => (
                                    <li key={i} className="text-sm text-slate-800 font-mono py-1 px-2 rounded hover:bg-slate-100 break-all">{p}</li>
                                    ))}
                                </ol>
                                ) : (
                                <div className="text-sm text-slate-500 text-center py-8">No valid phone numbers found in the filtered rows.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </>
            )}
        </div>
        
        <footer className="mt-8 text-center text-sm text-slate-500">
          <p>CSV parsing is done locally in your browser. No data is uploaded to any server.</p>
        </footer>
      </main>
    </div>
  );
}
