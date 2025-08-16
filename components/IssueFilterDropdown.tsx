
import React, { useState, useRef, useEffect } from 'react';
import { Discrepancy } from '../types';
import { ChevronDownIcon, CheckIcon } from './icons';

type IssueType = Discrepancy['Field'];

interface IssueFilterDropdownProps {
  allIssueTypes: IssueType[];
  selectedFilters: Set<IssueType>;
  onChange: (newFilters: Set<IssueType>) => void;
}

const IssueFilterDropdown: React.FC<IssueFilterDropdownProps> = ({ allIssueTypes, selectedFilters, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleToggle = (issueType: IssueType) => {
        const newFilters = new Set(selectedFilters);
        if (newFilters.has(issueType)) {
            newFilters.delete(issueType);
        } else {
            newFilters.add(issueType);
        }
        onChange(newFilters);
    };
    
    const handleSelectAll = () => onChange(new Set(allIssueTypes));
    const handleClearAll = () => onChange(new Set());

    return (
        <div className="relative inline-block text-left" ref={wrapperRef}>
            <div>
                <button
                    type="button"
                    className="inline-flex justify-center w-full rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 focus:ring-indigo-500"
                    id="menu-button"
                    aria-expanded="true"
                    aria-haspopup="true"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    Filter Issues ({selectedFilters.size} / {allIssueTypes.length})
                    <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" />
                </button>
            </div>

            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-20" role="menu" aria-orientation="vertical" aria-labelledby="menu-button">
                    <div className="py-1" role="none">
                        <div className="px-4 py-2 flex justify-between items-center border-b border-slate-200">
                             <button onClick={handleSelectAll} className="text-sm font-medium text-indigo-600 hover:text-indigo-900">Select All</button>
                             <button onClick={handleClearAll} className="text-sm font-medium text-indigo-600 hover:text-indigo-900">Clear All</button>
                        </div>
                        {allIssueTypes.map((issueType) => (
                            <a
                                key={issueType}
                                href="#"
                                onClick={(e) => { e.preventDefault(); handleToggle(issueType); }}
                                className="text-slate-700 block px-4 py-2 text-sm hover:bg-slate-100 flex items-center justify-between"
                                role="menuitem"
                            >
                                <span>{issueType.replace(/([A-Z])/g, ' $1').trim()}</span>
                                {selectedFilters.has(issueType) && <CheckIcon className="h-5 w-5 text-indigo-600" />}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default IssueFilterDropdown;
