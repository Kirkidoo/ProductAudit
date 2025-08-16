
import React from 'react';
import { CheckCircleIcon } from './icons';

interface AuditProgressScreenProps {
  steps: string[];
  currentStep: number;
  progressMessage?: string;
}

const AuditProgressScreen: React.FC<AuditProgressScreenProps> = ({ steps, currentStep, progressMessage }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] bg-slate-100 p-4">
            <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                <h2 className="text-2xl font-semibold text-slate-800 text-center">Auditing in Progress...</h2>
                <p className="text-center text-slate-500 mt-2 mb-8">{progressMessage || 'Please wait while we analyze your product data.'}</p>
                <div className="flow-root">
                    <ul className="-mb-8">
                        {steps.map((step, stepIdx) => {
                            const isCompleted = currentStep > stepIdx;
                            const isCurrent = currentStep === stepIdx;
                            
                            return (
                                <li key={step}>
                                    <div className="relative pb-8">
                                        {stepIdx !== steps.length - 1 ? (
                                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                                        ) : null}
                                        <div className="relative flex space-x-3">
                                            <div>
                                                <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                                    isCompleted ? 'bg-indigo-600' : isCurrent ? 'bg-indigo-600' : 'bg-slate-300'
                                                }`}>
                                                    {isCompleted ? (
                                                        <CheckCircleIcon className="h-5 w-5 text-white" />
                                                    ) : isCurrent ? (
                                                         <span className="h-2.5 w-2.5 bg-white rounded-full animate-pulse" />
                                                    ) : (
                                                        <span className="h-2.5 w-2.5 bg-white rounded-full" />
                                                    )}
                                                </span>
                                            </div>
                                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                                <div>
                                                    <p className={`text-sm ${isCurrent ? 'font-semibold text-indigo-600' : 'text-slate-600'}`}>{step}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AuditProgressScreen;
