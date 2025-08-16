

import React, { useState, useCallback } from 'react';
import { UploadIcon, SpinnerIcon, AlertTriangleIcon } from './icons';
import { parseCsvToProducts, ParsedCsvResult } from '../utils/csvHelper';
import { Product } from '../types';
import CsvPreviewTable from './CsvPreviewTable';

interface FileUploadScreenProps {
  onRunAudit: (products: Product[], clearanceSkus: Set<string>, forceRefresh: boolean, useBulkOperation: boolean, fileNames: string[]) => void;
  onBack: () => void;
}

type ParsedFileResult = {
  fileName: string;
  result: ParsedCsvResult;
};

const FileUploadScreen: React.FC<FileUploadScreenProps> = ({ onRunAudit, onBack }) => {
  const [parsedResults, setParsedResults] = useState<ParsedFileResult[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [activeTab, setActiveTab] = useState('');

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;

    setIsParsing(true);
    setParseError('');
    setParsedResults([]);

    const results: ParsedFileResult[] = [];
    try {
      for (const file of files) {
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
          console.warn(`Skipping non-CSV file: ${file.name}`);
          continue;
        }
        const content = await file.text();
        const isClearanceFile = file.name.toLowerCase().includes('clearance');
        const result = await parseCsvToProducts(content, isClearanceFile);
        results.push({ fileName: file.name, result });
      }
      setParsedResults(results);
      if(results.length > 0) {
        setActiveTab(results[0].fileName);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred during parsing.";
      setParseError(message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFilesSelected(Array.from(e.target.files));
      e.target.value = ''; // Allow re-uploading the same file
    }
  };
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  }, []);

  const useBulkOperation = parsedResults.some(r =>
      r.fileName.toLowerCase().includes('shopifyproductimport.csv')
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const allProducts = parsedResults.flatMap(r => r.result.products);
    if (allProducts.length > 0) {
      const clearanceSkus = new Set(allProducts.filter(p => p.isClearance).map(p => p.SKU));
      const fileNames = parsedResults.map(r => r.fileName);
      onRunAudit(allProducts, clearanceSkus, forceRefresh, useBulkOperation, fileNames);
    }
  };
  
  const totalValidProducts = parsedResults.reduce((acc, r) => acc + r.result.products.length, 0);
  const currentActiveResult = parsedResults.find(r => r.fileName === activeTab)?.result;

  const Dropzone = () => (
    <div
        className={`relative block w-full rounded-lg border-2 border-dashed transition-colors duration-300
          ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400'}
          ${parsedResults.length > 0 ? 'p-4' : 'p-12'}`
        }
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
        <input id="file-upload" name="file-upload" type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" multiple accept=".csv,text/csv" onChange={handleFileChange} disabled={isParsing} />
        <div className="flex flex-col items-center justify-center text-center">
            {isParsing ? (
                <>
                    <SpinnerIcon />
                    <span className="mt-2 block text-sm font-medium text-slate-900">Parsing files...</span>
                </>
            ) : (
                <>
                    <UploadIcon className={`mx-auto text-slate-400 transition-transform duration-300 ${isDragging ? 'scale-110' : ''} ${parsedResults.length > 0 ? 'h-8 w-8' : 'h-12 w-12'}`} />
                    <span className="mt-2 block text-sm font-medium text-slate-900">
                        <span className="text-indigo-600 hover:text-indigo-500">{parsedResults.length > 0 ? 'Click to replace files' : 'Click to upload files'}</span> or drag and drop
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">CSV files only</span>
                </>
            )}
        </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8 h-[calc(100vh-84px)] flex flex-col">
      <div className="text-center mb-6 flex-shrink-0">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Upload & Preview Files</h1>
        <p className="mt-2 text-lg text-slate-600">Upload CSV files to preview their content before starting the audit.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md border border-slate-200 flex flex-col flex-grow min-h-0">
        <div className="flex-grow p-6 overflow-y-auto">
          <Dropzone />
          
          {parseError && (
              <div className="mt-4 bg-rose-50 border-l-4 border-rose-400 text-rose-800 p-4 rounded-md" role="alert">
                <p className="font-bold flex items-center"><AlertTriangleIcon className="h-5 w-5 mr-2 text-rose-500" />Parsing Error</p>
                <p className="text-sm mt-1">{parseError}</p>
              </div>
          )}

          {parsedResults.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium text-slate-800 mb-4">File Preview</h3>
              <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                  {parsedResults.map(({ fileName, result }) => (
                    <button
                      key={fileName}
                      type="button"
                      onClick={() => setActiveTab(fileName)}
                      className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === fileName
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {fileName} <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{result.rows.length} rows</span>
                    </button>
                  ))}
                </nav>
              </div>

              <div className="mt-4">
                  {currentActiveResult && <CsvPreviewTable parsedResult={currentActiveResult} />}
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 p-6 border-t border-slate-200 bg-slate-50/70 rounded-b-lg">
            <div className="space-y-4">
                 <div className="relative flex items-start">
                    <div className="flex items-center h-5">
                        <input
                            id="forceRefresh"
                            name="forceRefresh"
                            type="checkbox"
                            checked={forceRefresh}
                            onChange={(e) => setForceRefresh(e.target.checked)}
                            className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-slate-300 rounded"
                        />
                    </div>
                    <div className="ml-3 text-sm">
                        <label htmlFor="forceRefresh" className="font-medium text-slate-700">Fetch fresh product data from Shopify</label>
                        <p className="text-slate-500">Uncheck to use cached data from the last full audit for a faster start.</p>
                    </div>
                </div>
                 {parsedResults.length > 0 && !useBulkOperation && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-4 rounded-md" role="alert">
                        <p className="font-bold flex items-center"><AlertTriangleIcon className="h-5 w-5 mr-2 text-blue-500" />Note on Partial Audits</p>
                        <p className="text-sm mt-1">
                            Because a full product export file (e.g., containing `shopifyproductimport.csv`) was not included, the check for products that have a 'Clearance' tag in Shopify but shouldn't will be skipped to keep the audit fast.
                        </p>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between mt-6">
                 <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={totalValidProducts === 0}
                  className="w-full max-w-xs inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  Start Audit ({totalValidProducts} products)
                </button>
            </div>
        </div>
      </form>
    </div>
  );
};

export default FileUploadScreen;