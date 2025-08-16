
import React from 'react';
import { ParsedCsvResult } from '../utils/csvHelper';
import { AlertTriangleIcon } from './icons';

interface CsvPreviewTableProps {
    parsedResult: ParsedCsvResult;
}

const CsvPreviewTable: React.FC<CsvPreviewTableProps> = ({ parsedResult }) => {
    const { rows, headers } = parsedResult;

    if (!rows || rows.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500">
                <p>No data rows found in this file.</p>
            </div>
        );
    }
    
    // Add "Line #" and "Warning" to the headers for display
    const displayHeaders = ['Line #', ...headers, 'Warning'];

    return (
        <div className="border border-slate-200 rounded-md overflow-hidden">
            <div className="overflow-x-auto relative">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-100 sticky top-0 z-10">
                        <tr>
                            {displayHeaders.map(header => (
                                <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {rows.map((row) => (
                            <tr key={row.lineNumber} className={`${row.warning ? 'bg-rose-50' : 'hover:bg-slate-50'}`}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-500">
                                    {row.lineNumber}
                                </td>
                                {headers.map(header => (
                                    <td key={`${row.lineNumber}-${header}`} className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                                        {row.rawData[header]}
                                    </td>
                                ))}
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-rose-700">
                                    {row.warning && (
                                        <div className="flex items-center" title={row.warning}>
                                            <AlertTriangleIcon className="h-4 w-4 mr-1.5 text-rose-500 flex-shrink-0" />
                                            <span className="truncate max-w-xs">{row.warning}</span>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CsvPreviewTable;
