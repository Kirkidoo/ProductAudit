import React from 'react';
import { XIcon } from './icons';

interface DebugModalProps {
    itemData: any;
    onClose: () => void;
}

const DebugModal: React.FC<DebugModalProps> = ({ itemData, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity" aria-modal="true" role="dialog">
            <div className="bg-slate-100 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col animate-fade-in-up">
                {/* Header */}
                <header className="flex justify-between items-center p-4 border-b border-slate-200 bg-white rounded-t-lg flex-shrink-0">
                    <h2 className="text-xl font-semibold text-slate-800">Debug: Raw Shopify Data</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 p-1 rounded-full hover:bg-slate-100 transition-colors">
                        <XIcon className="h-6 w-6" />
                    </button>
                </header>

                {/* Content */}
                <main className="p-6 flex-grow overflow-y-auto bg-slate-800 text-slate-100 rounded-b-lg">
                    <pre className="whitespace-pre-wrap text-sm">
                        {JSON.stringify(itemData, null, 2)}
                    </pre>
                </main>
            </div>
        </div>
    );
};

export default DebugModal;
