import React, { useState, useEffect } from 'react';
import { SpinnerIcon, AlertTriangleIcon, DocumentIcon, CheckCircleIcon } from './icons';
import { parseCsvToProducts, ParsedCsvResult } from '../utils/csvHelper';
import { Product } from '../types';

interface FileUploadScreenProps {
  onRunAudit: (products: Product[], clearanceSkus: Set<string>, forceRefresh: boolean, useBulkOperation: boolean, fileNames: string[]) => void;
  onBack: () => void;
}

type ParsedFileResult = {
  fileName: string;
  result: ParsedCsvResult;
};

const FileUploadScreen: React.FC<FileUploadScreenProps> = ({ onRunAudit, onBack }) => {
  const [ftpFiles, setFtpFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [ftpError, setFtpError] = useState('');

  const [parsedResult, setParsedResult] = useState<ParsedFileResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  const [forceRefresh, setForceRefresh] = useState(false);

  useEffect(() => {
    const fetchFtpFiles = async () => {
      try {
        const response = await fetch('/api/ftp/files');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || 'Failed to fetch files');
        }
        const files = await response.json();
        setFtpFiles(files);
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unknown error occurred.";
        setFtpError(`Could not load files from FTP server. Please ensure the backend server is running and configured correctly. Details: ${message}`);
      } finally {
        setIsLoadingFiles(false);
      }
    };

    fetchFtpFiles();
  }, []);

  const handleProcessFile = async () => {
    if (!selectedFile) return;

    setIsParsing(true);
    setParseError('');
    setParsedResult(null);

    try {
      const response = await fetch(`/api/ftp/file?name=${encodeURIComponent(selectedFile)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to download file');
      }
      const content = await response.text();
      const isClearanceFile = selectedFile.toLowerCase().includes('clearance');
      const result = await parseCsvToProducts(content, isClearanceFile);
      setParsedResult({ fileName: selectedFile, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred during processing.";
      setParseError(message);
    } finally {
      setIsParsing(false);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedResult) {
      const allProducts = parsedResult.result.products;
      const clearanceSkus = new Set(allProducts.filter(p => p.isClearance).map(p => p.SKU));
      const useBulkOperation = parsedResult.fileName.toLowerCase().includes('shopifyproductimport.csv');
      onRunAudit(allProducts, clearanceSkus, forceRefresh, useBulkOperation, [parsedResult.fileName]);
    }
  };
  
  const totalValidProducts = parsedResult?.result.products.length ?? 0;

  const FtpFileSelector = () => (
    <div className="w-full p-4 rounded-lg border-2 border-dashed border-slate-300">
        <h3 className="text-lg font-medium text-slate-800 mb-4">Select a File from FTP</h3>
        {isLoadingFiles && (
            <div className="flex items-center text-slate-500">
                <SpinnerIcon />
                <span className="ml-2">Loading files from FTP server...</span>
            </div>
        )}
        {ftpError && (
            <div className="bg-rose-50 border-l-4 border-rose-400 text-rose-800 p-4 rounded-md" role="alert">
                <p className="font-bold flex items-center"><AlertTriangleIcon className="h-5 w-5 mr-2 text-rose-500" />FTP Connection Error</p>
                <p className="text-sm mt-1">{ftpError}</p>
            </div>
        )}
        {!isLoadingFiles && !ftpError && (
             <div className="space-y-3">
                {ftpFiles.length > 0 ? (
                    ftpFiles.map(file => (
                        <div key={file} className={`flex items-center p-3 rounded-md transition-colors cursor-pointer ${selectedFile === file ? 'bg-indigo-100 border-indigo-300' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'} border`}
                             onClick={() => {
                                 setSelectedFile(file);
                                 setParsedResult(null); // Reset if a new file is selected
                                 setParseError('');
                             }}
                        >
                            <DocumentIcon className="h-6 w-6 text-slate-500 mr-3" />
                            <span className="font-medium text-slate-700">{file}</span>
                        </div>
                    ))
                ) : (
                    <p className="text-slate-500">No CSV files found in the specified FTP directory.</p>
                )}
            </div>
        )}
        {selectedFile && (
            <div className="mt-4">
                <button
                    type="button"
                    onClick={handleProcessFile}
                    disabled={isParsing}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400"
                >
                    {isParsing ? <><SpinnerIcon /> Parsing...</> : 'Process Selected File'}
                </button>
            </div>
        )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8 h-[calc(100vh-84px)] flex flex-col">
      <div className="text-center mb-6 flex-shrink-0">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Connect to FTP Folder</h1>
        <p className="mt-2 text-lg text-slate-600">Select a file from the FTP server to begin the audit.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md border border-slate-200 flex flex-col flex-grow min-h-0">
        <div className="flex-grow p-6 overflow-y-auto">
          <FtpFileSelector />
          
          {parseError && (
              <div className="mt-4 bg-rose-50 border-l-4 border-rose-400 text-rose-800 p-4 rounded-md" role="alert">
                <p className="font-bold flex items-center"><AlertTriangleIcon className="h-5 w-5 mr-2 text-rose-500" />Processing Error</p>
                <p className="text-sm mt-1">{parseError}</p>
              </div>
          )}

          {parsedResult && !isParsing && (
                <div className="mt-6 bg-green-50 border-l-4 border-green-400 text-green-800 p-4 rounded-md" role="alert">
                    <p className="font-bold flex items-center">
                        <CheckCircleIcon className="h-5 w-5 mr-2 text-green-500" />
                        File Processed Successfully
                    </p>
                    <p className="text-sm mt-1">
                        Found <strong>{parsedResult.result.products.length}</strong> valid products in <span className="font-medium">{parsedResult.fileName}</span>.
                        {parsedResult.result.errors.length > 0 && ` There were ${parsedResult.result.errors.length} errors.`}
                    </p>
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
                 {parsedResult && !parsedResult.fileName.toLowerCase().includes('shopifyproductimport.csv') && (
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